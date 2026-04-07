import type { Page } from 'puppeteer-core'

/**
 * Advanced CDP evasion — hides DevTools Protocol artifacts and automation
 * traces that bot-detection frameworks (CreepJS, BotD, DataDome) look for.
 */
export class CdpEvasion {
  /**
   * Apply all CDP-level evasion patches to a page.
   * Must be called BEFORE page navigates to content.
   */
  async apply(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(this.buildEvasionScript())

    // Remove Runtime.enable artifacts via CDP
    const session = await page.createCDPSession()
    try {
      // Disable the automation-controlled info bar
      await session.send('Page.setBypassCSP', { enabled: true }).catch(() => {})
      // Remove debugger domain artifacts
      await session.send('Runtime.setMaxCallStackSizeToCapture', { size: 0 }).catch(() => {})
      // Phase 8: disable Runtime domain features that expose automation context
      await session.send('Runtime.setCustomObjectFormatterEnabled', { enabled: false }).catch(() => {})
    } finally {
      await session.detach()
    }
  }

  private buildEvasionScript(): string {
    return [
      this.hideChromeDriver(),
      this.patchChromeRuntime(),
      this.hideSourceUrl(),
      this.patchPermissionsApi(),
      this.patchIframeContentWindow(),
      this.hideStackTraces(),
      this.patchHeadlessSignals(),
      this.patchConsoleDebug(),
      // Phase 6: new evasion layers
      this.patchObjectDefinePropertyTrap(),
      this.patchWorkerNavigator(),
      this.maskBlinkInternals(),
      // Phase 8: deep evasion
      this.patchMathFpu(),
      this.patchProtoChains(),
      this.patchMediaCapabilities(),
      this.patchTrustTokens()
    ].join('\n;\n')
  }

  /** Remove window.cdc_*, window.__cdc_* ChromeDriver artifacts */
  private hideChromeDriver(): string {
    return `
(function() {
  'use strict';
  // ChromeDriver leaves cdc_ prefixed variables on window
  const handler = {
    has: (target, key) => {
      if (typeof key === 'string' && (key.startsWith('cdc_') || key.startsWith('__cdc_'))) {
        return false;
      }
      return key in target;
    },
    get: (target, key) => {
      if (typeof key === 'string' && (key.startsWith('cdc_') || key.startsWith('__cdc_'))) {
        return undefined;
      }
      const val = Reflect.get(target, key);
      return typeof val === 'function' ? val.bind(target) : val;
    },
    getOwnPropertyDescriptor: (target, key) => {
      if (typeof key === 'string' && (key.startsWith('cdc_') || key.startsWith('__cdc_'))) {
        return undefined;
      }
      return Object.getOwnPropertyDescriptor(target, key);
    }
  };

  // Delete any existing cdc_ vars before page scripts run
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key.startsWith('cdc_') || key.startsWith('__cdc_')) {
      try { delete window[key]; } catch {}
    }
  }
})();
`
  }

  /** Patch window.chrome to look like a real Chrome browser */
  private patchChromeRuntime(): string {
    return `
(function() {
  'use strict';

  // Ensure window.chrome exists with correct shape
  if (!window.chrome) {
    window.chrome = {};
  }

  // chrome.runtime must exist but sendMessage should throw a specific error
  if (!window.chrome.runtime) {
    window.chrome.runtime = {
      connect: function() { throw new Error('Could not establish connection. Receiving end does not exist.'); },
      sendMessage: function() { throw new Error('Could not establish connection. Receiving end does not exist.'); },
      get id() { return undefined; }
    };
  }

  // chrome.loadTimes — deprecated but detection scripts check it exists
  if (!window.chrome.loadTimes) {
    window.chrome.loadTimes = function() {
      return {
        commitLoadTime: Date.now() / 1000,
        connectionInfo: 'h2',
        finishDocumentLoadTime: Date.now() / 1000 + 0.1,
        finishLoadTime: Date.now() / 1000 + 0.2,
        firstPaintAfterLoadTime: 0,
        firstPaintTime: Date.now() / 1000 + 0.05,
        navigationType: 'Other',
        npnNegotiatedProtocol: 'h2',
        requestTime: Date.now() / 1000 - 0.5,
        startLoadTime: Date.now() / 1000 - 0.3,
        wasAlternateProtocolAvailable: false,
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true
      };
    };
  }

  // chrome.csi — also checked by detection scripts
  if (!window.chrome.csi) {
    window.chrome.csi = function() {
      return {
        onloadT: Date.now(),
        pageT: performance.now(),
        startE: Date.now() - performance.now(),
        tran: 15
      };
    };
  }

  // chrome.app — minimal stub
  if (!window.chrome.app) {
    window.chrome.app = {
      isInstalled: false,
      InstallState: { INSTALLED: 'installed', NOT_INSTALLED: 'not_installed', DISABLED: 'disabled' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
      getDetails: function() { return null; },
      getIsInstalled: function() { return false; }
    };
  }

  // Make chrome properties non-writable to match real Chrome
  try {
    Object.defineProperty(window, 'chrome', {
      value: window.chrome,
      writable: false,
      configurable: false,
      enumerable: true
    });
  } catch {}
})();
`
  }

