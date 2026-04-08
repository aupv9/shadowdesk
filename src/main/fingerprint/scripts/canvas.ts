import type { CanvasConfig } from '../../../shared/types'

/** Inject canvas noise to prevent canvas fingerprinting */
export function buildCanvasScript(config: CanvasConfig): string {
  if (config.mode === 'block') {
    return `
(function() {
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(type) {
    const ctx = this.getContext('2d');
    if (ctx) return 'data:,';
    return origToDataURL.apply(this, arguments);
  };
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    const empty = document.createElement('canvas');
    empty.width = 1; empty.height = 1;
    return origToBlob.call(empty, callback, ...args);
  };
})();
`
  }

  if (config.mode === 'noise') {
    return `
(function() {
  // Seeded pseudo-random using seed = ${config.noiseSeed}
  function seededRng(seed) {
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
  const rng = seededRng(${config.noiseSeed});

  function addNoise(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // P0 FIX: Increase noise entropy from ±1 to ±25 per channel
      // Previous ±1 was easily detected via statistical analysis
      const noise = Math.floor(rng() * 51) - 25; // -25 to +25
      data[i]     = Math.max(0, Math.min(255, data[i]     + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    return imageData;
  }

  // Override getImageData
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
    const imageData = origGetImageData.call(this, x, y, w, h);
    return addNoise(imageData);
  };

  // Override toDataURL
  const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    const ctx = this.getContext('2d');
    if (ctx) {
      const imageData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
      addNoise(imageData);
      ctx.putImageData(imageData, 0, 0);
    }
    return origToDataURL.apply(this, arguments);
  };

  // Override toBlob
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    const ctx = this.getContext('2d');
    if (ctx) {
      const imageData = origGetImageData.call(ctx, 0, 0, this.width, this.height);
      addNoise(imageData);
      ctx.putImageData(imageData, 0, 0);
    }
    return origToBlob.call(this, callback, ...args);
  };
})();
`
  }

  return '' // mode === 'real'
}
