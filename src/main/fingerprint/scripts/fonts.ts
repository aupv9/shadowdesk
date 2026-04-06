import type { FontConfig } from '../../../shared/types'

export function buildFontsScript(config: FontConfig): string {
  if (config.mode !== 'whitelist') return ''

  return `
(function() {
  'use strict';

  const ALLOWED_FONTS = new Set(${JSON.stringify(config.whitelist)});

  // Override font enumeration via document.fonts
  if (document.fonts) {
    const origCheck = document.fonts.check.bind(document.fonts);
    document.fonts.check = function(font, text) {
      // Extract font family from CSS font string
      const match = font.match(/['"]?([^'"]+)['"]?\\s*$/);
      const family = match ? match[1].trim() : '';
      if (!ALLOWED_FONTS.has(family)) return false;
      return origCheck(font, text);
    };
  }

  // Override measureText to add consistent micro-noise for font metrics
  const origMeasureText = CanvasRenderingContext2D.prototype.measureText;
  CanvasRenderingContext2D.prototype.measureText = function(text) {
    const metrics = origMeasureText.call(this, text);
    // Wrap the TextMetrics to add sub-pixel noise
    return new Proxy(metrics, {
      get(target, prop) {
        const val = target[prop];
        if (typeof val === 'number' && prop !== 'width') {
          return val + (Math.random() - 0.5) * 0.02;
        }
        return val;
      }
    });
  };
})();
`
}
