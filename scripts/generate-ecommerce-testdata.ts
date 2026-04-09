/**
 * Ghost Browser — E-Commerce Operations testdata generator
 *
 * Emits three JSON fixtures under `testdata/`:
 *
 *   ecommerce-proxies.json    6 residential-style proxies (one per SEA country)
 *   ecommerce-profiles.json   10 browser profiles covering Shopee / Lazada /
 *                             TikTok Shop / Tiki / GrabFood personas, each
 *                             with a realistic fingerprint preset + proxy
 *                             binding
 *   ecommerce-workflows.json  every SEA workflow template from
 *                             src/main/workflow-templates.ts, re-stamped with
 *                             fresh UUIDs and ready to be inserted into the
 *                             app's `workflows` table
 *
 * The accompanying seeder (`scripts/seed-ecommerce-db.ts`) reads these
 * fixtures and writes them directly into the app's sql.js database so the
 * user can open the Electron app and immediately see populated profiles,
 * proxies and workflows in the UI.
 *
 * This generator is deterministic — same input = same output — so the
 * fixtures are stable across runs and can be committed to source control
 * if desired (they're gitignored by default since they're considered
 * regeneratable).
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { FINGERPRINT_PRESETS } from '../src/main/fingerprint/presets'
import { WORKFLOW_TEMPLATES } from '../src/main/workflow-templates'
import type { FingerprintConfig } from '../src/shared/types'

// ─── Deterministic UUID helper ────────────────────────────────────────────────
// We want generated IDs to be stable between runs so re-running the seeder
// updates existing rows rather than creating duplicates.
function stableUuid(seed: string): string {
  const h = crypto.createHash('sha1').update(seed).digest('hex')
  // v4-style layout
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(13, 16),
    ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32)
  ].join('-')
}

// ─── Proxy seed data ──────────────────────────────────────────────────────────
// All proxies point at dummy hosts — the seeder assigns them to profiles so
// the UI shows populated Proxy Manager + Profile → Proxy binding.  Users will
// need to edit / replace with real credentials before actually launching
// Chromium — these exist purely to exercise the UX.
interface ProxyFixture {
  id: string
  name: string
  type: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username: string
  password: string
  country: string
  is_healthy: 0 | 1
  latency_ms: number
  notes: string
}

const PROXIES: ProxyFixture[] = [
  { country: 'VN', city: 'Ho Chi Minh', host: '103.145.58.21' },
  { country: 'TH', city: 'Bangkok',     host: '103.77.248.5'  },
  { country: 'ID', city: 'Jakarta',     host: '103.167.85.92' },
  { country: 'MY', city: 'Kuala Lumpur',host: '103.3.60.110'  },
  { country: 'PH', city: 'Manila',      host: '103.171.39.62' },
  { country: 'SG', city: 'Singapore',   host: '103.47.134.17' }
].map((p, i) => ({
  id: stableUuid(`ecommerce-proxy-${p.country}`),
  name: `SEA Residential — ${p.city} (${p.country})`,
  type: 'http' as const,
  host: p.host,
  port: 30000 + i * 100,
  username: `gb_${p.country.toLowerCase()}_user`,
  password: `DEMO-${p.country}-2026`,
  country: p.country,
  is_healthy: 1,
  latency_ms: 80 + i * 25,
  notes: `Demo proxy for ${p.city}. Replace host/creds before live runs.`
}))

// ─── Profile seed data ────────────────────────────────────────────────────────

interface ProfilePersona {
  nameSuffix: string
  platform: string
  proxyCountry: string
  preset: keyof typeof FINGERPRINT_PRESETS
  notes: string
  rotation_mode?: 'none' | 'random' | 'round-robin'
}

const PERSONAS: ProfilePersona[] = [
  {
    nameSuffix: 'Shopee VN — Shopper 01',
    platform: 'shopee',
    proxyCountry: 'VN',
    preset: 'android-samsung-chrome120',
    notes: 'Primary Shopee VN buyer. Android Samsung A54 fingerprint, mobile-first UX.'
  },
  {
    nameSuffix: 'Shopee TH — Shopper 02',
    platform: 'shopee',
    proxyCountry: 'TH',
    preset: 'android-pixel-chrome121',
    notes: 'Shopee TH tester. Pixel 7 fingerprint, Bangkok exit.'
  },
  {
    nameSuffix: 'Shopee ID — Flash Deal Hunter',
    platform: 'shopee',
    proxyCountry: 'ID',
    preset: 'android-oppo-chrome120',
    notes: 'Shopee ID flash sale monitor. OPPO Reno fingerprint.',
    rotation_mode: 'round-robin'
  },
  {
    nameSuffix: 'Lazada VN — Buyer 01',
    platform: 'lazada',
    proxyCountry: 'VN',
    preset: 'win10-chrome120',
    notes: 'Lazada VN desktop buyer. Windows 10 Chrome 120.'
  },
  {
    nameSuffix: 'Lazada MY — Buyer 02',
    platform: 'lazada',
    proxyCountry: 'MY',
    preset: 'android-oppo-chrome120',
    notes: 'Lazada MY mobile shopper. OPPO fingerprint for SEA alignment.'
  },
  {
    nameSuffix: 'TikTok Shop VN — Live Scraper',
    platform: 'tiktok-shop',
    proxyCountry: 'VN',
    preset: 'android-pixel-chrome121',
    notes: 'TikTok Shop live-stream monitoring. Mobile preset REQUIRED — Phase 17.H validator blocks desktop.'
  },
  {
    nameSuffix: 'TikTok Shop ID — Feed Browser',
    platform: 'tiktok-shop',
    proxyCountry: 'ID',
    preset: 'android-samsung-chrome120',
    notes: 'TikTok Shop Indonesia feed browsing + trending scraper.'
  },
  {
    nameSuffix: 'Tiki VN — Search Bot',
    platform: 'tiki',
    proxyCountry: 'VN',
    preset: 'win11-chrome121',
    notes: 'Tiki VN desktop search + flash-deal monitor. Windows 11.'
  },
  {
    nameSuffix: 'Tiki VN — Deal Tracker',
    platform: 'tiki',
    proxyCountry: 'VN',
    preset: 'mac-sonoma-chrome121',
    notes: 'Tiki flash deal monitor. macOS Sonoma fingerprint — contrasts with the Windows buyer.'
  },
  {
    nameSuffix: 'GrabFood VN — Restaurant Explorer',
    platform: 'grab',
    proxyCountry: 'VN',
    preset: 'android-samsung-chrome120',
    notes: 'GrabFood Vietnam restaurant browsing. Delivery address = Nguyen Hue Walking Street.'
  }
]

interface ProfileFixture {
  id: string
  name: string
  group_id: string | null
  group_name: string
  fingerprint: FingerprintConfig
  proxy_id: string
  notes: string
  status: 'active'
  rotation_mode: 'none' | 'random' | 'round-robin'
  user_data_path: string
  persona: {
    platform: string
    preset: string
    proxy_country: string
  }
}

// Build a single deterministic fingerprint for a persona: deep-clone the
// preset, set a noise seed derived from the profile id, and assign the preset
// key. This mirrors `resolveFingerprint()` logic without the property-variance
// step (which depends on DOM helpers we don't need for seeding).
function buildFingerprint(profileId: string, presetKey: keyof typeof FINGERPRINT_PRESETS): FingerprintConfig {
  const base = FINGERPRINT_PRESETS[presetKey]
  const clone = JSON.parse(JSON.stringify(base)) as FingerprintConfig
  const seed = Array.from(profileId).reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0)
  clone.canvas.noiseSeed = seed
  clone.webgl.noiseSeed = seed
  clone.audio.noiseSeed = seed
  clone.preset = presetKey
  // Behaviour layer — Phase 17.H validator requires all three ON for SEA
  // platforms or the pre-flight check fails with "behavior-disabled".
  if (!clone.behavior) {
    clone.behavior = { mouseJitter: true, typingNoise: true, scrollInertia: true }
  }
  if (!clone.timing) {
    clone.timing = { dateNoisePrecision: 100, rafJitter: true, performanceClamp: true }
  }
  return clone
}

const PROFILE_GROUP_ID = stableUuid('ecommerce-profile-group')

const PROFILES: ProfileFixture[] = PERSONAS.map((persona, idx) => {
  const id = stableUuid(`ecommerce-profile-${idx}-${persona.platform}-${persona.proxyCountry}`)
  const proxy = PROXIES.find((p) => p.country === persona.proxyCountry)
  if (!proxy) throw new Error(`No proxy seeded for country ${persona.proxyCountry}`)
  return {
    id,
    name: persona.nameSuffix,
    group_id: PROFILE_GROUP_ID,
    group_name: 'E-Commerce Operations',
    fingerprint: buildFingerprint(id, persona.preset),
    proxy_id: proxy.id,
    notes: persona.notes,
    status: 'active',
    rotation_mode: persona.rotation_mode ?? 'none',
    // user_data_path is filled in by the seeder at runtime (needs Electron userData path)
    user_data_path: `<userdata>/profiles/${id}`,
    persona: {
      platform: persona.platform,
      preset: persona.preset as string,
      proxy_country: persona.proxyCountry
    }
  }
})

// ─── Workflow seed data ───────────────────────────────────────────────────────
// Install every SEA template as a real DB workflow row. Each step gets a new
// UUID (matching the "install from template" pattern in marketplace.ts).

interface WorkflowFixture {
  id: string
  name: string
  description: string
  platform: string | undefined
  region: string | undefined
  tags: string[]
  category: string
  steps: any[]
  variables: Record<string, string>
  /** Default profile IDs wired to this workflow so the UI shows a ready-to-run mapping. */
  profile_ids: string[]
}

