import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import path from 'path'

/**
 * Multi-Login Test Data Generator
 * Generates realistic test profiles, proxies, groups, and credentials
 * for testing Ghost Browser's multi-login functionality
 *
 * Usage:
 *   npx ts-node scripts/generate-multilogin-testdata.ts
 *
 * Output:
 *   - testdata/multilogin-profiles.json
 *   - testdata/multilogin-proxies.json
 *   - testdata/multilogin-credentials.json
 */

interface FingerprintConfig {
  preset: string
  os: any
  browser: any
  screen: any
  hardware: any
  locale: any
  webrtc: any
  canvas: any
  webgl: any
  audio: any
  fonts: any
  media: any
  plugins: any
  speech: any
}

interface Profile {
  id: string
  name: string
  group_id: string
  fingerprint: FingerprintConfig
  proxy_id: string
  notes: string
  status: string
  created_at: string
}

interface Proxy {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string | null
  password: string | null
  country: string
  latency_ms: number
  is_healthy: boolean
  last_checked_at: string
  created_at: string
}

interface ProfileGroup {
  id: string
  name: string
  color: string
  created_at: string
}

interface Credential {
  id: string
  profile_id: string
  username: string
  password: string
  service: string
  description: string
}

// Fingerprint presets for different OS/Browser combos
const fingerprintPresets: Record<string, FingerprintConfig> = {
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
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelRatio: 1 },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (NVIDIA)',
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: [
        'Arial',
        'Arial Black',
        'Calibri',
        'Cambria',
        'Comic Sans MS',
        'Consolas',
        'Courier New',
        'Georgia',
        'Impact',
        'Segoe UI',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana'
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
    screen: { width: 2560, height: 1440, availWidth: 2560, availHeight: 1400, colorDepth: 24, pixelRatio: 1 },
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
        'Arial',
        'Arial Black',
        'Calibri',
        'Cambria',
        'Comic Sans MS',
        'Consolas',
        'Courier New',
        'Georgia',
        'Impact',
        'Segoe UI',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana'
      ]
    },
    media: { audioInputs: 1, audioOutputs: 2, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  },
  'mac-sonoma-chrome121': {
    preset: 'mac-sonoma-chrome121',
    os: { platform: 'MacIntel', version: '14.0.0' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      vendor: 'Google Inc.',
      version: '121',
      languages: ['en-US', 'en']
    },
    screen: { width: 1440, height: 900, availWidth: 1440, availHeight: 855, colorDepth: 24, pixelRatio: 2 },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/Los_Angeles' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: { vendor: 'Apple', renderer: 'Apple M1', noiseSeed: 0 },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: ['Arial', 'Helvetica', 'Times New Roman', 'Courier', 'Georgia']
    },
    media: { audioInputs: 1, audioOutputs: 2, videoInputs: 1 },
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
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1050, colorDepth: 24, pixelRatio: 1 },
    hardware: { deviceMemory: 16, hardwareConcurrency: 8, maxTouchPoints: 0 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'UTC' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (Intel)',
      renderer: 'ANGLE (Intel, Intel UHD Graphics 630 OpenGL via Chromium, OpenGL 4.6)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: ['DejaVu Sans', 'DejaVu Serif', 'Liberation Sans', 'Courier New', 'Georgia']
    },
    media: { audioInputs: 1, audioOutputs: 2, videoInputs: 1 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  },
  'android-samsung-chrome120': {
    preset: 'android-samsung-chrome120',
    os: { platform: 'Linux armv8l', version: '13' },
    browser: {
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.193 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      vendor: 'Google Inc.',
      version: '120',
      languages: ['en-US', 'en']
    },
    screen: { width: 1080, height: 2400, availWidth: 1080, availHeight: 2352, colorDepth: 24, pixelRatio: 2.75 },
    hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 10 },
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'Asia/Seoul' },
    webrtc: { enabled: false, mode: 'disabled' },
    canvas: { mode: 'noise', noiseSeed: 0 },
    webgl: {
      vendor: 'Google Inc. (Qualcomm)',
      renderer: 'ANGLE (Qualcomm, Adreno (TM) 642, OpenGL ES via Chromium, OpenGL ES 3.1)',
      noiseSeed: 0
    },
    audio: { mode: 'noise', noiseSeed: 0 },
    fonts: {
      mode: 'whitelist',
      whitelist: ['Roboto', 'Droid Sans', 'Courier New']
    },
    media: { audioInputs: 1, audioOutputs: 1, videoInputs: 2 },
    plugins: { mode: 'realistic' },
    speech: { mode: 'filter' }
  }
}

