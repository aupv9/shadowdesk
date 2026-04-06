/** Inject sub-pixel noise into getBoundingClientRect and getClientRects */
export function buildClientRectsScript(noiseSeed: number): string {
  return `
(function() {
  'use strict';

  // Derive a tiny per-profile constant offset from noiseSeed
  const seed = ${noiseSeed} >>> 0;
  const offset = ((seed * 2654435769 >>> 0) / 0xffffffff - 0.5) * 0.00015;

  const origGBCR = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function() {
    const r = origGBCR.call(this);
    return {
      x:      r.x      + offset,
      y:      r.y      + offset,
      width:  r.width  + offset,
      height: r.height + offset,
      top:    r.top    + offset,
      right:  r.right  + offset,
      bottom: r.bottom + offset,
      left:   r.left   + offset,
      toJSON: () => ({ x: r.x + offset, y: r.y + offset, width: r.width + offset, height: r.height + offset,
                       top: r.top + offset, right: r.right + offset, bottom: r.bottom + offset, left: r.left + offset })
    };
  };

  const origGCR = Element.prototype.getClientRects;
  Element.prototype.getClientRects = function() {
    const rects = Array.from(origGCR.call(this));
    const patched = rects.map(r => ({
      x:      r.x      + offset,
      y:      r.y      + offset,
      width:  r.width  + offset,
      height: r.height + offset,
      top:    r.top    + offset,
      right:  r.right  + offset,
      bottom: r.bottom + offset,
      left:   r.left   + offset,
      toJSON: () => ({ x: r.x + offset, y: r.y + offset, width: r.width + offset, height: r.height + offset,
                       top: r.top + offset, right: r.right + offset, bottom: r.bottom + offset, left: r.left + offset })
    }));
    return Object.assign(patched, { item: (i) => patched[i] || null, [Symbol.iterator]: patched[Symbol.iterator].bind(patched) });
  };
})();
`
}
