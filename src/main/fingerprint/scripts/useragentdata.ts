import type { BrowserConfig, OsConfig } from '../../../../shared/types'

/**
 * Phase 8 — navigator.userAgentData (User-Agent Client Hints) spoofing.
 *
 * UACH is the replacement for navigator.userAgent.  Detection frameworks
 * call navigator.userAgentData.getHighEntropyValues() to get granular OS/CPU
 * details.  If these don't match the spoofed UA string, the mismatch is flagged.
 *
 * Full C++ patch: would intercept the Chromium UserAgentMetadata struct at the
 * RenderFrameHost level.  This JS shim covers the JS-accessible UACH surface.
 */
export function buildUserAgentDataScript(browser: BrowserConfig, os: OsConfig): string {
  const { platform, brands, mobile, uaPlatformVersion, uaArchitecture, uaModel } =
    deriveUACH(browser, os)

  return `
(function() {
  'use strict';

  if (!('userAgentData' in navigator)) return;

  var BRANDS = ${JSON.stringify(brands)};
  var PLATFORM = ${JSON.stringify(platform)};
  var MOBILE = ${mobile};
  var PLATFORM_VERSION = ${JSON.stringify(uaPlatformVersion)};
  var ARCHITECTURE = ${JSON.stringify(uaArchitecture)};
  var MODEL = ${JSON.stringify(uaModel)};
  var FULL_VERSION = ${JSON.stringify(browser.version + '.0.0.0')};
  var BRANDS_WITH_VERSION = ${JSON.stringify(brands.map(b => ({ ...b, version: browser.version + '.0.0.0' })))};

  var uadStub = {
    brands: BRANDS,
    mobile: MOBILE,
    platform: PLATFORM,
    getHighEntropyValues: function(hints) {
      var result = {
        brands: BRANDS,
        mobile: MOBILE,
        platform: PLATFORM
      };
      if (!hints || !hints.length) return Promise.resolve(result);
      if (hints.indexOf('platformVersion')  !== -1) result.platformVersion  = PLATFORM_VERSION;
      if (hints.indexOf('architecture')     !== -1) result.architecture     = ARCHITECTURE;
      if (hints.indexOf('model')            !== -1) result.model            = MODEL;
      if (hints.indexOf('uaFullVersion')    !== -1) result.uaFullVersion    = FULL_VERSION;
      if (hints.indexOf('fullVersionList')  !== -1) result.fullVersionList  = BRANDS_WITH_VERSION;
      if (hints.indexOf('wow64')            !== -1) result.wow64            = false;
      if (hints.indexOf('bitness')          !== -1) result.bitness          = '64';
      return Promise.resolve(result);
    },
    toJSON: function() {
      return { brands: BRANDS, mobile: MOBILE, platform: PLATFORM };
    }
  };

  try {
    Object.defineProperty(navigator, 'userAgentData', {
      get: function() { return uadStub; },
      configurable: true,
      enumerable: true
    });
  } catch(e) {}
})();
`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface UACHData {
  platform: string
  brands: Array<{ brand: string; version: string }>
  mobile: boolean
  uaPlatformVersion: string
  uaArchitecture: string
  uaModel: string
}

function deriveUACH(browser: BrowserConfig, os: OsConfig): UACHData {
  const version = browser.version          // e.g. "120"
  const major   = parseInt(version, 10)

  // Build realistic brand list (Chromium + Not)A(Brand + actual brand)
  const brands: UACHData['brands'] = [
    { brand: 'Not/A)Brand',      version: '8' },
    { brand: 'Chromium',         version: version },
    { brand: 'Google Chrome',    version: version }
  ]

  // Platform detection from OS platform string
  let platform           = 'Windows'
  let uaPlatformVersion  = '10.0.0'
  let uaArchitecture     = 'x86'
  let uaModel            = ''
  let mobile             = false

  const plat = os.platform
  if (plat === 'Win32') {
    platform          = 'Windows'
    uaPlatformVersion = os.version?.startsWith('11') ? '15.0.0' : '10.0.0'
    uaArchitecture    = 'x86'
  } else if (plat === 'MacIntel') {
    platform          = 'macOS'
    uaPlatformVersion = os.version ?? '14.0.0'
    // M1/M2 use arm
    uaArchitecture    = browser.userAgent.includes('AppleWebKit') && major >= 120 ? 'arm' : 'x86'
  } else if (plat.startsWith('Linux')) {
    platform          = 'Linux'
    uaPlatformVersion = '6.8.0'
    uaArchitecture    = 'x86'
    if (plat === 'Linux armv8l') {
      mobile        = true
      uaArchitecture = 'arm'
    }
  } else if (plat === 'iPhone' || plat === 'iPad') {
    // iOS — userAgentData is not available on Safari, so this is Chrome on iOS
    platform          = 'iOS'
    uaPlatformVersion = os.version ?? '17.0.0'
    uaArchitecture    = 'arm'
    mobile            = plat === 'iPhone'
    uaModel           = plat === 'iPhone' ? 'iPhone' : 'iPad'
  }

  return { platform, brands, mobile, uaPlatformVersion, uaArchitecture, uaModel }
}