  /** Hide evaluateOnNewDocument sourceURL leaks in Error stacks */
  private hideSourceUrl(): string {
    return `
(function() {
  'use strict';

  // Puppeteer tags injected scripts with __puppeteer_evaluation_script__
  // Override Error.prepareStackTrace to strip these references
  const origPrepare = Error.prepareStackTrace;
  Error.prepareStackTrace = function(error, stack) {
    const filtered = stack.filter(frame => {
      const fileName = frame.getFileName() || '';
      return !fileName.includes('__puppeteer_evaluation_script__') &&
             !fileName.includes('pptr:') &&
             !fileName.includes('__playwright_evaluation_script__');
    });
    if (origPrepare) {
      return origPrepare(error, filtered);
    }
    return error.toString() + '\\n' + filtered.map(f => '    at ' + f.toString()).join('\\n');
  };
})();
`
  }

  /** Patch Permissions API to return consistent results like a real browser */
  private patchPermissionsApi(): string {
    return `
(function() {
  'use strict';

  if (!navigator.permissions || !navigator.permissions.query) return;

  const origQuery = navigator.permissions.query.bind(navigator.permissions);

  // Real Chrome returns 'prompt' for notifications on fresh profiles
  const PERMISSION_DEFAULTS = {
    'geolocation': 'prompt',
    'notifications': 'prompt',
    'push': 'prompt',
    'midi': 'granted',
    'camera': 'prompt',
    'microphone': 'prompt',
    'background-fetch': 'granted',
    'background-sync': 'granted',
    'persistent-storage': 'prompt',
    'ambient-light-sensor': 'granted',
    'accelerometer': 'granted',
    'gyroscope': 'granted',
    'magnetometer': 'granted',
    'screen-wake-lock': 'granted',
    'clipboard-read': 'prompt',
    'clipboard-write': 'granted',
    'payment-handler': 'granted',
    'idle-detection': 'prompt',
    'storage-access': 'prompt',
    'window-management': 'prompt',
    'local-fonts': 'prompt'
  };

  navigator.permissions.query = function(descriptor) {
    const name = descriptor && descriptor.name;
    if (name && PERMISSION_DEFAULTS[name]) {
      return Promise.resolve({
        state: PERMISSION_DEFAULTS[name],
        name: name,
        onchange: null,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      });
    }
    return origQuery(descriptor);
  };
})();
`
  }

  /** Patch iframe contentWindow to prevent cross-origin detection tricks */
  private patchIframeContentWindow(): string {
    return `
(function() {
  'use strict';

  // Bot detectors create iframes and check if properties are consistent
  // between the main window and iframe contentWindow
  const origCreateElement = document.createElement.bind(document);
  const origAppendChild = Element.prototype.appendChild;

  // Ensure iframes inherit our overrides
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeName === 'IFRAME' && node.contentWindow) {
          try {
            // Copy navigator overrides to iframe
            const iframeNav = node.contentWindow.navigator;
            const mainNav = window.navigator;
            Object.defineProperty(iframeNav, 'webdriver', {
              get: () => undefined,
              configurable: true
            });
          } catch {}
        }
      }
    }
  });

  observer.observe(document.documentElement || document.body || document, {
    childList: true,
    subtree: true
  });
})();
`
  }

  /** Sanitize Error stack traces to remove automation framework references */
  private hideStackTraces(): string {
    return `
(function() {
  'use strict';

  const origStackDesc = Object.getOwnPropertyDescriptor(Error.prototype, 'stack');
  if (!origStackDesc || !origStackDesc.get) return;

  const origGet = origStackDesc.get;

  Object.defineProperty(Error.prototype, 'stack', {
    get: function() {
      const stack = origGet.call(this);
      if (typeof stack !== 'string') return stack;
      return stack
        .split('\\n')
        .filter(line =>
          !line.includes('__puppeteer_evaluation_script__') &&
          !line.includes('pptr:') &&
          !line.includes('__playwright_evaluation_script__') &&
          !line.includes('DevTools')
        )
        .join('\\n');
    },
    set: function(value) {
      Object.defineProperty(this, 'stack', {
        value: value,
        writable: true,
        configurable: true
      });
    },
    configurable: true
  });
})();
`
  }

