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
 */
export function buildBehaviorScript(config: BehaviorConfig, seed: number): string {
  if (!config.mouseJitter && !config.typingNoise && !config.scrollInertia) {
    return ''
  }

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
  (function() {
    var jitterSeed = ${(seed ^ 0xDEAD) >>> 0};
    var jRng = mkRng(jitterSeed);

    function addJitter(evt) {
      if (!(evt instanceof MouseEvent)) return;
      var dx = gaussNoise(jRng, 0.4);
      var dy = gaussNoise(jRng, 0.4);
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
  // Real users have variable inter-keystroke timing (50–120 ms) and subtle
  // key-hold durations. We expose this by patching timeStamp on KeyboardEvents
  // so detection scripts that compute typing rhythm see realistic variance.
  (function() {
    var typeSeed = ${(seed ^ 0xBEEF) >>> 0};
    var tRng = mkRng(typeSeed);
    // Base hold jitter ±5 ms, inter-key jitter ±25 ms
    var holdJitter = 0;
    var interJitter = 0;

    var origDispatch = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function(evt) {
      if (evt instanceof KeyboardEvent) {
        holdJitter  = gaussNoise(tRng, 5);
        interJitter = gaussNoise(tRng, 12);
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
  (function() {
    var scrollSeed = ${(seed ^ 0xFACE) >>> 0};
    var sRng = mkRng(scrollSeed);
    var lastDelta = 0;
    var decayFactor = 0.82 + sRng() * 0.12; // 0.82–0.94

    var origAEL2 = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, opts) {
      if (type === 'wheel') {
        var wrapped = function(evt) {
          if (Math.abs(evt.deltaY) > 0) {
            var naturalDelta = lastDelta === 0
              ? evt.deltaY
              : lastDelta * decayFactor + gaussNoise(sRng, 2);
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
