import type { TimingConfig } from '../../../shared/types'

/**
 * Phase 6 — Timing Attack Defenses
 *
 * High-resolution timing APIs (performance.now, Date.now, SharedArrayBuffer
 * postMessage tricks) are a primary side-channel for fingerprinting and for
 * detecting automation via deterministic timing patterns.
 *
 * This script:
 *  1. Quantises Date.now() to configurable precision blocks
 *  2. Adds bounded jitter to requestAnimationFrame timestamps
 *  3. Optionally clamps performance.now() to match Date.now precision
 *
 * All noise is deterministic per profile (seeded) so repeated measurements
 * within the same session return consistent-enough values to not break sites
 * while still frustrating cross-site timing correlation.
 */
export function buildTimingScript(config: TimingConfig, seed: number): string {
  return `
(function() {
  'use strict';

  // ── Seeded PRNG (mulberry32) ───────────────────────────────────────────────
  var _ts = ${seed >>> 0};
  function rng() {
    _ts |= 0; _ts = _ts + 0x6D2B79F5 | 0;
    var t = Math.imul(_ts ^ _ts >>> 15, 1 | _ts);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  var PRECISION = ${config.dateNoisePrecision}; // ms block size

  // ── Date.now() quantisation ───────────────────────────────────────────────
  // Rounds the real timestamp to the nearest PRECISION block and adds a
  // deterministic sub-block offset so the value isn't exactly on the boundary.
  (function() {
    var _origDateNow = Date.now.bind(Date);
    // Sub-block offset: 0..PRECISION-1 ms, stable for the session
    var _offset = Math.floor(rng() * PRECISION);

    var _patchedNow = function now() {
      var real = _origDateNow();
      return Math.floor(real / PRECISION) * PRECISION + _offset;
    };

    Date.now = _patchedNow;
    // Keep Date constructor behavior consistent for new Date()
    var _origDate = Date;
    var _patchedDate = function Date(...args) {
      if (args.length === 0) {
        return new _origDate(_patchedNow());
      }
      return new _origDate(...args);
    };
    // Copy statics
    _patchedDate.now   = _patchedNow;
    _patchedDate.parse = _origDate.parse.bind(_origDate);
    _patchedDate.UTC   = _origDate.UTC.bind(_origDate);
    // Preserve prototype so instanceof checks keep working
    _patchedDate.prototype = _origDate.prototype;
    try {
      window.Date = _patchedDate;
      Object.defineProperty(window.Date, 'toString', {
        value: function() { return 'function Date() { [native code] }'; }
      });
    } catch(e) {}
  })();

${config.performanceClamp ? `
  // ── performance.now() clamping ────────────────────────────────────────────
  // Brings performance.now() precision down to match Date.now so cross-API
  // timing correlation attacks are less effective.
  (function() {
    var _origPerfNow = performance.now.bind(performance);
    var _perfOffset  = rng() * PRECISION;

    performance.now = function now() {
      var real = _origPerfNow();
      return Math.floor(real / PRECISION) * PRECISION + _perfOffset;
    };
    Object.defineProperty(performance.now, 'toString', {
      value: function() { return 'function now() { [native code] }'; }
    });
  })();
` : ''}

${config.rafJitter ? `
  // ── requestAnimationFrame timestamp jitter ────────────────────────────────
  // The DOMHighResTimeStamp passed to rAF callbacks is a monotonically
  // increasing value that automation tools produce with machine-perfect
  // regularity (16.666… ms exactly at 60 Hz). Real browsers have noise from
  // GPU scheduling and compositor jitter. We add ±2 ms Gaussian noise.
  (function() {
    var _origRAF = window.requestAnimationFrame.bind(window);

    window.requestAnimationFrame = function requestAnimationFrame(cb) {
      return _origRAF(function(ts) {
        // Box-Muller for Gaussian noise, sigma=1.2ms
        var u = 1 - rng(), v = rng();
        var noise = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * 1.2;
        cb(ts + noise);
      });
    };
    Object.defineProperty(window.requestAnimationFrame, 'toString', {
      value: function() { return 'function requestAnimationFrame() { [native code] }'; }
    });

    // Also patch cancelAnimationFrame so rAF IDs still work
    var _origCAF = window.cancelAnimationFrame.bind(window);
    window.cancelAnimationFrame = function cancelAnimationFrame(id) {
      return _origCAF(id);
    };
    Object.defineProperty(window.cancelAnimationFrame, 'toString', {
      value: function() { return 'function cancelAnimationFrame() { [native code] }'; }
    });
  })();
` : ''}

  // ── SharedArrayBuffer / Atomics timing attack mitigation ─────────────────
  // If SharedArrayBuffer is available, high-precision timers can be built
  // using Atomics.wait(). We don't block SAB (breaks WASM), but we add
  // noise to Atomics.wait return timing.
  (function() {
    if (typeof Atomics === 'undefined' || typeof Atomics.wait !== 'function') return;
    var _origWait = Atomics.wait.bind(Atomics);
    Atomics.wait = function wait(ta, idx, val, timeout) {
      // Add 0–2 ms of noise to the timeout so attack loops see jitter
      var noisyTimeout = (timeout === undefined || timeout === Infinity)
        ? timeout
        : timeout + rng() * 2;
      return _origWait(ta, idx, val, noisyTimeout);
    };
    Object.defineProperty(Atomics.wait, 'toString', {
      value: function() { return 'function wait() { [native code] }'; }
    });
  })();

})();
`
}
