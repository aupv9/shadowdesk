import type { FingerprintConfig } from '../../shared/types'
import { applyAllVariance } from './property-variance'

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
    geolocation: { latitude: 10.8231, longitude: 106.6297, accuracy: 20 },
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
    geolocation: { latitude: 13.7563, longitude: 100.5018, accuracy: 20 },
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
    geolocation: { latitude: -6.2088, longitude: 106.8456, accuracy: 20 },
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
  },

  // ── Phase 5: iOS Mobile Presets (Safari — SEA market) ──────────────────

  'ios-iphone14-safari17': {
    preset: 'ios-iphone14-safari17',
    geolocation: { latitude: 10.8231, longitude: 106.6297, accuracy: 20 },
    os: { platform: 'iPhone', version: '17.2.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.',
      version: '17',
      languages: ['vi-VN', 'en-US', 'en']
    },
    screen: {
      width: 390,
      height: 844,
      availWidth: 390,
      availHeight: 844,
      colorDepth: 24,
      pixelRatio: 3
    },
    hardware: { deviceMemory: 4, hardwareConcurrency: 6, maxTouchPoints: 5 },
    locale: { language: 'vi-VN', languages: ['vi-VN', 'en-US', 'en'], timezone: 'Asia/Ho_Chi_Minh' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Apple Inc.',
      renderer: 'Apple GPU',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman',
        'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
  },

  'ios-iphone15-safari17': {
    preset: 'ios-iphone15-safari17',
    geolocation: { latitude: 13.7563, longitude: 100.5018, accuracy: 20 },
    os: { platform: 'iPhone', version: '17.3.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      vendor: 'Apple Computer, Inc.',
      version: '17',
      languages: ['th-TH', 'en-US', 'en']
    },
    screen: {
      width: 393,
      height: 852,
      availWidth: 393,
      availHeight: 852,
      colorDepth: 24,
      pixelRatio: 3
    },
    hardware: { deviceMemory: 4, hardwareConcurrency: 6, maxTouchPoints: 5 },
    locale: { language: 'th-TH', languages: ['th-TH', 'en-US', 'en'], timezone: 'Asia/Bangkok' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Apple Inc.',
      renderer: 'Apple GPU',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman',
        'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
  },

  'ios-ipad-safari17': {
    preset: 'ios-ipad-safari17',
    geolocation: { latitude: -6.2088, longitude: 106.8456, accuracy: 20 },
    os: { platform: 'iPad', version: '17.2.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      platform: 'iPad',
      vendor: 'Apple Computer, Inc.',
      version: '17',
      languages: ['id-ID', 'en-US', 'en']
    },
    screen: {
      width: 820,
      height: 1180,
      availWidth: 820,
      availHeight: 1180,
      colorDepth: 24,
      pixelRatio: 2
    },
    hardware: { deviceMemory: 4, hardwareConcurrency: 4, maxTouchPoints: 5 },
    locale: { language: 'id-ID', languages: ['id-ID', 'en-US', 'en'], timezone: 'Asia/Jakarta' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Apple Inc.',
      renderer: 'Apple GPU',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman',
        'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' },
    network: { connectionType: 'wifi' }
  },

  // ── SEA-Specific Presets (Vietnam, Thailand, Indonesia) ────────────────────

  'sea-vn-viettel-chrome120': {
    preset: 'sea-vn-viettel-chrome120',
    geolocation: { latitude: 21.0285, longitude: 105.8542, accuracy: 150 },
    os: { platform: 'Linux armv8l', version: '13.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['vi-VN', 'en-US', 'en']
    },
    screen: {
      width: 412,
      height: 892,
      availWidth: 412,
      availHeight: 860,
      colorDepth: 24,
      pixelRatio: 2.625
    },
    hardware: { deviceMemory: 4, hardwareConcurrency: 8, maxTouchPoints: 5 },
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
        'Roboto', 'Noto Sans', 'Noto Sans Vietnamese', 'Noto Color Emoji',
        'Droid Sans', 'Droid Serif', 'sans-serif', 'Courier New'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
  },

  'sea-vn-fpt-chrome121': {
    preset: 'sea-vn-fpt-chrome121',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '121',
      languages: ['vi-VN', 'en-US', 'en']
    },
    screen: {
      width: 1920,
      height: 1080,
      availWidth: 1920,
      availHeight: 1040,
      colorDepth: 24,
      pixelRatio: 1
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 4, maxTouchPoints: 0 },
    locale: { language: 'vi-VN', languages: ['vi-VN', 'en-US', 'en'], timezone: 'Asia/Ho_Chi_Minh' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Times New Roman', 'Tahoma', 'Segoe UI', 'Calibri',
        'Courier New', 'Verdana', 'Georgia', 'Trebuchet MS'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' },
    network: { connectionType: 'wifi' }
  },

  'sea-th-true-chrome120': {
    preset: 'sea-th-true-chrome120',
    geolocation: { latitude: 13.7563, longitude: 100.5018, accuracy: 150 },
    os: { platform: 'Linux armv8l', version: '13.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; SM-A346B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['th-TH', 'en-US', 'en']
    },
    screen: {
      width: 412,
      height: 892,
      availWidth: 412,
      availHeight: 860,
      colorDepth: 24,
      pixelRatio: 2.625
    },
    hardware: { deviceMemory: 4, hardwareConcurrency: 8, maxTouchPoints: 5 },
    locale: { language: 'th-TH', languages: ['th-TH', 'en-US', 'en'], timezone: 'Asia/Bangkok' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'ARM',
      renderer: 'Mali-G68',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Roboto', 'Noto Sans', 'Noto Sans Thai', 'Noto Color Emoji',
        'Droid Sans', 'Droid Serif', 'sans-serif', 'Courier New'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
  },

  'sea-th-desktop-chrome121': {
    preset: 'sea-th-desktop-chrome121',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '121',
      languages: ['th-TH', 'en-US', 'en']
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
    locale: { language: 'th-TH', languages: ['th-TH', 'en-US', 'en'], timezone: 'Asia/Bangkok' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Times New Roman', 'Tahoma', 'Segoe UI', 'Calibri',
        'Courier New', 'Verdana', 'Georgia', 'Leelawadee UI', 'Angsana New',
        'Cordia New', 'Trebuchet MS'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' },
    network: { connectionType: 'wifi' }
  },

  'sea-id-telkomsel-chrome120': {
    preset: 'sea-id-telkomsel-chrome120',
    geolocation: { latitude: -6.2088, longitude: 106.8456, accuracy: 150 },
    os: { platform: 'Linux armv8l', version: '12.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 12; CPH2385) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['id-ID', 'en-US', 'en']
    },
    screen: {
      width: 360,
      height: 806,
      availWidth: 360,
      availHeight: 774,
      colorDepth: 24,
      pixelRatio: 2
    },
    hardware: { deviceMemory: 4, hardwareConcurrency: 8, maxTouchPoints: 5 },
    locale: { language: 'id-ID', languages: ['id-ID', 'en-US', 'en'], timezone: 'Asia/Jakarta' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'ARM',
      renderer: 'Mali-G57',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Roboto', 'Noto Sans', 'Noto Color Emoji',
        'Droid Sans', 'Droid Serif', 'sans-serif', 'Courier New'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
  },

  'sea-id-desktop-chrome121': {
    preset: 'sea-id-desktop-chrome121',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '121',
      languages: ['id-ID', 'en-US', 'en']
    },
    screen: {
      width: 1366,
      height: 768,
      availWidth: 1366,
      availHeight: 728,
      colorDepth: 24,
      pixelRatio: 1
    },
    hardware: { deviceMemory: 4, hardwareConcurrency: 4, maxTouchPoints: 0 },
    locale: { language: 'id-ID', languages: ['id-ID', 'en-US', 'en'], timezone: 'Asia/Jakarta' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial', 'Times New Roman', 'Tahoma', 'Segoe UI', 'Calibri',
        'Courier New', 'Verdana', 'Georgia', 'Trebuchet MS'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' },
    network: { connectionType: 'wifi' }
  },

  // ── Phase 9: Chrome 124 Presets (fresh UA versions) ──────────────────────

  'win11-chrome124': {
    preset: 'win11-chrome124',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '124',
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
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
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

  'mac-sonoma-chrome124': {
    preset: 'mac-sonoma-chrome124',
    os: { platform: 'MacIntel', version: '14.4.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      version: '124',
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
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)',
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

  'android-pixel8-chrome124': {
    preset: 'android-pixel8-chrome124',
    geolocation: { latitude: 13.7563, longitude: 100.5018, accuracy: 20 },
    os: { platform: 'Linux armv8l', version: '14.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '124',
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
      renderer: 'ANGLE (ARM, Mali-G715 MC7, OpenGL ES 3.2)',
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
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
  },

  // ── P2: Safari Desktop Presets (macOS) ──────────────────────────────

  'mac-ventura-safari17': {
    preset: 'mac-ventura-safari17',
    os: { platform: 'MacIntel', version: '13.6.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
      version: '17',
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
      vendor: 'Apple Inc.',
      renderer: 'Apple GPU',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman',
        'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS',
        'San Francisco', 'Apple SD Gothic Neo'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  'mac-sonoma-safari17': {
    preset: 'mac-sonoma-safari17',
    os: { platform: 'MacIntel', version: '14.2.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
      version: '17',
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
      vendor: 'Apple Inc.',
      renderer: 'Apple GPU',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman',
        'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS',
        'San Francisco', 'Apple SD Gothic Neo', 'Menlo'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  'mac-monterey-safari16': {
    preset: 'mac-monterey-safari16',
    os: { platform: 'MacIntel', version: '12.7.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
      platform: 'MacIntel',
      vendor: 'Apple Computer, Inc.',
      version: '16',
      languages: ['en-US', 'en']
    },
    screen: {
      width: 1440,
      height: 900,
      availWidth: 1440,
      availHeight: 860,
      colorDepth: 30,
      pixelRatio: 2
    },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Apple Inc.',
      renderer: 'Apple GPU',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman',
        'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'San Francisco'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 0 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  // ── P2: Firefox Desktop Presets ────────────────────────────────────

  'win11-firefox124': {
    preset: 'win11-firefox124',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
      platform: 'Win32',
      vendor: '',
      version: '124',
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
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
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
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  'mac-sonoma-firefox124': {
    preset: 'mac-sonoma-firefox124',
    os: { platform: 'MacIntel', version: '14.2.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
      platform: 'MacIntel',
      vendor: '',
      version: '124',
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
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Helvetica', 'Helvetica Neue', 'Arial', 'Times New Roman',
        'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS', 'San Francisco'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  'linux-ubuntu-firefox124': {
    preset: 'linux-ubuntu-firefox124',
    os: { platform: 'Linux x86_64', version: '5.15.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
      platform: 'Linux x86_64',
      vendor: '',
      version: '124',
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
        'Liberation Mono', 'Liberation Sans', 'Liberation Serif', 'Times New Roman', 'Verdana'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 0 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' }
  },

  'android-firefox124': {
    preset: 'android-firefox124',
    geolocation: { latitude: 13.7563, longitude: 100.5018, accuracy: 20 },
    os: { platform: 'Linux armv8l', version: '14.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Android; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
      platform: 'Linux armv8l',
      vendor: '',
      version: '124',
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
        'Roboto', 'Noto Sans', 'Noto Color Emoji',
        'Droid Sans', 'Droid Serif', 'Courier New'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'empty' },
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
  },

  // ── P3: Edge & Brave Presets (Chromium-based variants) ────────────

  'win11-edge124': {
    preset: 'win11-edge124',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '124',
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
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
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

  'mac-sonoma-edge124': {
    preset: 'mac-sonoma-edge124',
    os: { platform: 'MacIntel', version: '14.2.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      version: '124',
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
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)',
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

  'win11-brave124': {
    preset: 'win11-brave124',
    os: { platform: 'Win32', version: '10.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      platform: 'Win32',
      vendor: 'Google Inc.',
      version: '124',
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
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Chicago' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (AMD)',
      renderer: 'ANGLE (AMD, AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
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

  'android-brave124': {
    preset: 'android-brave124',
    geolocation: { latitude: 13.7563, longitude: 100.5018, accuracy: 20 },
    os: { platform: 'Linux armv8l', version: '14.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '124',
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
      renderer: 'ANGLE (ARM, Mali-G715 MC7, OpenGL ES 3.2)',
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
    speech: { mode: 'filter' },
    network: { connectionType: '4g' }
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

  // Phase 6: inject behavior + timing defaults if not already set by preset
  if (!clone.behavior) {
    clone.behavior = {
      mouseJitter: true,
      typingNoise: true,
      scrollInertia: true
    }
  }
  if (!clone.timing) {
    clone.timing = {
      dateNoisePrecision: 100,
      rafJitter: true,
      performanceClamp: true
    }
  }

  // P1 FIX: Add deterministic variance to hardware properties for realism
  // Varies by ±5-10% per property, but deterministic per profile ID
  const withVariance = applyAllVariance(clone, profileId)

  return withVariance
}

// ── Locale / Timezone Validation ─────────────────────────────────────────────

/** Maps a locale language tag (prefix match) → valid timezone prefixes */
const LOCALE_TIMEZONE_MAP: Record<string, string[]> = {
  'en-US': ['America/'],
  'en-GB': ['Europe/London', 'Europe/Dublin'],
  'en':    ['America/', 'Europe/', 'Australia/', 'Asia/', 'Pacific/'],
  'vi':    ['Asia/Ho_Chi_Minh', 'Asia/Hanoi'],
  'th':    ['Asia/Bangkok'],
  'id':    ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
  'zh':    ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei'],
  'ja':    ['Asia/Tokyo'],
  'ko':    ['Asia/Seoul'],
  'fr':    ['Europe/Paris', 'Europe/'],
  'de':    ['Europe/Berlin', 'Europe/'],
  'ru':    ['Europe/Moscow', 'Asia/Yekaterinburg', 'Asia/Novosibirsk'],
}

/**
 * Returns true if the locale+timezone pair is plausible.
 * If locale is unknown, returns true (permissive).
 */
export function validateLocaleTimezone(locale: string, timezone: string): boolean {
  // Find the most specific matching locale prefix
  const langTag = locale.toLowerCase()
  const keys = Object.keys(LOCALE_TIMEZONE_MAP).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (langTag === key || langTag.startsWith(key.toLowerCase())) {
      const validZones = LOCALE_TIMEZONE_MAP[key]
      return validZones.some((z) => timezone.startsWith(z))
    }
  }
  return true // unknown locale — permissive
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0
  }
  return h
}