function pickProfilesFor(platform: string | undefined): string[] {
  if (!platform) return []
  return PROFILES
    .filter((p) => p.persona.platform === platform)
    .map((p) => p.id)
}

function defaultVariables(platform: string | undefined): Record<string, string> {
  const common = {
    keyword: 'iphone 15 pro max'
  }
  switch (platform) {
    case 'shopee':
      return {
        ...common,
        productUrl: 'https://shopee.vn/iPhone-15-Pro-Max-256GB-i.123.4567890',
        shopee_user: 'demo_user@example.com',
        shopee_password: 'DemoPass123!'
      }
    case 'lazada':
      return {
        ...common,
        productUrl: 'https://www.lazada.vn/products/iphone-15-pro-max-i401234567.html'
      }
    case 'tiktok-shop':
      return {
        ...common,
        liveUrl: 'https://shop.tiktok.com/@demo_seller/live'
      }
    case 'tiki':
      return {
        ...common,
        productUrl: 'https://tiki.vn/iphone-15-pro-max-256gb-p270123456.html'
      }
    case 'vnpay':
      return {
        ...common,
        vnpayCheckoutUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?demo=1',
        vnpayRedirectUrl: 'https://sandbox.vnpayment.vn/Bank/bank_redirect?demo=1'
      }
    case 'grab':
      return {
        ...common,
        deliveryAddress: 'Nguyen Hue Walking Street, Ho Chi Minh City'
      }
    default:
      return common
  }
}