// Proxy data from different countries
const proxyDataTemplate = [
  {
    name: 'USA - New York',
    country: 'US',
    host: 'proxy-ny.example.com',
    port: 8080,
    username: 'user_ny',
    password: 'pass_ny_123'
  },
  {
    name: 'UK - London',
    country: 'GB',
    host: 'proxy-london.example.com',
    port: 8080,
    username: 'user_london',
    password: 'pass_london_456'
  },
  {
    name: 'Vietnam - Ho Chi Minh',
    country: 'VN',
    host: 'proxy-hcm.example.com',
    port: 8080,
    username: 'user_hcm',
    password: 'pass_hcm_789'
  },
  {
    name: 'Thailand - Bangkok',
    country: 'TH',
    host: 'proxy-bkk.example.com',
    port: 8080,
    username: 'user_bkk',
    password: 'pass_bkk_321'
  },
  {
    name: 'Indonesia - Jakarta',
    country: 'ID',
    host: 'proxy-jkt.example.com',
    port: 8080,
    username: 'user_jkt',
    password: 'pass_jkt_654'
  }
]

// Test credentials for different services
const testCredentialsTemplate = [
  { username: 'john.doe.us@gmail.com', password: 'SecurePass123!', service: 'Gmail', description: 'US-based Gmail account' },
  {
    username: 'alice.smith.uk@outlook.com',
    password: 'SecurePass456!',
    service: 'Outlook',
    description: 'UK-based Outlook account'
  },
  {
    username: 'vietnam.user.2024@gmail.com',
    password: 'SecurePass789!',
    service: 'Gmail',
    description: 'Vietnam-based Gmail account'
  },
  { username: 'bangkok.seller@email.com', password: 'SecurePass012!', service: 'Custom', description: 'Thailand-based account' },
  {
    username: 'jakarta.entrepreneur@mail.com',
    password: 'SecurePass345!',
    service: 'Custom',
    description: 'Indonesia-based account'
  }
]