  /** Hide headless browser signals */
  private patchHeadlessSignals(): string {
    return `
(function() {
  'use strict';

  // Headless Chrome has different values for these
  Object.defineProperty(navigator, 'plugins', {
    get: function() {
      // If already spoofed by plugins.ts, return existing value
      const existing = Object.getOwnPropertyDescriptor(Navigator.prototype, 'plugins');
      if (existing && existing.get) return existing.get.call(this);

      // Minimal non-empty plugin list for detection avoidance
      return navigator.plugins;
    },
    configurable: true
  });

  // Notification.permission — headless always returns 'denied'
  if (typeof Notification !== 'undefined') {
    Object.defineProperty(Notification, 'permission', {
      get: () => 'default',
      configurable: true
    });
  }

  // window.outerWidth/outerHeight — headless can have 0 values
  if (window.outerWidth === 0) {
    Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth, configurable: true });
  }
  if (window.outerHeight === 0) {
    Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + 85, configurable: true });
  }
})();
`
  }

  // ── Phase 6 methods ────────────────────────────────────────────────────────

  /**
   * Object.defineProperty trap detection evasion.
   * Some advanced detectors call Object.getOwnPropertyDescriptor on navigator
   * before and after our injection to detect property patching. We make our
   * overrides look like built-in Blink properties by rewriting the descriptor
   * metadata so configurable/enumerable/writable flags match Chrome norms.
   */
  private patchObjectDefinePropertyTrap(): string {
    return `
(function() {
  'use strict';

  // Intercept Object.getOwnPropertyDescriptor to normalise descriptor flags
  // for navigator properties that we override via defineProperty.
  var _origGetOPD = Object.getOwnPropertyDescriptor.bind(Object);
  Object.getOwnPropertyDescriptor = function getOwnPropertyDescriptor(obj, prop) {
    var desc = _origGetOPD(obj, prop);
    if (!desc) return desc;

    // Properties we override should look like native Blink properties:
    // configurable: true, enumerable: true (same as real Chrome)
    var navProps = new Set(['webdriver', 'platform', 'vendor', 'userAgent',
      'languages', 'language', 'plugins', 'hardwareConcurrency', 'deviceMemory',
      'connection', 'getBattery']);

    if (obj === Navigator.prototype || obj === navigator) {
      if (navProps.has(String(prop))) {
        return Object.assign({}, desc, { configurable: true, enumerable: true });
      }
    }
    return desc;
  };
  Object.defineProperty(Object.getOwnPropertyDescriptor, 'toString', {
    value: function() { return 'function getOwnPropertyDescriptor() { [native code] }'; },
    configurable: true
  });
})();
`
  }

  /**
   * Worker navigator.webdriver patch.
   * Puppeteer/CDP sets navigator.webdriver = true in both the main frame AND
   * in dedicated/shared worker contexts. Detection scripts can spawn a worker,
   * read navigator.webdriver inside it, and expose the automation even if the
   * main-frame value has been patched.
   * We override the Worker constructor to inject a patch into every spawned worker.
   */
  private patchWorkerNavigator(): string {
    return `
(function() {
  'use strict';

  if (typeof Worker === 'undefined') return;

  var _origWorker = Worker;

  // Blob URL containing the patch to inject at the top of every worker script
  var patchSrc = [
    '(function(){',
    '  try {',
    '    Object.defineProperty(navigator, "webdriver", {',
    '      get: function() { return undefined; },',
    '      configurable: true',
    '    });',
    '  } catch(e) {}',
    '})();'
  ].join('\\n');

  function Worker(scriptURL, options) {
    var blobPatch = new Blob([patchSrc], { type: 'application/javascript' });
    var patchUrl = URL.createObjectURL(blobPatch);
    // Chain the patch + real script via importScripts inside a wrapper blob
    var wrapperSrc = 'importScripts(' + JSON.stringify(patchUrl) + ');';
    if (typeof scriptURL === 'string') {
      wrapperSrc += '\\nimportScripts(' + JSON.stringify(scriptURL) + ');';
    }
    var wrapperBlob = new Blob([wrapperSrc], { type: 'application/javascript' });
    var wrapperUrl = URL.createObjectURL(wrapperBlob);
    return new _origWorker(wrapperUrl, options);
  }
  Worker.prototype = _origWorker.prototype;

  try {
    window.Worker = Worker;
    Object.defineProperty(Worker, 'toString', {
      value: function() { return 'function Worker() { [native code] }'; }
    });
  } catch(e) {}
})();
`
  }

