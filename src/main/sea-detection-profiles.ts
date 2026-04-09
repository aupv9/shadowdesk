/**
 * SEA Ecommerce Platform Detection Profiles
 *
 * Each profile describes the known detection vectors and anti-bot measures
 * used by major SEA ecommerce platforms. Used by the Detection Advisor to
 * provide platform-specific recommendations.
 *
 * Sources: Public security research, fingerprint.js documentation,
 * anti-detect community knowledge.
 */

export interface PlatformDetectionProfile {
  id: string
  name: string
  url: string
  region: string[]
  description: string
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  detectionVectors: PlatformDetectionVector[]
  recommendations: string[]
  lastUpdated: string
}

export interface PlatformDetectionVector {
  name: string
  category: 'fingerprint' | 'behavior' | 'network' | 'automation' | 'reputation'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  mitigation: string
}

export const SEA_DETECTION_PROFILES: PlatformDetectionProfile[] = [
  {
    id: 'shopee',
    name: 'Shopee',
    url: 'shopee.vn / shopee.co.th / shopee.co.id',
    region: ['VN', 'TH', 'ID', 'MY', 'PH', 'SG'],
    description: 'Shopee uses a combination of fingerprint.js, behavioral analysis, and device reputation scoring. Their anti-bot system is moderately sophisticated with frequent updates.',
    riskLevel: 'high',
    detectionVectors: [
      {
        name: 'Canvas Fingerprint',
        category: 'fingerprint',
        severity: 'high',
        description: 'Shopee uses canvas fingerprinting via fingerprint.js to create unique device identifiers.',
        mitigation: 'Enable canvas noise injection with profile-specific seed. Avoid blocking canvas entirely — it raises suspicion.'
      },
      {
        name: 'WebGL Renderer',
        category: 'fingerprint',
        severity: 'high',
        description: 'Checks WebGL vendor/renderer strings for consistency with reported OS and hardware.',
        mitigation: 'Use realistic WebGL renderer matching the profile OS. Samsung + Adreno for Android, Intel for Windows.'
      },
      {
        name: 'Navigator Properties',
        category: 'fingerprint',
        severity: 'medium',
        description: 'Validates navigator.platform, hardwareConcurrency, deviceMemory against user agent.',
        mitigation: 'Ensure all navigator properties match the selected preset. Inconsistent values trigger risk scoring.'
      },
      {
        name: 'Timezone Consistency',
        category: 'fingerprint',
        severity: 'medium',
        description: 'Compares Intl.DateTimeFormat timezone with IP geolocation.',
        mitigation: 'Set timezone matching the proxy location. Vietnam proxy → Asia/Ho_Chi_Minh.'
      },
      {
        name: 'Mouse Movement Patterns',
        category: 'behavior',
        severity: 'high',
        description: 'Tracks mouse velocity, acceleration, and movement patterns. Bot-like linear movements are flagged.',
        mitigation: 'Enable behavior simulation with mouse jitter. Use "sea-mobile-shopper" or "casual-browser" archetype.'
      },
      {
        name: 'Click Timing',
        category: 'behavior',
        severity: 'medium',
        description: 'Measures time between page load and first interaction. Instant clicks suggest automation.',
        mitigation: 'Add random delays (1-3s) before first interaction. Use behavior archetype action pauses.'
      },
      {
        name: 'CDP Detection',
        category: 'automation',
        severity: 'critical',
        description: 'Checks for Chrome DevTools Protocol artifacts: navigator.webdriver, chrome.runtime, stack traces.',
        mitigation: 'Ensure CDP evasion layers are active. Check that navigator.webdriver returns false.'
      },
      {
        name: 'IP Reputation',
        category: 'reputation',
        severity: 'high',
        description: 'Checks IP against datacenter/VPN/proxy blacklists. Residential IPs preferred.',
        mitigation: 'Use residential proxies from Vietnamese/Thai/Indonesian ISPs. Avoid datacenter IPs.'
      },
      {
        name: 'Cookie/Session Consistency',
        category: 'network',
        severity: 'medium',
        description: 'Tracks session cookies across visits. Frequent cookie clearing is suspicious.',
        mitigation: 'Preserve cookies between sessions. Use profile warm-up before main activities.'
      }
    ],
    recommendations: [
      'Use residential proxies with Vietnamese/Thai IP addresses',
      'Enable full behavior simulation (mouse jitter, typing noise, scroll inertia)',
      'Warm up profiles for 2-3 days before making purchases',
      'Avoid launching more than 3 profiles simultaneously from the same IP',
      'Use the "sea-mobile-shopper" behavior archetype for mobile presets',
      'Keep sessions under 30 minutes to match natural shopping behavior'
    ],
    lastUpdated: '2026-04-09'
  },
  {
    id: 'lazada',
    name: 'Lazada',
    url: 'lazada.vn / lazada.co.th / lazada.co.id',
    region: ['VN', 'TH', 'ID', 'MY', 'PH', 'SG'],
    description: 'Lazada (Alibaba-owned) uses Akamai Bot Manager and proprietary fingerprinting. More aggressive detection than Shopee, especially for account creation.',
    riskLevel: 'extreme',
    detectionVectors: [
      {
        name: 'Akamai Sensor Data',
        category: 'fingerprint',
        severity: 'critical',
        description: 'Akamai Bot Manager collects 150+ browser attributes into encrypted sensor data payloads.',
        mitigation: 'All fingerprint vectors must be consistent. Any single inconsistency can trigger detection.'
      },
      {
        name: 'Canvas + WebGL Combined',
        category: 'fingerprint',
        severity: 'critical',
        description: 'Cross-references canvas hash with WebGL renderer to detect spoofing inconsistencies.',
        mitigation: 'Use deterministic noise seeds (same seed per profile). Never mix preset hardware configs.'
      },
      {
        name: 'Audio Fingerprint',
        category: 'fingerprint',
        severity: 'high',
        description: 'AudioContext oscillator fingerprinting with high precision. Detects noise injection patterns.',
        mitigation: 'Use subtle audio noise (low amplitude). Avoid blocking AudioContext entirely.'
      },
      {
        name: 'Font Enumeration',
        category: 'fingerprint',
        severity: 'medium',
        description: 'Enumerates installed fonts via canvas measurement. Whitelisted fonts can appear suspicious.',
        mitigation: 'Use region-appropriate font lists. Include common Vietnamese/Thai fonts.'
      },
      {
        name: 'TLS Fingerprint',
        category: 'network',
        severity: 'high',
        description: 'Analyzes TLS ClientHello for JA3/JA4 fingerprints. Puppeteer TLS differs from real Chrome.',
        mitigation: 'Use the latest Chrome version preset. Consider profile warm-up to establish TLS reputation.'
      },
      {
        name: 'Request Timing',
        category: 'behavior',
        severity: 'high',
        description: 'Monitors request frequency and timing patterns. Automated requests show regular intervals.',
        mitigation: 'Add random jitter to all request timings. Vary action pauses between 1-5 seconds.'
      },
      {
        name: 'Headless Detection',
        category: 'automation',
        severity: 'critical',
        description: 'Advanced headless browser detection via window dimensions, chrome.app, permission states.',
        mitigation: 'Ensure all CDP evasion layers are active. Test with detection dashboard before use.'
      },
      {
        name: 'Device Fingerprint Persistence',
        category: 'reputation',
        severity: 'high',
        description: 'Tracks device fingerprint across sessions. Profile changes between visits flag accounts.',
        mitigation: 'Never change fingerprint settings for an active profile. Use profile versioning for rollback.'
      }
    ],
    recommendations: [
      'Lazada has the most aggressive detection — test thoroughly before production use',
      'Use ONLY residential proxies (datacenter IPs are instantly blocked)',
      'Warm up profiles for minimum 5 days with organic browsing',
      'Limit to 1-2 profiles per residential IP',
      'Avoid rapid account creation — space 24+ hours between new accounts',
      'Use desktop presets (win10/win11) — mobile detection is stricter on Lazada',
      'Run detection tests after every fingerprint change',
      'Enable all behavior simulation features (mouse, typing, scroll, timing)'
    ],
    lastUpdated: '2026-04-09'
  },
  {
    id: 'tiki',
    name: 'Tiki',
    url: 'tiki.vn',
    region: ['VN'],
    description: 'Tiki (Vietnam-only) uses moderate anti-bot measures. Less sophisticated than Shopee/Lazada but actively improving. Primary focus on account abuse prevention.',
    riskLevel: 'medium',
    detectionVectors: [
      {
        name: 'Basic Fingerprinting',
        category: 'fingerprint',
        severity: 'medium',
        description: 'Uses standard fingerprint.js library for device identification.',
        mitigation: 'Standard fingerprint spoofing is sufficient. Ensure canvas and WebGL noise are enabled.'
      },
      {
        name: 'User Agent Validation',
        category: 'fingerprint',
        severity: 'medium',
        description: 'Validates user agent consistency with navigator properties.',
        mitigation: 'Use matching preset — don\'t mix OS and browser versions.'
      },
      {
        name: 'IP Geolocation',
        category: 'network',
        severity: 'high',
        description: 'Strictly validates Vietnamese IP addresses. Foreign IPs trigger additional verification.',
        mitigation: 'Use Vietnamese residential proxies. Tiki blocks most non-VN traffic.'
      },
      {
        name: 'Rate Limiting',
        category: 'behavior',
        severity: 'medium',
        description: 'Aggressive rate limiting on API calls and page views.',
        mitigation: 'Add 2-5 second delays between page navigations. Limit to 50 page views per session.'
      },
      {
        name: 'WebDriver Check',
        category: 'automation',
        severity: 'high',
        description: 'Checks navigator.webdriver property and chrome.csi availability.',
        mitigation: 'Ensure CDP evasion is active. Test navigator.webdriver returns false.'
      },
      {
        name: 'Phone Verification',
        category: 'reputation',
        severity: 'high',
        description: 'Requires Vietnamese phone number for account creation and verification.',
        mitigation: 'Vietnamese SIM cards required. VoIP numbers are blocked.'
      }
    ],
    recommendations: [
      'Vietnamese residential proxy is mandatory — Tiki blocks foreign IPs',
      'Use sea-vn-* fingerprint presets for authentic Vietnamese device profiles',
      'Profile warm-up of 1-2 days is sufficient',
      'Phone verification requires Vietnamese SIM — plan accordingly',
      'Set timezone to Asia/Ho_Chi_Minh and locale to vi-VN',
      'Rate limiting is strict — use conservative action pauses (3-5 seconds)'
    ],
    lastUpdated: '2026-04-09'
  },
  {
    id: 'tiktok-shop',
    name: 'TikTok Shop',
    url: 'tiktok.com/shop',
    region: ['VN', 'TH', 'ID', 'MY', 'PH'],
    description: 'TikTok Shop uses ByteDance\'s proprietary anti-bot system. Very aggressive fingerprinting combined with behavioral analysis and social graph verification.',
    riskLevel: 'extreme',
    detectionVectors: [
      {
        name: 'ByteDance Fingerprint SDK',
        category: 'fingerprint',
        severity: 'critical',
        description: 'Proprietary fingerprinting SDK that collects 200+ device attributes.',
        mitigation: 'Maximum fingerprint consistency required. All vectors must align perfectly.'
      },
      {
        name: 'Behavior Biometrics',
        category: 'behavior',
        severity: 'critical',
        description: 'Tracks scroll patterns, tap timing, swipe velocity, and engagement patterns.',
        mitigation: 'Use "sea-live-commerce-viewer" archetype. Enable full behavior simulation.'
      },
      {
        name: 'Social Graph Analysis',
        category: 'reputation',
        severity: 'high',
        description: 'Analyzes social connections, follower patterns, and account age.',
        mitigation: 'Warm up profiles extensively (7+ days). Build organic-looking follower networks.'
      },
      {
        name: 'Video Engagement Tracking',
        category: 'behavior',
        severity: 'high',
        description: 'Monitors video watch time, scroll-past rate, and interaction patterns.',
        mitigation: 'Simulate realistic video watching. Vary dwell time between 5-30 seconds per video.'
      },
      {
        name: 'Device Binding',
        category: 'reputation',
        severity: 'critical',
        description: 'Binds accounts to specific device fingerprints. Profile changes flag accounts.',
        mitigation: 'Never modify fingerprint after account creation. Keep 1 account per profile.'
      }
    ],
    recommendations: [
      'TikTok Shop has extreme detection — only use for experienced users',
      'Profiles need 7+ days of organic warm-up (video watching, scrolling)',
      'Use mobile presets exclusively — desktop profiles are rare on TikTok',
      'Residential mobile proxies strongly recommended (4G connections)',
      'One account per profile — never share profiles between accounts',
      'Use "sea-live-commerce-viewer" behavior archetype',
      'Keep sessions 10-20 minutes with natural engagement patterns'
    ],
    lastUpdated: '2026-04-09'
  }
]

/** Get all available platform detection profiles */
export function getDetectionProfiles(): PlatformDetectionProfile[] {
  return SEA_DETECTION_PROFILES
}

/** Get a specific platform profile by ID */
export function getDetectionProfile(id: string): PlatformDetectionProfile | undefined {
  return SEA_DETECTION_PROFILES.find(p => p.id === id)
}

/** Get profiles relevant to a specific region */
export function getDetectionProfilesByRegion(regionCode: string): PlatformDetectionProfile[] {
  return SEA_DETECTION_PROFILES.filter(p => p.region.includes(regionCode.toUpperCase()))
}
