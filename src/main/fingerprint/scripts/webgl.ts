import type { WebGlConfig } from '../../../shared/types'

export function buildWebGlScript(config: WebGlConfig): string {
  return `
(function() {
  'use strict';

  const VENDOR   = ${JSON.stringify(config.vendor)};
  const RENDERER = ${JSON.stringify(config.renderer)};

  function seededRng(seed) {
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
  const rng = seededRng(${config.noiseSeed});

  function patchContext(ctx) {
    if (!ctx || ctx.__ghostPatched) return;
    ctx.__ghostPatched = true;

    const origGetParameter = ctx.getParameter.bind(ctx);
    ctx.getParameter = function(pname) {
      if (pname === 37445) return VENDOR;   // UNMASKED_VENDOR_WEBGL
      if (pname === 37446) return RENDERER; // UNMASKED_RENDERER_WEBGL
      return origGetParameter(pname);
    };

    const origGetExtension = ctx.getExtension.bind(ctx);
    ctx.getExtension = function(name) {
      const ext = origGetExtension(name);
      if (name === 'WEBGL_debug_renderer_info') {
        return {
          UNMASKED_VENDOR_WEBGL: 37445,
          UNMASKED_RENDERER_WEBGL: 37446
        };
      }
      return ext;
    };

    // Add noise to readPixels to prevent WebGL fingerprinting
    const origReadPixels = ctx.readPixels.bind(ctx);
    ctx.readPixels = function(x, y, width, height, format, type, pixels) {
      origReadPixels(x, y, width, height, format, type, pixels);
      if (pixels instanceof Uint8Array || pixels instanceof Uint8ClampedArray) {
        for (let i = 0; i < pixels.length; i += 4) {
          // P0 FIX: Increase noise entropy from ±1 to ±25 per channel
          // Apply to all 4 channels (RGBA) for full coverage
          const noise = Math.floor(rng() * 51) - 25; // -25 to +25
          pixels[i]     = Math.max(0, Math.min(255, pixels[i]     + noise));
          pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noise));
          pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noise));
          pixels[i + 3] = Math.max(0, Math.min(255, pixels[i + 3] + noise));
        }
      }
    };
  }

  // Intercept canvas.getContext to patch WebGL contexts
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, ...args) {
    const ctx = origGetContext.call(this, type, ...args);
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      patchContext(ctx);
    }
    return ctx;
  };
})();
`
}
