import type { BrowserConfig, HardwareConfig, ScreenConfig, MediaConfig } from '../../../shared/types'

/** Generate navigator override script */
export function buildNavigatorScript(
  browser: BrowserConfig,
  hardware: HardwareConfig,
  screen: ScreenConfig,
  media: MediaConfig,
  noiseSeed: number = 0
): string {
  return `
(function() {
  'use strict';

  const _chrome = window.chrome;

  // ── User-Agent & Platform ──────────────────────────────────────────────────
  Object.defineProperty(navigator, 'userAgent', {
    get: () => ${JSON.stringify(browser.userAgent)},
    configurable: true
  });
  Object.defineProperty(navigator, 'platform', {
    get: () => ${JSON.stringify(browser.platform)},
    configurable: true
  });
  Object.defineProperty(navigator, 'vendor', {
    get: () => ${JSON.stringify(browser.vendor)},
    configurable: true
  });
  Object.defineProperty(navigator, 'language', {
    get: () => ${JSON.stringify(browser.languages[0])},
    configurable: true
  });
  Object.defineProperty(navigator, 'languages', {
    get: () => ${JSON.stringify(browser.languages)},
    configurable: true
  });

  // ── Hardware ──────────────────────────────────────────────────────────────
  Object.defineProperty(navigator, 'deviceMemory', {
    get: () => ${hardware.deviceMemory},
    configurable: true
  });
  Object.defineProperty(navigator, 'hardwareConcurrency', {
    get: () => ${hardware.hardwareConcurrency},
    configurable: true
  });
  Object.defineProperty(navigator, 'maxTouchPoints', {
    get: () => ${hardware.maxTouchPoints},
    configurable: true
  });

  // ── Screen ───────────────────────────────────────────────────────────────
  Object.defineProperty(screen, 'width',       { get: () => ${screen.width},       configurable: true });
  Object.defineProperty(screen, 'height',      { get: () => ${screen.height},      configurable: true });
  Object.defineProperty(screen, 'availWidth',  { get: () => ${screen.availWidth},  configurable: true });
  Object.defineProperty(screen, 'availHeight', { get: () => ${screen.availHeight}, configurable: true });
  Object.defineProperty(screen, 'colorDepth',  { get: () => ${screen.colorDepth},  configurable: true });
  Object.defineProperty(window, 'devicePixelRatio', { get: () => ${screen.pixelRatio}, configurable: true });

  // ── Automation flag removal ────────────────────────────────────────────────
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true
  });

  // ── Online status hardening ───────────────────────────────────────────────
  // Headless Chrome often reports onLine correctly, but some detection scripts
  // cross-check it against the WebRTC ICE state or network conditions.
  // Always report true and suppress offline events to avoid mismatches.
  Object.defineProperty(navigator, 'onLine', {
    get: () => true,
    configurable: true
  });
  // Intercept window offline events so they never fire during automation
  const _origAddEL = window.addEventListener.bind(window);
  window.addEventListener = function(type, listener, options) {
    if (type === 'offline') return;
    return _origAddEL(type, listener, options);
  };

  // ── Battery API ───────────────────────────────────────────────────────────
  if (navigator.getBattery) {
    navigator.getBattery = () => Promise.resolve({
      charging: true,
      chargingTime: 0,
      dischargingTime: Infinity,
      level: 1.0,
      addEventListener: () => {},
      removeEventListener: () => {}
    });
  }

  // ── Media Devices ─────────────────────────────────────────────────────────
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    // Deterministic 64-char hex ID generator — stable per profile (seeded from noiseSeed)
    const _s = ${noiseSeed} >>> 0;
    function _genId(n) {
      let h = (_s ^ 0x12345678) + Math.imul(n, 0x9e3779b9);
      let id = '';
      for (let i = 0; i < 8; i++) {
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
        h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
        h ^= h >>> 16;
        id += (h >>> 0).toString(16).padStart(8, '0');
      }
      return id;
    }
    // audioinput[0] and audiooutput[0] share a groupId — they are the system default device
    const _defaultGroup = _genId(0xf00d);
    navigator.mediaDevices.enumerateDevices = async () => {
      const devices = [];
      for (let i = 0; i < ${media.audioInputs}; i++) {
        devices.push({
          kind: 'audioinput', label: '',
          deviceId: i === 0 ? 'default' : _genId(10 + i),
          groupId:  i === 0 ? _defaultGroup : _genId(110 + i)
        });
      }
      for (let i = 0; i < ${media.audioOutputs}; i++) {
        devices.push({
          kind: 'audiooutput', label: '',
          deviceId: i === 0 ? 'default' : _genId(20 + i),
          groupId:  i === 0 ? _defaultGroup : _genId(120 + i)
        });
      }
      for (let i = 0; i < ${media.videoInputs}; i++) {
        devices.push({
          kind: 'videoinput', label: '',
          deviceId: _genId(30 + i),
          groupId:  _genId(130 + i)
        });
      }
      return devices;
    };
  }
})();
`
}