  /**
   * Mask Blink-specific internal properties that headless Chrome exposes but
   * real desktop Chrome does not (or exposes differently).
   * Targets: document.$cdc_*, window.__selenium_*, runtime-injected markers.
   */
  private maskBlinkInternals(): string {
    return `
(function() {
  'use strict';

  // Properties that real Chrome does NOT expose on document/window but headless can
  var MASK = [
    '__selenium_evaluate', '__selenium_unwrapped', '__webdriver_evaluate',
    '__webdriver_script_function', '__webdriver_script_func',
    '__webdriver_script_element', '__fxdriver_evaluate', '__fxdriver_unwrapped',
    '_Selenium_IDE_Recorder', '_selenium', 'calledSelenium',
    '$chrome_asyncScriptInfo', '$cdc_asdjflasutopfhvcZLmcfl_'
  ];

  var handler = {
    has: function(target, key) {
      if (MASK.indexOf(String(key)) !== -1) return false;
      return key in target;
    },
    get: function(target, key, receiver) {
      if (MASK.indexOf(String(key)) !== -1) return undefined;
      return Reflect.get(target, key, receiver);
    },
    getOwnPropertyDescriptor: function(target, key) {
      if (MASK.indexOf(String(key)) !== -1) return undefined;
      return Object.getOwnPropertyDescriptor(target, key);
    }
  };

  // Delete any existing leak before wrapping
  MASK.forEach(function(key) {
    try { delete window[key]; } catch(e) {}
    try { delete document[key]; } catch(e) {}
  });

  // Wrap window in a Proxy to intercept future access (best-effort)
  try {
    var proxiedWindow = new Proxy(window, handler);
    // Can't reassign window itself, but we can ensure iframe windows are clean
    // by patching the getter on WindowProxy (handled by iframe patch above)
  } catch(e) {}
})();
`
  }

  // ── Phase 8 methods ────────────────────────────────────────────────────────

  /**
   * Math FPU determinism patch.
   * Some fingerprinters call Math.sin/cos/tan/atan2 on specific values and
   * compare results to a known table of values per CPU architecture.
   * We normalise the outputs to the expected x86 IEEE 754 results, hiding
   * differences introduced by ARM or other hosts running the Electron app.
   */
  private patchMathFpu(): string {
    return `
(function() {
  'use strict';

  // Known FPU-sensitive values: result of Math.sin(1) differs by ~1e-19 between
  // x86 and ARM. We pin to the x86 reference value.
  var FPU_TABLE = {
    'sin:1':          0.8414709848078965,
    'cos:1':          0.5403023058681398,
    'tan:1':          1.5574077246549023,
    'atan2:1:1':      0.7853981633974483,
    'sin:Math.PI':    1.2246467991473532e-16,
    'cos:Math.PI':    -1,
    'exp:1':          2.718281828459045,
    'log:Math.E':     1,
    'sqrt:2':         1.4142135623730951
  };

  var _origSin   = Math.sin.bind(Math);
  var _origCos   = Math.cos.bind(Math);
  var _origTan   = Math.tan.bind(Math);
  var _origAtan2 = Math.atan2.bind(Math);

  function makeNative(name, fn) {
    Object.defineProperty(fn, 'toString', {
      value: function() { return 'function ' + name + '() { [native code] }'; },
      configurable: true
    });
    return fn;
  }

  Math.sin = makeNative('sin', function sin(x) {
    if (x === 1) return FPU_TABLE['sin:1'];
    if (x === Math.PI) return FPU_TABLE['sin:Math.PI'];
    return _origSin(x);
  });

  Math.cos = makeNative('cos', function cos(x) {
    if (x === 1) return FPU_TABLE['cos:1'];
    if (x === Math.PI) return FPU_TABLE['cos:Math.PI'];
    return _origCos(x);
  });

  Math.tan = makeNative('tan', function tan(x) {
    if (x === 1) return FPU_TABLE['tan:1'];
    return _origTan(x);
  });

  Math.atan2 = makeNative('atan2', function atan2(y, x) {
    if (y === 1 && x === 1) return FPU_TABLE['atan2:1:1'];
    return _origAtan2(y, x);
  });
})();
`
  }

