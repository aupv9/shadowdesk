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
      this.patchConsoleDebug()
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
