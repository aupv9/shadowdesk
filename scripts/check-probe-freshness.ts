#!/usr/bin/env npx tsx
/**
 * Confirms that every selector in probes.json still matches its live target.
 *
 * This is the mechanism that makes the manifest trustworthy. The shipped
 * selectors were authored without network access, and Layer 2's whole
 * fail-soft contract means a rotted selector costs a user nothing except a
 * missing reading — which also means nothing would ever tell us it rotted. This
 * job is that signal.
 *
 * It checks that a reading can be *obtained*, not that it passes. A profile
 * scoring badly on CreepJS is a finding; CreepJS no longer exposing a score
 * where we look for it is a maintenance task, and only the second one is this
 * script's business.
 *
 *   npx tsx scripts/check-probe-freshness.ts
 *
 * Exits non-zero if any probe could not be read.
 */
import puppeteer from 'puppeteer-core'
import { loadManifest, extractFromPage, type DetectionProbe } from '../src/main/detection/probes'

/** Runner-provided Chrome. Override with CHROME_PATH locally. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  // Playwright's bundled Chromium, when a dev box already has it.
  ...(process.env.PLAYWRIGHT_BROWSERS_PATH
    ? [`${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium/chrome-linux/chrome`]
    : []),
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean) as string[]

async function findChrome(): Promise<string> {
  const { access } = await import('fs/promises')
  for (const p of CHROME_CANDIDATES) {
    try {
      await access(p)
      return p
    } catch { /* next */ }
  }
  throw new Error(
    `No Chrome found. Tried:\n  ${CHROME_CANDIDATES.join('\n  ')}\nSet CHROME_PATH to override.`
  )
}

interface Row {
  probe: DetectionProbe
  ok: boolean
  reading: string
}

async function check(browser: any, probe: DetectionProbe): Promise<Row> {
  const page = await browser.newPage()
  try {
    await page.goto(probe.url, { timeout: probe.timeoutMs, waitUntil: 'domcontentloaded' })
    await new Promise((r) => setTimeout(r, probe.settleMs))

    const extraction = await extractFromPage(page, probe)
    if (extraction.kind === 'missing') {
      return { probe, ok: false, reading: extraction.reason }
    }

    const reading = extraction.kind === 'count' ? String(extraction.count) : extraction.text

    // A count of zero is ambiguous: either nothing failed, or the selector no
    // longer matches anything. Say so rather than reporting a false all-clear.
    if (extraction.kind === 'count' && extraction.count === 0) {
      return {
        probe,
        ok: false,
        reading: 'matched 0 elements — cannot distinguish "nothing failed" from a dead selector'
      }
    }

    return { probe, ok: true, reading }
  } catch (e: any) {
    return { probe, ok: false, reading: `load failed: ${e?.message ?? String(e)}` }
  } finally {
    await page.close().catch(() => {})
  }
}

async function main() {
  const manifest = loadManifest()
  const executablePath = await findChrome()

  console.log(`Probe freshness — manifest v${manifest.manifestVersion}, ${manifest.probes.length} probes`)
  console.log(`Chrome: ${executablePath}\n`)

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  })

  const rows: Row[] = []
  try {
    for (const probe of manifest.probes) {
      process.stdout.write(`  ${probe.id.padEnd(18)} `)
      const row = await check(browser, probe)
      rows.push(row)
      console.log(row.ok ? `ok — read "${row.reading}"` : `STALE — ${row.reading}`)
    }
  } finally {
    await browser.close().catch(() => {})
  }

  const stale = rows.filter((r) => !r.ok)
  console.log()

  if (stale.length === 0) {
    console.log('All probes readable. Set `lastVerified` in probes.json to today for any you now trust.')
    return
  }

  console.log(`${stale.length} probe(s) need attention:\n`)
  for (const r of stale) {
    console.log(`  - ${r.probe.id} (${r.probe.url})`)
    console.log(`      ${r.reading}`)
    console.log(`      selector: ${JSON.stringify(r.probe.extract)}`)
  }
  console.log(
    '\nUsers are unaffected — these report as `unavailable`, not as failures. ' +
    'Fix the selector in src/main/detection/probes.json.'
  )
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