function generateTestData() {
  console.log('🔄 Generating multi-login test data...\n')

  // Create testdata directory
  const testdataDir = path.join(process.cwd(), 'testdata')
  if (!fs.existsSync(testdataDir)) {
    fs.mkdirSync(testdataDir, { recursive: true })
  }

  // Create groups
  const groups: ProfileGroup[] = [
    { id: uuidv4(), name: 'E-commerce Testing', color: '#3b82f6', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'Social Media Testing', color: '#ef4444', created_at: new Date().toISOString() },
    { id: uuidv4(), name: 'Geo-Testing', color: '#10b981', created_at: new Date().toISOString() }
  ]

  const groupMap: Record<number, string> = {}
  groups.forEach((group, idx) => {
    groupMap[idx] = group.id
  })

  // Create proxies
  const proxies: Record<number, Proxy> = {}
  const presetKeys = Object.keys(fingerprintPresets)

  proxyDataTemplate.forEach((proxyData, idx) => {
    const id = uuidv4()
    proxies[idx] = {
      id,
      name: proxyData.name,
      type: 'http',
      host: proxyData.host,
      port: proxyData.port,
      username: proxyData.username,
      password: proxyData.password,
      country: proxyData.country,
      latency_ms: Math.floor(Math.random() * 100) + 20,
      is_healthy: true,
      last_checked_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }
  })

  // Create profiles with different fingerprints
  const profiles: Profile[] = []
  const credentials: Credential[] = []

  presetKeys.forEach((preset, idx) => {
    const profileId = uuidv4()
    const proxyId = proxies[idx % presetKeys.length].id
    const groupId = groupMap[idx % 3]
    const fingerprint = fingerprintPresets[preset]
    const credTemplate = testCredentialsTemplate[idx % testCredentialsTemplate.length]

    const profile: Profile = {
      id: profileId,
      name: `${preset.split('-').join(' ').toUpperCase()} - Account ${idx + 1}`,
      group_id: groupId,
      fingerprint,
      proxy_id: proxyId,
      notes: `Test account #${idx + 1} - ${credTemplate.description}\nProxy: ${proxies[idx % presetKeys.length].name}\nCreated for multi-login testing`,
      status: 'active',
      created_at: new Date().toISOString()
    }

    profiles.push(profile)

    // Create credential for this profile
    const credential: Credential = {
      id: uuidv4(),
      profile_id: profileId,
      username: credTemplate.username,
      password: credTemplate.password,
      service: credTemplate.service,
      description: credTemplate.description
    }

    credentials.push(credential)
  })

  // Write JSON files
  fs.writeFileSync(path.join(testdataDir, 'multilogin-groups.json'), JSON.stringify(groups, null, 2))
  fs.writeFileSync(path.join(testdataDir, 'multilogin-proxies.json'), JSON.stringify(Object.values(proxies), null, 2))
  fs.writeFileSync(path.join(testdataDir, 'multilogin-profiles.json'), JSON.stringify(profiles, null, 2))
  fs.writeFileSync(path.join(testdataDir, 'multilogin-credentials.json'), JSON.stringify(credentials, null, 2))

  // Generate summary report
  console.log('✅ Test Data Generated Successfully!\n')
  console.log('📊 Summary:')
  console.log(`   • Profiles Created: ${profiles.length}`)
  console.log(`   • Proxies Created: ${Object.keys(proxies).length}`)
  console.log(`   • Groups Created: ${groups.length}`)
  console.log(`   • Test Credentials: ${credentials.length}\n`)

  console.log('📁 Output Files:')
  console.log(`   • testdata/multilogin-groups.json`)
  console.log(`   • testdata/multilogin-proxies.json`)
  console.log(`   • testdata/multilogin-profiles.json`)
  console.log(`   • testdata/multilogin-credentials.json\n`)

  console.log('📍 Profile Details:\n')
  profiles.forEach((profile, idx) => {
    const cred = credentials[idx]
    const proxy = proxies[idx % presetKeys.length]
    console.log(`${idx + 1}. ${profile.name}`)
    console.log(`   📧 Username: ${cred.username}`)
    console.log(`   🔐 Password: ${cred.password}`)
    console.log(`   🌍 Proxy: ${proxy.name}`)
    console.log(`   📱 Preset: ${Object.keys(fingerprintPresets)[idx]}`)
    console.log(`   💾 Profile ID: ${profile.id}`)
    console.log('')
  })

  console.log('🚀 Testing Checklist:')
  console.log('   ✓ Launch each profile in separate browser windows')
  console.log('   ✓ Verify different IP addresses using https://whatismyipaddress.com')
  console.log('   ✓ Check fingerprint at https://browserleaks.com or https://whoer.net')
  console.log('   ✓ Test account login with provided credentials')
  console.log('   ✓ Verify no cookie/data leakage between profiles')
  console.log('   ✓ Monitor proxy latency and connection stability')
  console.log('   ✓ Test rotation between profiles')
  console.log('   ✓ Verify concurrent sessions from different profiles\n')

  console.log('💡 Quick Import Guide:')
  console.log('   1. Use the test data JSON files in your automation tests')
  console.log('   2. Import profiles into database using the IPC API')
  console.log('   3. Start multi-login sessions from different profiles')
  console.log('   4. Monitor detection vectors and fingerprint consistency')
}

generateTestData()
