import type { BrowserConfig, HardwareConfig, ScreenConfig, MediaConfig } from '../../../shared/types'

/** Generate navigator override script */
export function buildNavigatorScript(
  browser: BrowserConfig,
  hardware: HardwareConfig,
  screen: ScreenConfig,
  media: MediaConfig
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
    const _orig = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices = async () => {
      const devices = [];
      for (let i = 0; i < ${media.audioInputs}; i++) {
        devices.push({ kind: 'audioinput',  label: '', deviceId: 'default', groupId: 'default' });
      }
      for (let i = 0; i < ${media.audioOutputs}; i++) {
        devices.push({ kind: 'audiooutput', label: '', deviceId: 'default', groupId: 'default' });
      }
      for (let i = 0; i < ${media.videoInputs}; i++) {
        devices.push({ kind: 'videoinput',  label: '', deviceId: 'default', groupId: 'default' });
      }
      return devices;
    };
  }
})();
`
}
