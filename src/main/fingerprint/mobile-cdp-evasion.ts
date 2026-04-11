/**
 * Phase 18: Mobile CDP Evasion
 *
 * Advanced layer 2 evasion specifically for mobile automation detection.
 * Hides WebDriver, automation traces, and anti-bot signals on mobile.
 *
 * Detections to evade:
 * 1. window.webdriver flag (standard detection)
 * 2. navigator.userAgentData mismatch
 * 3. CDP message handler traces
 * 4. Chrome Remote Debugging Protocol markers
 * 5. navigator.plugins/mimetypes emptiness
 * 6. Unusual console behavior
 */

export function buildMobileCdpEvasionScript(): string {
  return `
    (function() {
      // Phase 18.1: Hide webdriver flag
      Object.defineProperty(navigator, 'webdriver', {
        get() { return false; },
        configurable: true
      });

      // Phase 18.2: Hide automation markers in userAgent
      const originalUserAgent = navigator.userAgent;
      Object.defineProperty(navigator, 'userAgent', {
        get() {
          return originalUserAgent.replace(/HeadlessChrome/, 'Chrome')
                                 .replace(/WebDriver/, '')
                                 .replace(/\\bPhantom\\b/, '');
        },
        configurable: true
      });

      // Phase 18.3: Mock userAgentData (Chrome sends this)
      if (!navigator.userAgentData) {
        Object.defineProperty(navigator, 'userAgentData', {
          value: {
            platform: 'Android',
            platformVersion: '13',
            mobile: true,
            model: 'SM-A540F',
            brands: [
              { brand: 'Samsung', version: '120' },
              { brand: 'Chrome', version: '120' }
            ],
            getHighEntropyValues: async () => ({
              platform: 'Android',
              platformVersion: '13',
              architecture: 'arm64',
              model: 'SM-A540F',
              mobile: true
            })
          },
          configurable: true,
          writable: false
        });
      }

      // Phase 18.4: Hide chrome object runtime checks
      // Some sites check for chrome.runtime.id or chrome.webstore.onInstallStageChanged
      if (typeof chrome === 'undefined') {
        window.chrome = {
          runtime: {
            id: 'dummyid',
            getManifest: () => null,
            connect: () => ({
              postMessage: () => {},
              disconnect: () => {},
              onMessage: { addListener: () => {}, removeListener: () => {} },
              onDisconnect: { addListener: () => {}, removeListener: () => {} }
            }),
            sendMessage: () => {},
            onMessage: { addListener: () => {}, removeListener: () => {} },
            onConnect: { addListener: () => {}, removeListener: () => {} }
          },
          webstore: {
            onInstallStageChanged: { addListener: () => {} },
            install: () => {}
          }
        };
      }

      // Phase 18.5: Proxy console methods to hide CDP debugger messages
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      console.log = function(...args) {
        const msg = args[0]?.toString?.() ?? '';
        // Filter out CDP/WebDriver messages
        if (!msg.includes('DevTools') && !msg.includes('webdriver') &&
            !msg.includes('Chrome Remote Debugging')) {
          originalLog.apply(console, args);
        }
      };

      console.warn = function(...args) {
        const msg = args[0]?.toString?.() ?? '';
        if (!msg.includes('DevTools') && !msg.includes('webdriver')) {
          originalWarn.apply(console, args);
        }
      };

      console.error = function(...args) {
        const msg = args[0]?.toString?.() ?? '';
        if (!msg.includes('DevTools') && !msg.includes('webdriver')) {
          originalError.apply(console, args);
        }
      };

      // Phase 18.6: Override toString on functions to hide WebDriver references
      const originalFunctionToString = Function.prototype.toString;
      Function.prototype.toString = function() {
        const str = originalFunctionToString.call(this);
        return str.replace(/\\[native code\\]/g, '[native code]')
                  .replace(/webdriver/gi, 'window')
                  .replace(/HeadlessChrome/g, 'Chrome');
      };

      // Phase 18.7: Hide CDP Session markers
      if (window.__CODESHOT) {
        delete window.__CODESHOT;
      }

      // Phase 18.8: Spoof plugins array (some sites check for Chrome extensions)
      // Note: On actual mobile, plugins is empty anyway
      Object.defineProperty(navigator, 'plugins', {
        get() { return []; },
        configurable: true
      });

      // Phase 18.9: Ensure requestIdleCallback uses realistic timing on mobile
      if (!window.requestIdleCallback) {
        window.requestIdleCallback = function(callback, options) {
          const timeout = (options?.timeout ?? 1000) + Math.random() * 500;
          return setTimeout(() => {
            const deadline = {
              timeRemaining: () => Math.max(0, timeout - (Date.now() % timeout)),
              didTimeout: false
            };
            callback(deadline);
          }, timeout);
        };
      }

      // Phase 18.10: Hide __$webdriverType in stack traces
      const originalError = Error;
      window.Error = function(message) {
        const err = new originalError(message);
        if (err.stack) {
          err.stack = err.stack.replace(/\\$webdriver/gi, '');
        }
        return err;
      };
    })();
  `
}

/**
 * Additional CDP evasions to apply at protocol level.
 */
export function getMobileCdpOverrides(): Record<string, any> {
  return {
    // Disable automation features that leak WebDriver
    'Page.addScriptToEvaluateOnNewDocument': {
      // Scripts already handled above
    },
    // Override user agent at CDP level
    'Network.setUserAgentOverride': {
      userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A540F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      platform: 'Android',
      userAgentMetadata: {
        platform: 'Android',
        platformVersion: '13',
        architecture: 'arm64',
        model: 'SM-A540F',
        mobile: true,
        brands: [
          { brand: 'Samsung', version: '120' },
          { brand: 'Chrome', version: '120' }
        ]
      }
    },
    // Spoof touch capability
    'Input.setIgnoreInputEvents': false,
    // Enable touch
    'Emulation.setDeviceMetricsOverride': {
      mobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
      width: 375,
      height: 812,
      screenWidth: 375,
      screenHeight: 812
    }
  }
}

/**
 * Stack trace sanitization — remove WebDriver references.
 */
export function sanitizeStackTrace(stack: string): string {
  return stack
    .replace(/\\$webdriver/gi, '')
    .replace(/WebDriver/gi, 'Window')
    .replace(/HeadlessChrome/g, 'Chrome')
    .replace(/\\(unknown source\\)/g, '(native)')
    .split('\\n')
    .filter((line) => {
      // Filter out Chrome DevTools frames
      return !line.includes('devtools') &&
             !line.includes('webdriver') &&
             !line.includes('Chrome Remote Debugging');
    })
    .join('\\n');
}
