import type { FingerprintConfig } from '../../shared/types'

// 5 built-in fingerprint presets for MVP
export const FINGERPRINT_PRESETS: Record<string, FingerprintConfig> = {
  'win10-chrome120': {
    preset: 'win10-chrome120',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['en-US', 'en']
    },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelRatio: 1
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer:
        'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
        'Consolas', 'Courier New', 'Georgia', 'Impact', 'Segoe UI',
        'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  },

  'win11-chrome121': {
    preset: 'win11-chrome121',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '121',
      languages: ['en-US', 'en']
    },
    screen: {
      width: 2560,
      height: 1440,
      availWidth: 2560,
      availHeight: 1400,
      colorDepth: 24,
      pixelRatio: 1
    },
    hardware: { deviceMemory: 16, hardwareConcurrency: 12, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Chicago' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
        'Consolas', 'Courier New', 'Georgia', 'Impact', 'Segoe UI',
        'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 2, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  },

  'mac-ventura-chrome120': {
    preset: 'mac-ventura-chrome120',
    os: { platform: 'MacIntel', version: '13.6.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['en-US', 'en']
    },
    screen: {
      width: 1440,
      height: 900,
      availWidth: 1440,
      availHeight: 862,
      colorDepth: 30,
      pixelRatio: 2
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Los_Angeles' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Arial Black', 'Courier New', 'Georgia', 'Helvetica',
        'Helvetica Neue', 'Impact', 'Monaco', 'Optima', 'Times New Roman',
        'Trebuchet MS', 'Verdana'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 0 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  },

  'mac-sonoma-chrome121': {
    preset: 'mac-sonoma-chrome121',
    os: { platform: 'MacIntel', version: '14.2.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      version: '121',
      languages: ['en-US', 'en']
    },
    screen: {
      width: 1512,
      height: 982,
      availWidth: 1512,
      availHeight: 944,
      colorDepth: 30,
      pixelRatio: 2
    },
    hardware: { deviceMemory: 16, hardwareConcurrency: 10, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Los_Angeles' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (Apple)',
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Arial Black', 'Courier New', 'Georgia', 'Helvetica',
        'Helvetica Neue', 'Impact', 'Monaco', 'Optima', 'San Francisco',
        'Times New Roman', 'Trebuchet MS', 'Verdana'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  },

  'linux-ubuntu-chrome120': {
    preset: 'linux-ubuntu-chrome120',
    os: { platform: 'Linux x86_64', version: '5.15.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Linux x86_64',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['en-US', 'en']
    },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1054,
      colorDepth: 24,
      pixelRatio: 1
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'Europe/London' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Mesa/X.org',
      renderer: 'Mesa Intel(R) UHD Graphics 630 (CML GT2)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Courier New', 'DejaVu Sans', 'DejaVu Serif',
        'FreeMono', 'FreeSans', 'FreeSerif', 'Georgia', 'Liberation Mono',
        'Liberation Sans', 'Liberation Serif', 'Times New Roman', 'Verdana'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 0 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  },

  // ── Phase 4: Mobile Presets (Android Chrome — SEA market) ──────────────

  'android-samsung-chrome120': {
    preset: 'android-samsung-chrome120',
    os: { platform: 'Linux armv8l', version: '13.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['vi-VN', 'en-US', 'en']
    },
    screen: {
      width: 412,
      height: 915,
      availWidth: 412,
      availHeight: 883,
      colorDepth: 24,
      pixelRatio: 2.625
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 5 },
    locale: { language: 'vi-VN', languages: ['vi-VN', 'en-US', 'en'], timezone: 'Asia/Ho_Chi_Minh' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Qualcomm',
      renderer: 'Adreno (TM) 619',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Roboto', 'Droid Sans', 'Noto Sans', 'Noto Color Emoji',
        'Droid Serif', 'Noto Serif', 'Courier New'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  'android-pixel-chrome121': {
    preset: 'android-pixel-chrome121',
    os: { platform: 'Linux armv8l', version: '14.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.143 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '121',
      languages: ['th-TH', 'en-US', 'en']
    },
    screen: {
      width: 412,
      height: 915,
      availWidth: 412,
      availHeight: 891,
      colorDepth: 24,
      pixelRatio: 2.625
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 5 },
    locale: { language: 'th-TH', languages: ['th-TH', 'en-US', 'en'], timezone: 'Asia/Bangkok' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (ARM)',
      renderer: 'ANGLE (ARM, Mali-G710 MC10, OpenGL ES 3.2)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Roboto', 'Noto Sans', 'Noto Sans Thai', 'Noto Color Emoji',
        'Droid Sans', 'Droid Serif', 'Courier New'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  'android-oppo-chrome120': {
    preset: 'android-oppo-chrome120',
    os: { platform: 'Linux armv8l', version: '13.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; CPH2385) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['id-ID', 'en-US', 'en']
    },
    screen: {
      width: 393,
      height: 873,
      availWidth: 393,
      availHeight: 845,
      colorDepth: 24,
      pixelRatio: 2.75
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 5 },
    locale: { language: 'id-ID', languages: ['id-ID', 'en-US', 'en'], timezone: 'Asia/Jakarta' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Qualcomm',
      renderer: 'Adreno (TM) 730',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Roboto', 'Noto Sans', 'Noto Color Emoji',
        'Droid Sans', 'Droid Serif', 'Courier New'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  }
}

export type PresetKey = keyof typeof FINGERPRINT_PRESETS

/** Deep clone a preset and assign a deterministic noise seed based on profileId */
export function resolveFingerprint(
  presetKey: string,
  profileId: string
): FingerprintConfig {
  const base = FINGERPRINT_PRESETS[presetKey] ?? FINGERPRINT_PRESETS['win10-chrome120']
  const clone = JSON.parse(JSON.stringify(base)) as FingerprintConfig
  // Derive deterministic seed from profileId so same profile = same fingerprint
  const seed = hashCode(profileId)
  clone.canvas.noiseSeed = seed
  clone.webgl.noiseSeed = seed
  clone.audio.noiseSeed = seed
  clone.preset = presetKey
  return clone
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0
  }
  return h
}
