import type {
  BrowserConfig,
  HardwareConfig,
  LocaleConfig,
  ScreenConfig
} from '../../../shared/types'

/**
 * Phase 9.3 — iframe fingerprint propagation
 *
 * Same-origin iframes (and especially `about:blank` / `srcdoc` iframes)
 * are spawned with their own JavaScript execution context. Although
 * Chromium DOES propagate `Page.addScriptToEvaluateOnNewDocument` to
 * sub-frames in most cases, several edge cases leak the real
 * fingerprint:
 *
 *   1) `<iframe>` with no `src` and no `srcdoc` (about:blank) — the
 *      injection sometimes fires AFTER detection code reads `navigator`.
 *   2) `<iframe srcdoc="...">` — the script may execute against the
 *      parent document if the iframe is removed before injection.
 *   3) Programmatically created iframes that get a `contentWindow`
 *      reference before being attached to the DOM.
 *
 * This script:
 *  - Walks any existing iframes after document_start.
 *  - Installs a MutationObserver that re-applies critical navigator/screen
 *    properties on every newly-added iframe via its contentWindow.
 *  - Re-applies after the iframe's `load` event (covers same-origin nav).
 */
export function buildIframePropagationScript(
  browser: BrowserConfig,
  hardware: HardwareConfig,
  locale: LocaleConfig,
  screen: ScreenConfig
): string {
  // The patch source that runs INSIDE every iframe's window.
  // We use `defineProperty` so the value survives strict-mode reads.
  const patchSrc = `
(function(w){
  if (!w || w.__ghostFpApplied) return;
  try { w.__ghostFpApplied = true; } catch(e) {}
  var n = w.navigator;
  var s = w.screen;
  function set(obj, key, val) {
    try {
      Object.defineProperty(obj, key, {
        get: function(){ return val; },
        configurable: true
      });
    } catch(e) {}
  }
  set(n, 'userAgent',           ${JSON.stringify(browser.userAgent)});
  set(n, 'platform',            ${JSON.stringify(browser.platform)});
  set(n, 'vendor',              ${JSON.stringify(browser.vendor)});
  set(n, 'language',            ${JSON.stringify(locale.language)});
  set(n, 'languages',           ${JSON.stringify(locale.languages)});
  set(n, 'hardwareConcurrency', ${hardware.hardwareConcurrency});
  set(n, 'deviceMemory',        ${hardware.deviceMemory});
  set(n, 'maxTouchPoints',      ${hardware.maxTouchPoints});
  set(n, 'webdriver',           undefined);
  if (s) {
    set(s, 'width',       ${screen.width});
    set(s, 'height',      ${screen.height});
    set(s, 'availWidth',  ${screen.availWidth});
    set(s, 'availHeight', ${screen.availHeight});
    set(s, 'colorDepth',  ${screen.colorDepth});
  }
  try { set(w, 'devicePixelRatio', ${screen.pixelRatio}); } catch(e) {}
})(arguments[0]);
`

  const patchSrcJson = JSON.stringify(patchSrc)

  return `
(function() {
  'use strict';
  if (typeof MutationObserver === 'undefined') return;

  var PATCH_SRC = ${patchSrcJson};

  function patchFrame(iframe) {
    try {
      var w = iframe.contentWindow;
      if (!w) return;
      // Same-origin check — accessing properties on a cross-origin window throws.
      try {
        if (w.location && w.location.href !== undefined) { /* same origin */ }
      } catch (e) {
        return; // cross-origin, can't patch
      }
      // Apply via the iframe's own Function constructor so the patch executes
      // in the iframe's realm rather than the parent's.
      try {
        new w.Function('return (function(w){ (' + 'function(){ ' + PATCH_SRC + ' }' + ').call(w);})')()(w);
      } catch (e) {
        // Fallback: use eval inside the iframe.
        try { (0, w.eval)('(function(){ ' + PATCH_SRC + ' }).call(this, this);'); } catch(e2) {}
      }
    } catch (e) {}
  }

  function patchAllIframes(root) {
    try {
      var frames = (root || document).querySelectorAll('iframe');
      for (var i = 0; i < frames.length; i++) {
        patchFrame(frames[i]);
        // Re-patch on load (e.g. when src navigates to a same-origin doc)
        try {
          if (!frames[i].__ghostListener) {
            frames[i].__ghostListener = true;
            frames[i].addEventListener('load', function(ev){ patchFrame(ev.target); }, true);
          }
        } catch(e) {}
      }
    } catch(e) {}
  }

  // Initial pass once DOM is parseable.
  if (document.readyState !== 'loading') {
    patchAllIframes(document);
  } else {
    document.addEventListener('DOMContentLoaded', function(){ patchAllIframes(document); }, true);
  }

  // Watch for new iframes inserted at any time.
  try {
    var mo = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node && node.nodeType === 1) {
            if (node.tagName === 'IFRAME') {
              patchFrame(node);
              try {
                if (!node.__ghostListener) {
                  node.__ghostListener = true;
                  node.addEventListener('load', function(ev){ patchFrame(ev.target); }, true);
                }
              } catch(e) {}
            } else if (node.querySelectorAll) {
              patchAllIframes(node);
            }
          }
        }
      }
    });
    mo.observe(document.documentElement || document, { childList: true, subtree: true });
  } catch(e) {}
})();
`
}
