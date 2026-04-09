#!/usr/bin/env node
/**
 * Ghost Browser — E-Commerce Operations LIVE smoke runner
 *
 * Lightweight flag-gated probe that hits the *real* marketplaces Ghost Browser
 * targets (Shopee, Lazada, TikTok Shop, Tiki, GrabFood, VNPay sandbox) and
 * verifies:
 *
 *   - The base URL is reachable from the current network
 *   - The HTTP status is in the 200-299 range (with a few well-known
 *     redirects allowed)
 *   - The response body contains a platform-specific sentinel string so we
 *     know we weren't redirected to a WAF / captcha page
 *
 * What this is NOT:
 *   - It does NOT launch a real Chromium profile (use scripts/test-automation
 *     for that). Purely an HTTP probe so CI can run it without installing
 *     Chromium.
 *   - It does NOT test behavioural anti-detect — that requires a full browser.
 *   - It does NOT modify any profile / workflow state.
 *
 * Safety:
 *   - Off by default. Requires `GHOSTBROWSER_LIVE_SMOKE=1` OR the `--live`
 *     CLI flag to actually hit the network. Without that it prints the target
 *     table and exits zero — safe to run anywhere.
 *   - Includes a polite per-request delay to avoid looking abusive to target
 *     sites.
 *   - User-Agent explicitly declares that this is a Ghost Browser smoke test
 *     so ops teams on the other side can correlate + whitelist if needed.
 *
 * Run:
 *   npx tsx tests/smoke/ecommerce-live-smoke.ts         # dry run (no network)
 *   npx tsx tests/smoke/ecommerce-live-smoke.ts --live  # actually probe
 *   GHOSTBROWSER_LIVE_SMOKE=1 npx tsx tests/smoke/ecommerce-live-smoke.ts
 */

interface Target {
  platform: string
  region: string
  url: string
  /** A string the body MUST contain to count as a healthy probe. */
  sentinel: RegExp
  /** Optional note shown in the table (e.g. "sandbox only"). */
  note?: string
}

const TARGETS: Target[] = [
  {
    platform: 'Shopee',
    region: 'VN',
    url: 'https://shopee.vn/',
    sentinel: /shopee/i
  },
  {
    platform: 'Shopee',
    region: 'TH',
    url: 'https://shopee.co.th/',
    sentinel: /shopee/i
  },
  {
    platform: 'Lazada',
    region: 'VN',
    url: 'https://www.lazada.vn/',
    sentinel: /lazada/i
  },
  {
    platform: 'Lazada',
    region: 'TH',
    url: 'https://www.lazada.co.th/',
    sentinel: /lazada/i
  },
  {
    platform: 'TikTok Shop',
    region: 'VN',
    url: 'https://shop.tiktok.com/',
    sentinel: /tiktok/i
  },
  {
    platform: 'Tiki',
    region: 'VN',
    url: 'https://tiki.vn/',
    sentinel: /tiki/i
  },
  {
    platform: 'GrabFood',
    region: 'VN',
    url: 'https://food.grab.com/vn/en',
    sentinel: /grab/i
  },
  {
    platform: 'VNPay Sandbox',
    region: 'VN',
    url: 'https://sandbox.vnpayment.vn/',
    sentinel: /vnpay|sandbox/i,
    note: 'sandbox gateway'
  }
]

interface ProbeResult {
  target: Target
  status: number
  ok: boolean
  sentinelMatched: boolean
  sizeBytes: number
  latencyMs: number
  error?: string
}

function args() {
  const argv = process.argv.slice(2)
  return {
    live: argv.includes('--live') || process.env.GHOSTBROWSER_LIVE_SMOKE === '1',
    verbose: argv.includes('--verbose'),
    timeoutMs: Number(process.env.SMOKE_TIMEOUT_MS ?? 15000)
  }
}

const UA =
  'GhostBrowser-SmokeTest/1.0 (+https://github.com/aupv9/shadowdesk; contact: dev team)'

async function probe(target: Target, timeoutMs: number): Promise<ProbeResult> {
  const started = Date.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(target.url, {
      method: 'GET',
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,*/*'
      },
      redirect: 'follow',
      signal: ctrl.signal
    })
    const body = await res.text()
    const ok = res.status >= 200 && res.status < 400
    return {
      target,
      status: res.status,
      ok,
      sentinelMatched: target.sentinel.test(body),
      sizeBytes: body.length,
      latencyMs: Date.now() - started
    }
  } catch (err) {
    return {
      target,
      status: 0,
      ok: false,
      sentinelMatched: false,
      sizeBytes: 0,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err)
    }
  } finally {
    clearTimeout(timer)
  }
}

function pad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w - 1) + '…' : s + ' '.repeat(w - s.length)
}

function printTable(rows: ProbeResult[]): void {
  console.log('')
  console.log(pad('PLATFORM', 14) + pad('RG', 4) + pad('STATUS', 8) + pad('SENT', 6) + pad('SIZE', 10) + pad('MS', 8) + 'URL')
  console.log('─'.repeat(100))
  for (const r of rows) {
    const statusStr = r.status === 0 ? 'ERROR' : String(r.status)
    const passFail = r.ok && r.sentinelMatched ? 'PASS' : 'FAIL'
    const line =
      pad(r.target.platform, 14) +
      pad(r.target.region, 4) +
      pad(statusStr, 8) +
      pad(r.sentinelMatched ? 'yes' : 'no', 6) +
      pad(String(r.sizeBytes), 10) +
      pad(String(r.latencyMs), 8) +
      r.target.url +
      (r.error ? `  ← ${r.error}` : '') +
      `  [${passFail}]`
    console.log(line)
  }
  console.log('─'.repeat(100))
}

async function main(): Promise<void> {
  const { live, verbose, timeoutMs } = args()
  console.log('Ghost Browser — E-Commerce LIVE smoke runner')
  console.log(`Mode: ${live ? 'LIVE (hitting the network)' : 'DRY RUN (no network)'}`)
  console.log(`Targets: ${TARGETS.length}`)
  console.log(`Timeout per probe: ${timeoutMs}ms`)
  console.log('')

  if (!live) {
    console.log('DRY RUN — would probe the following targets:')
    for (const t of TARGETS) {
      console.log(`  - [${t.platform}/${t.region}] ${t.url}${t.note ? ` (${t.note})` : ''}`)
    }
    console.log('')
    console.log('Pass --live or set GHOSTBROWSER_LIVE_SMOKE=1 to actually probe.')
    process.exit(0)
  }

  const results: ProbeResult[] = []
  for (const target of TARGETS) {
    if (verbose) console.error(`→ probing ${target.platform} ${target.region} …`)
    const r = await probe(target, timeoutMs)
    results.push(r)
    // Polite delay between probes — we don't want to look like an attacker.
    await new Promise((r) => setTimeout(r, 1200))
  }

  printTable(results)

  const passed = results.filter((r) => r.ok && r.sentinelMatched).length
  const total = results.length
  console.log('')
  console.log(`Summary: ${passed}/${total} targets healthy`)

  if (passed === total) {
    console.log('All marketplaces reachable & returning expected content.')
    process.exit(0)
  }

  if (passed === 0) {
    console.error('All probes failed — likely no network or outbound HTTPS blocked.')
    process.exit(2)
  }

  console.warn('Some probes failed — investigate above table before trusting live runs.')
  process.exit(1)
}

main().catch((err) => {
  console.error('Smoke runner crashed:', err)
  process.exit(3)
})
