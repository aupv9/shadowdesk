/**
 * P0 FIX: SharedArrayBuffer hiding in non-COOP/COEP contexts
 *
 * SharedArrayBuffer was disabled globally in browsers post-Spectre/Meltdown
 * and re-enabled only in cross-origin isolated contexts (COOP + COEP headers).
 *
 * Headless/automated contexts often expose SharedArrayBuffer when they shouldn't,
 * which is a strong signal of automation. This script hides it appropriately.
 */

export function buildSharedArrayBufferScript(): string {
  return `
(function() {
  'use strict';

  // Check if we're in a cross-origin isolated context via headers
  // In real browsers, SharedArrayBuffer is only available if:
  // Cross-Origin-Opener-Policy: same-origin
  // Cross-Origin-Embedder-Policy: require-corp
  // For simplicity, assume non-isolated context and hide SharedArrayBuffer

  if (typeof SharedArrayBuffer !== 'undefined') {
    try {
      delete globalThis.SharedArrayBuffer;
    } catch (e) {
      // If delete fails, use a proxy trap to hide it
      const handler = {
        has: (target, key) => {
          if (key === 'SharedArrayBuffer') return false;
          return key in target;
        },
        get: (target, key) => {
          if (key === 'SharedArrayBuffer') return undefined;
          return target[key];
        }
      };
      const proxy = new Proxy(globalThis, handler);
      Object.defineProperty(globalThis, 'SharedArrayBuffer', {
        value: undefined,
        writable: false,
        configurable: false
      });
    }
  }

  // Also hide in WebWorker global scope
  if (typeof self !== 'undefined' && self !== globalThis) {
    try {
      delete self.SharedArrayBuffer;
    } catch (e) {
      Object.defineProperty(self, 'SharedArrayBuffer', {
        value: undefined,
        writable: false,
        configurable: false
      });
    }
  }
})();
`
}
