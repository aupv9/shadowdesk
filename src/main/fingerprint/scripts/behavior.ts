import type { BehaviorConfig } from '../../../shared/types'

/**
 * Phase 6 — Behavior Simulation
 *
 * Injects subtle human-like behavioral signals into pointer, keyboard, and
 * scroll events so bot-detection heuristics that analyse event-level timing
 * and micro-movement see patterns consistent with a real user.
 *
 * All noise is deterministic via the profile seed so the same profile always
 * produces the same behavioural signature across sessions.
 *
 * Phase 17 — The Behavioral Config UI now lets users tune intensity for each
 * stream (mouse jitter sigma, typing WPM/variance, scroll decay/noise). This
 * function reads those advanced knobs if present; otherwise it falls back
 * to the Phase 6 defaults so older profiles keep working.
 */
export function buildBehaviorScript(config: BehaviorConfig, seed: number): string {
  if (!config.mouseJitter && !config.typingNoise && !config.scrollInertia) {
    return ''
  }

  // Phase 17: clamp advanced params to sane ranges so a broken UI slider
  // can't crash the injector or produce absurd values.
  const clamp = (v: number, lo: number, hi: number) =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo

  const mouseSigma     = clamp(config.mouseJitterSigma ?? 0.4, 0, 2)
  const typingWpm      = clamp(config.typingWpm ?? 75, 40, 200)
  const typingVarPct   = clamp(config.typingVariancePct ?? 20, 0, 60)
  const typingHoldSig  = clamp(config.typingHoldSigmaMs ?? 5, 0, 25)
  const scrollDecay    = clamp(config.scrollDecay ?? 0.88, 0.6, 0.99)
  const scrollNoise    = clamp(config.scrollNoisePx ?? 2, 0, 10)

  // Derive inter-key sigma from WPM variance — this is what the script uses
  // to jitter each keydown/keyup timestamp in ms.
  //   baseInterKeyMs = (60 * 1000) / (typingWpm * 5)   [5 chars per word]
  //   interKeySigma  = baseInterKeyMs * typingVarPct / 100
  const baseInterKey   = (60 * 1000) / (typingWpm * 5)
  const interKeySigma  = baseInterKey * (typingVarPct / 100)

  return `
(function() {
  'use strict';

  // Lightweight seeded PRNG (mulberry32) — same seed → same noise per profile
  function mkRng(s) {
    return function() {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rng = mkRng(${seed >>> 0});

  // Gaussian-like noise from two uniform samples
  function gaussNoise(rng, sigma) {
    var u = 1 - rng(), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma;
  }

${config.mouseJitter ? `
  // ── Mouse jitter ─────────────────────────────────────────────────────────
  // Add sub-pixel noise to clientX/clientY/screenX/screenY so the pointer
  // path never looks perfectly mechanical (straight lines, constant speed).
  // Phase 17: sigma is user-configurable via the Behavioral Config UI.
  (function() {
    var jitterSeed = ${(seed ^ 0xDEAD) >>> 0};
    var jRng = mkRng(jitterSeed);
    var MOUSE_SIGMA = ${mouseSigma};

    function addJitter(evt) {
      if (!(evt instanceof MouseEvent)) return;
      if (MOUSE_SIGMA <= 0) return;
      var dx = gaussNoise(jRng, MOUSE_SIGMA);
      var dy = gaussNoise(jRng, MOUSE_SIGMA);
      // Redefine read-only properties on the event prototype chain
      try {
        Object.defineProperties(evt, {
          clientX: { get: function() { return evt.clientX + dx | 0; }, configurable: true },
          clientY: { get: function() { return evt.clientY + dy | 0; }, configurable: true },
          screenX: { get: function() { return evt.screenX + dx | 0; }, configurable: true },
          screenY: { get: function() { return evt.screenY + dy | 0; }, configurable: true }
        });
      } catch(e) { /* read-only in some sandboxes — skip silently */ }
    }

    var origAEL = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, opts) {
      if (type === 'mousemove' || type === 'mousedown' || type === 'mouseup' || type === 'click') {
        var wrapped = function(evt) { addJitter(evt); return listener.call(this, evt); };
        return origAEL.call(this, type, wrapped, opts);
      }
      return origAEL.call(this, type, listener, opts);
    };
    // Make the wrapper invisible to toString checks
    Object.defineProperty(EventTarget.prototype.addEventListener, 'toString', {
      value: function() { return 'function addEventListener() { [native code] }'; }
    });
  })();
` : ''}

${config.typingNoise ? `
  // ── Typing cadence noise ──────────────────────────────────────────────────
  // Real users have variable inter-keystroke timing and subtle key-hold
  // durations. We expose this by patching timeStamp on KeyboardEvents so
  // detection scripts that compute typing rhythm see realistic variance.
  // Phase 17: hold + inter-key sigma derived from user-selected WPM and
  // variance percentage in the Behavioral Config UI.
  (function() {
    var typeSeed = ${(seed ^ 0xBEEF) >>> 0};
    var tRng = mkRng(typeSeed);
    var HOLD_SIGMA_MS       = ${typingHoldSig};
    var INTER_KEY_SIGMA_MS  = ${interKeySigma.toFixed(3)};
    var holdJitter = 0;
    var interJitter = 0;

    var origDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function(evt) {
      if (evt instanceof KeyboardEvent) {
        holdJitter  = gaussNoise(tRng, HOLD_SIGMA_MS);
        interJitter = gaussNoise(tRng, INTER_KEY_SIGMA_MS);
        try {
          Object.defineProperty(evt, 'timeStamp', {
            get: function() {
              var base = performance.now();
              return evt.type === 'keydown' ? base + interJitter
                   : evt.type === 'keyup'   ? base + holdJitter + interJitter
                   : base;
            },
            configurable: true
          });
        } catch(e) {}
      }
      return origDispatch.call(this, evt);
    };
    Object.defineProperty(EventTarget.prototype.dispatchEvent, 'toString', {
      value: function() { return 'function dispatchEvent() { [native code] }'; }
    });
  })();
` : ''}

${config.scrollInertia ? `
  // ── Scroll inertia simulation ─────────────────────────────────────────────
  // Real trackpad/mouse wheel scroll has deceleration momentum. We expose
  // this by patching WheelEvent.deltaY so burst-scrolling detectors see
  // decreasing delta magnitudes (inertia decay), not identical values.
  // Phase 17: decay + noise are user-configurable.
  (function() {
    var scrollSeed = ${(seed ^ 0xFACE) >>> 0};
    var sRng = mkRng(scrollSeed);
    var lastDelta = 0;
    // Center the user-selected decay with a small deterministic +/- drift
    // so identical configs across profiles still diverge slightly.
    var decayFactor = ${scrollDecay} + (sRng() - 0.5) * 0.06;
    var SCROLL_NOISE_PX = ${scrollNoise};

    var origAEL2 = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, opts) {
      if (type === 'wheel') {
        var wrapped = function(evt) {
          if (Math.abs(evt.deltaY) > 0) {
            var naturalDelta = lastDelta === 0
              ? evt.deltaY
              : lastDelta * decayFactor + gaussNoise(sRng, SCROLL_NOISE_PX);
            lastDelta = naturalDelta;
            try {
              Object.defineProperty(evt, 'deltaY', {
                get: function() { return naturalDelta; },
                configurable: true
              });
            } catch(e) {}
          } else {
            lastDelta = 0;
          }
          return listener.call(this, evt);
        };
        return origAEL2.call(this, type, wrapped, opts);
      }
      return origAEL2.call(this, type, listener, opts);
    };
  })();
` : ''}

})();
`
}