/**
 * Recursively rewrite step IDs using a stable index path so fixture diffs
 * don't churn on every regeneration. The real template IDs come from
 * `crypto.randomUUID()` at module load which changes every run — but since
 * the structure of each template is fixed, an index path (e.g. "3.steps.1")
 * is both unique and deterministic.
 */
function restampStepIds(steps: any[], tplId: string, prefix: string): any[] {
  return steps.map((s: any, idx: number) => {
    const path = `${prefix}${idx}`
    const next: any = {
      ...s,
      id: stableUuid(`ecommerce-step-${tplId}-${path}`)
    }
    // Rewrite nested step containers (loop.steps, conditional.thenSteps/elseSteps,
    // tryCatch.tryBlock/catchBlock/finallyBlock, parallelSteps.steps, ...)
    if (next.params && typeof next.params === 'object') {
      const p = { ...next.params }
      if (Array.isArray(p.steps)) p.steps = restampStepIds(p.steps, tplId, `${path}.s.`)
      if (Array.isArray(p.thenSteps)) p.thenSteps = restampStepIds(p.thenSteps, tplId, `${path}.t.`)
      if (Array.isArray(p.elseSteps)) p.elseSteps = restampStepIds(p.elseSteps, tplId, `${path}.e.`)
      if (Array.isArray(p.tryBlock)) p.tryBlock = restampStepIds(p.tryBlock, tplId, `${path}.try.`)
      if (Array.isArray(p.catchBlock)) p.catchBlock = restampStepIds(p.catchBlock, tplId, `${path}.catch.`)
      if (Array.isArray(p.finallyBlock)) p.finallyBlock = restampStepIds(p.finallyBlock, tplId, `${path}.finally.`)
      next.params = p
    }
    return next
  })
}

