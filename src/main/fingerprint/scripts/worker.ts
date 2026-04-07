import type {
  BrowserConfig,
  HardwareConfig,
  LocaleConfig,
  OsConfig
} from '../../../shared/types'

/**
 * Phase 9.1 — Worker fingerprint propagation
 *
 * Web Workers, SharedWorkers and (where possible) ServiceWorkers run in their
 * own JavaScript contexts and do NOT inherit `evaluateOnNewDocument` patches.
 * Detectors exploit this by spawning a worker and reading
 * `navigator.webdriver` / `navigator.userAgent` / `navigator.hardwareConcurrency`
 * inside it — the values leak the un-spoofed real browser.
 *
 * This script patches the Worker / SharedWorker constructors so that any
 * worker spawned from the page is wrapped with a prelude that re-applies
 * the same navigator overrides used in the main thread.
 */
export function buildWorkerFingerprintScript(
  browser: BrowserConfig,
  hardware: HardwareConfig,
  locale: LocaleConfig,
  os: OsConfig
): string {
  // Source code that runs INSIDE the worker before the user code.
  // Note: workers expose `self`, not `window`. `navigator` is `WorkerNavigator`
  // which is a different prototype than the main-thread `Navigator`.
  const workerPrelude = `
(function(){
  try {
    var n = self.navigator;
    var defs = {
      userAgent:           ${JSON.stringify(browser.userAgent)},
      platform:            ${JSON.stringify(browser.platform)},
      vendor:              ${JSON.stringify(browser.vendor)},
      language:            ${JSON.stringify(locale.language)},
      languages:           ${JSON.stringify(locale.languages)},
      hardwareConcurrency: ${hardware.hardwareConcurrency},
      deviceMemory:        ${hardware.deviceMemory},
      webdriver:           undefined
    };
    for (var k in defs) {
      try {
        Object.defineProperty(n, k, { get: (function(v){return function(){return v;};})(defs[k]), configurable: true });
      } catch(e) {}
    }
    // Intl timezone consistency inside the worker
    try {
      var _DTF = Intl.DateTimeFormat;
      var tz = ${JSON.stringify(locale.timezone)};
      Intl.DateTimeFormat = function(){
        var args = Array.prototype.slice.call(arguments);
        if (args.length < 2) args[1] = {};
        if (typeof args[1] === 'object' && args[1] !== null && !args[1].timeZone) {
          args[1].timeZone = tz;
        }
        return new (_DTF.bind.apply(_DTF, [null].concat(args)))();
      };
      Intl.DateTimeFormat.prototype = _DTF.prototype;
      Intl.DateTimeFormat.supportedLocalesOf = _DTF.supportedLocalesOf;
    } catch(e) {}
  } catch(e) {}
})();
`

  // Escape the prelude so it can be embedded as a string literal.
  const preludeJson = JSON.stringify(workerPrelude)

  return `
(function() {
  'use strict';
  if (typeof Worker === 'undefined') return;

  var FP_PRELUDE = ${preludeJson};
  var _Worker = Worker;
  var _SharedWorker = typeof SharedWorker !== 'undefined' ? SharedWorker : null;
  var _URL = URL;

  // Wrap a script URL so that the worker first runs FP_PRELUDE.
  function wrapUrl(scriptURL) {
    try {
      var urlStr = String(scriptURL);
      // For data: URLs we can prepend directly.
      if (urlStr.indexOf('data:') === 0) {
        var commaIdx = urlStr.indexOf(',');
        if (commaIdx > 0) {
          var head = urlStr.substring(0, commaIdx + 1);
          var body = decodeURIComponent(urlStr.substring(commaIdx + 1));
          var combined = FP_PRELUDE + '\\n' + body;
          return head + encodeURIComponent(combined);
        }
      }
      // For blob: URLs and any http(s) URL, build a new blob that
      // imports the original script. importScripts() works for both.
      var src = FP_PRELUDE + '\\ntry { importScripts(' + JSON.stringify(urlStr) + '); } catch(e) {}';
      var blob = new Blob([src], { type: 'application/javascript' });
      return _URL.createObjectURL(blob);
    } catch (e) {
      return scriptURL;
    }
  }

  // Patch Worker
  function PatchedWorker(scriptURL, options) {
    return new _Worker(wrapUrl(scriptURL), options);
  }
  PatchedWorker.prototype = _Worker.prototype;
  Object.setPrototypeOf(PatchedWorker, _Worker);
  try {
    Object.defineProperty(PatchedWorker, 'name', { value: 'Worker' });
  } catch(e) {}
  try {
    Object.defineProperty(window, 'Worker', { value: PatchedWorker, writable: true, configurable: true });
  } catch(e) {}

  // Patch SharedWorker
  if (_SharedWorker) {
    function PatchedSharedWorker(scriptURL, options) {
      return new _SharedWorker(wrapUrl(scriptURL), options);
    }
    PatchedSharedWorker.prototype = _SharedWorker.prototype;
    Object.setPrototypeOf(PatchedSharedWorker, _SharedWorker);
    try {
      Object.defineProperty(PatchedSharedWorker, 'name', { value: 'SharedWorker' });
    } catch(e) {}
    try {
      Object.defineProperty(window, 'SharedWorker', { value: PatchedSharedWorker, writable: true, configurable: true });
    } catch(e) {}
  }
})();
`
}