  /**
   * Prototype chain normalisation.
   * Some detectors enumerate the prototype chain of browser APIs and compare
   * the length / property descriptors to a known-good Chrome fingerprint.
   * We ensure our patched functions sit correctly on the native prototype and
   * their [[Prototype]] chain is not unexpectedly extended.
   */
  private patchProtoChains(): string {
    return `
(function() {
  'use strict';

  // Ensure Function.prototype is not polluted with enumerable properties
  // (some automation frameworks accidentally add enumerable items here)
  var fpProto = Function.prototype;
  var keys = Object.getOwnPropertyNames(fpProto);
  var ALLOWED = new Set([
    'length','name','constructor','apply','bind','call','toString',
    'arguments','caller','hasOwnProperty','isPrototypeOf',
    'propertyIsEnumerable','toLocaleString','valueOf'
  ]);

  keys.forEach(function(k) {
    if (!ALLOWED.has(k)) {
      var desc = Object.getOwnPropertyDescriptor(fpProto, k);
      if (desc && desc.enumerable) {
        try {
          Object.defineProperty(fpProto, k, Object.assign({}, desc, { enumerable: false }));
        } catch(e) {}
      }
    }
  });

  // Ensure Object.prototype is clean
  var opProto = Object.prototype;
  Object.getOwnPropertyNames(opProto).forEach(function(k) {
    var ALLOWED_OP = new Set([
      '__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__',
      '__proto__','constructor','hasOwnProperty','isPrototypeOf',
      'propertyIsEnumerable','toLocaleString','toString','valueOf'
    ]);
    if (!ALLOWED_OP.has(k)) {
      var desc = Object.getOwnPropertyDescriptor(opProto, k);
      if (desc && desc.enumerable) {
        try {
          Object.defineProperty(opProto, k, Object.assign({}, desc, { enumerable: false }));
        } catch(e) {}
      }
    }
  });
})();
`
  }

  /**
   * MediaCapabilities API normalisation.
   * navigator.mediaCapabilities.decodingInfo() returns hardware decoding
   * capabilities that differ between headless and real Chrome.  We normalise
   * the response to always indicate hardware-accelerated smooth playback.
   */
  private patchMediaCapabilities(): string {
    return `
(function() {
  'use strict';

  if (!navigator.mediaCapabilities || !navigator.mediaCapabilities.decodingInfo) return;

  var _origDecoding = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);

  navigator.mediaCapabilities.decodingInfo = function(config) {
    return _origDecoding(config).then(function(result) {
      // Always report smooth hardware-accelerated decoding
      return {
        supported:              true,
        smooth:                 true,
        powerEfficient:         true,
        configuration:          config
      };
    }).catch(function() {
      return { supported: true, smooth: true, powerEfficient: true, configuration: config };
    });
  };

  Object.defineProperty(navigator.mediaCapabilities.decodingInfo, 'toString', {
    value: function() { return 'function decodingInfo() { [native code] }'; },
    configurable: true
  });
})();
`
  }

  /**
   * Private State Tokens (Trust Tokens) API stub.
   * This API is used by some anti-bot services (Cloudflare, Google) to check
   * if the browser has trusted tokens issued by a verifier.  Headless Chrome
   * may expose a different surface than real Chrome.  We normalise the API
   * presence and ensure hasPrivateToken resolves consistently.
   */
  private patchTrustTokens(): string {
    return `
(function() {
  'use strict';

  // hasPrivateToken / hasRedemptionRecord — Chrome 101+
  if (!('hasPrivateToken' in document)) {
    Object.defineProperty(document, 'hasPrivateToken', {
      value: function(issuer) {
        return Promise.resolve(false);
      },
      writable: false,
      configurable: true,
      enumerable: true
    });
  }

  if (!('hasRedemptionRecord' in document)) {
    Object.defineProperty(document, 'hasRedemptionRecord', {
      value: function(issuer) {
        return Promise.resolve(false);
      },
      writable: false,
      configurable: true,
      enumerable: true
    });
  }
})();
`
  }

  /** Prevent console.debug leak detection */
  private patchConsoleDebug(): string {
    return `
(function() {
  'use strict';

  // Some detection scripts use console.debug timing to detect DevTools
  // Ensure toString of native functions looks correct
  const nativeToString = Function.prototype.toString;
  const origCall = Function.prototype.call;

  const customFunctions = new Set();

  const handler = {
    apply: function(target, thisArg, args) {
      // If this is one of our patched functions, return native-looking string
      if (customFunctions.has(thisArg)) {
        return 'function ' + (thisArg.name || '') + '() { [native code] }';
      }
      return origCall.apply(target, [thisArg, ...args]);
    }
  };

  // Wrap Function.prototype.toString
  const proxyToString = new Proxy(nativeToString, handler);
  Object.defineProperty(Function.prototype, 'toString', {
    value: proxyToString,
    writable: true,
    configurable: true
  });

  // Track our custom functions for toString masking
  window.__ghostRegisterNative = function(fn) {
    customFunctions.add(fn);
  };
})();
`
  }
}