const WORKFLOWS: WorkflowFixture[] = WORKFLOW_TEMPLATES
  .filter((tpl) => typeof tpl.category === 'string' && (tpl.category as string).startsWith('sea-'))
  .map((tpl) => {
    const id = stableUuid(`ecommerce-workflow-${tpl.id}`)
    // Deep-clone steps and re-stamp their IDs with a stable index path.
    const cloned = JSON.parse(JSON.stringify(tpl.steps))
    const steps = restampStepIds(cloned, tpl.id, '')
    return {
      id,
      name: tpl.name,
      description: tpl.description,
      platform: tpl.platform,
      region: tpl.region,
      tags: tpl.tags ?? [],
      category: tpl.category as string,
      steps,
      variables: defaultVariables(tpl.platform),
      profile_ids: pickProfilesFor(tpl.platform)
    }
  })

// ─── Emit ────────────────────────────────────────────────────────────────────

function main(): void {
  const outDir = path.join(process.cwd(), 'testdata')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const proxiesPath = path.join(outDir, 'ecommerce-proxies.json')
  const profilesPath = path.join(outDir, 'ecommerce-profiles.json')
  const workflowsPath = path.join(outDir, 'ecommerce-workflows.json')
  const groupPath = path.join(outDir, 'ecommerce-profile-group.json')

  fs.writeFileSync(proxiesPath, JSON.stringify(PROXIES, null, 2))
  fs.writeFileSync(profilesPath, JSON.stringify(PROFILES, null, 2))
  fs.writeFileSync(workflowsPath, JSON.stringify(WORKFLOWS, null, 2))
  fs.writeFileSync(
    groupPath,
    JSON.stringify(
      { id: PROFILE_GROUP_ID, name: 'E-Commerce Operations', color: '#f97316' },
      null,
      2
    )
  )

  console.log('E-Commerce Operations test data generated\n')
  console.log('Fixtures:')
  console.log(`  proxies    — ${PROXIES.length.toString().padStart(3)} (${proxiesPath})`)
  console.log(`  profiles   — ${PROFILES.length.toString().padStart(3)} (${profilesPath})`)
  console.log(`  workflows  — ${WORKFLOWS.length.toString().padStart(3)} (${workflowsPath})`)
  console.log(`  group      — 1 (${groupPath})`)
  console.log('')

  console.log('Persona breakdown:')
  const byPlatform = PROFILES.reduce<Record<string, number>>((acc, p) => {
    acc[p.persona.platform] = (acc[p.persona.platform] ?? 0) + 1
    return acc
  }, {})
  for (const [platform, count] of Object.entries(byPlatform)) {
    console.log(`  ${platform.padEnd(16)} ${count}`)
  }
  console.log('')

  console.log('Workflow breakdown:')
  const byWfPlatform = WORKFLOWS.reduce<Record<string, number>>((acc, w) => {
    const key = w.platform ?? 'unknown'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  for (const [platform, count] of Object.entries(byWfPlatform)) {
    console.log(`  ${platform.padEnd(16)} ${count}`)
  }
  console.log('')

  console.log('Next step:  npm run test:ecommerce:seed:db')
}

main()
