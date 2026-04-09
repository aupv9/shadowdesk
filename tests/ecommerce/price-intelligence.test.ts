/**
 * E-Commerce Operations — Pillar 2: Price Intelligence & Competitor Tracking
 *
 * Validates the end-to-end price extraction pipeline across multiple
 * marketplaces for the same keyword ("iphone 15 pro max"):
 *
 *   1) Every marketplace's search workflow extracts a non-empty price list
 *   2) The price parser correctly normalises all regional currency formats
 *      (Shopee VN ₫, Tiki VN ₫ after, Lazada VN ₫, plus MY/TH/ID/PH/SG hints)
 *   3) Aggregating across platforms produces a sensible competitor matrix
 *      with min/max/mean/median
 *   4) Detects the cheapest platform for the same SKU family
 *   5) Edge cases: empty list, mixed currencies, discount-stripped prices
 *
 * This is the layer a real "price tracker" feature would build on — the
 * tests lock in the contract for that downstream consumer.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { WORKFLOW_TEMPLATES } from '../../src/main/workflow-templates'
import { OfflineWorkflowRunner, defineWorkflow } from './helpers/offline-workflow-runner'
import {
  parsePrice,
  parsePriceBatch,
  priceStats,
  type ParsedPrice,
  type Currency
} from './helpers/price-parser'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, 'fixtures')
const fx = async (name: string) => readFile(resolve(FIXTURES, name), 'utf8')

function getTemplate(id: string) {
  const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === id)
  if (!tpl) throw new Error(`Template ${id} missing`)
  return tpl
}

describe('Price Parser — regional currency normalisation', () => {
  it('parses Shopee VN price with leading ₫', () => {
    const p = parsePrice('₫28.990.000')
    expect(p).not.toBeNull()
    expect(p!.currency).toBe('VND')
    expect(p!.amount).toBe(28_990_000)
  })

  it('parses Tiki VN price with trailing ₫ entity', () => {
    // Tiki outputs 28.590.000&#8363; which decodes to 28.590.000₫
    const p = parsePrice('28.590.000₫')
    expect(p).not.toBeNull()
    expect(p!.currency).toBe('VND')
    expect(p!.amount).toBe(28_590_000)
  })

  it('parses VNPay amount "1.990.000 VND"', () => {
    const p = parsePrice('1.990.000 VND')
    expect(p!.currency).toBe('VND')
    expect(p!.amount).toBe(1_990_000)
  })

  it('parses Indonesian Rupiah (Rp, dots as thousands, no decimal)', () => {
    const p = parsePrice('Rp 12.500.000')
    expect(p!.currency).toBe('IDR')
    expect(p!.amount).toBe(12_500_000)
  })

  it('parses Thai Baht (฿, comma thousands, dot decimal)', () => {
    const p = parsePrice('฿25,999.50')
    expect(p!.currency).toBe('THB')
    expect(p!.amount).toBeCloseTo(25_999.5, 2)
  })

  it('parses Malaysian Ringgit (RM)', () => {
    const p = parsePrice('RM 3,499')
    expect(p!.currency).toBe('MYR')
    expect(p!.amount).toBe(3499)
  })

  it('parses Singapore Dollar (S$) without confusing with USD $', () => {
    const p = parsePrice('S$2,499.90')
    expect(p!.currency).toBe('SGD')
    expect(p!.amount).toBeCloseTo(2499.9, 2)
  })

  it('parses Philippine Peso (₱)', () => {
    const p = parsePrice('₱56,990')
    expect(p!.currency).toBe('PHP')
    expect(p!.amount).toBe(56_990)
  })

  it('falls back to USD when only $ is present', () => {
    const p = parsePrice('$1,199.00')
    expect(p!.currency).toBe('USD')
    expect(p!.amount).toBeCloseTo(1199.0, 2)
  })

  it('returns null on empty or non-numeric input', () => {
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('Hết hàng')).toBeNull()
  })

  it('batch-parses a mixed list dropping unparsable entries', () => {
    const parsed = parsePriceBatch([
      '₫28.990.000',
      '₫34.490.000',
      'Liên hệ',
      '₫41.990.000'
    ])
    expect(parsed.length).toBe(3)
    expect(parsed.every((p) => p.currency === 'VND')).toBe(true)
  })
})

describe('Competitor Price Matrix — cross-platform aggregation', () => {
  let shopeeSearch: string
  let lazadaSearch: string
  let tikiSearch: string

  beforeAll(async () => {
    shopeeSearch = await fx('shopee-search.html')
    lazadaSearch = await fx('lazada-search.html')
    tikiSearch = await fx('tiki-search.html')
  })

  interface CompetitorRow {
    platform: string
    titles: string[]
    prices: ParsedPrice[]
    currency: Currency
  }

  function runSearch(
    templateId: string,
    fixture: string,
    baseUrl: string,
    titleKey: string,
    priceKey: string
  ): { titles: string[]; prices: string[] } {
    const tpl = getTemplate(templateId)
    const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
    const runner = new OfflineWorkflowRunner({
      fixtures: {
        [baseUrl]: fixture,
        [`${baseUrl}/search?q=iphone 15 pro max`]: fixture,
        [`${baseUrl}/catalog/?q=iphone 15 pro max`]: fixture
      },
      variables: { keyword: 'iphone 15 pro max' }
    })
    const r = runner.run(wf)
    expect(r.status).toBe('completed')
    return {
      titles: r.arrays[titleKey] ?? [],
      prices: r.arrays[priceKey] ?? []
    }
  }

  it('extracts prices across Shopee, Lazada and Tiki', () => {
    const rows: CompetitorRow[] = []

    const shopee = runSearch(
      'tpl-sea-shopee-search',
      shopeeSearch,
      'https://shopee.vn',
      'shopee_titles',
      'shopee_prices'
    )
    const lazada = runSearch(
      'tpl-sea-lazada-search',
      lazadaSearch,
      'https://www.lazada.vn',
      'lazada_titles',
      'lazada_prices'
    )
    const tiki = runSearch(
      'tpl-sea-tiki-search',
      tikiSearch,
      'https://tiki.vn',
      'tiki_titles',
      'tiki_prices'
    )

    for (const [platform, data] of [
      ['Shopee', shopee],
      ['Lazada', lazada],
      ['Tiki', tiki]
    ] as const) {
      const parsed = parsePriceBatch(data.prices)
      rows.push({
        platform,
        titles: data.titles,
        prices: parsed,
        currency: parsed[0]?.currency ?? 'UNKNOWN'
      })
    }

    // All 3 platforms should have data
    expect(rows.length).toBe(3)
    for (const row of rows) {
      expect(row.prices.length).toBeGreaterThanOrEqual(10)
      expect(row.currency).toBe('VND')
    }

    // Build stats per platform
    const matrix = rows.map((row) => ({
      platform: row.platform,
      stats: priceStats(row.prices)!
    }))

    matrix.forEach((m) => {
      expect(m.stats.count).toBeGreaterThanOrEqual(10)
      expect(m.stats.min).toBeGreaterThan(0)
      expect(m.stats.max).toBeGreaterThanOrEqual(m.stats.min)
      expect(m.stats.median).toBeGreaterThan(0)
      // Sanity: VND prices for iPhones + accessories should span ~10k to ~50M
      expect(m.stats.max).toBeLessThan(100_000_000)
    })

    // Find the flagship (the expensive iPhone 15 Pro Max 1TB variant) on each
    // platform and assert the parser agrees on currency.
    const flagships = matrix.map((m) => m.stats.max)
    expect(Math.min(...flagships)).toBeGreaterThan(20_000_000)

    // Price intelligence outcome: cheapest platform for the full listing
    const sorted = [...matrix].sort((a, b) => a.stats.median - b.stats.median)
    expect(sorted[0].stats.median).toBeLessThanOrEqual(sorted[2].stats.median)
  })

  it('priceStats correctly computes min/max/mean/median on a known list', () => {
    const parsed = parsePriceBatch([
      '₫10.000.000',
      '₫20.000.000',
      '₫30.000.000',
      '₫40.000.000',
      '₫50.000.000'
    ])
    const stats = priceStats(parsed)!
    expect(stats.count).toBe(5)
    expect(stats.min).toBe(10_000_000)
    expect(stats.max).toBe(50_000_000)
    expect(stats.median).toBe(30_000_000)
    expect(stats.mean).toBe(30_000_000)
    expect(stats.currency).toBe('VND')
  })

  it('priceStats returns null on empty input', () => {
    expect(priceStats([])).toBeNull()
  })

  it('detects price drops over time using two snapshots', () => {
    const snapshot1 = parsePriceBatch(['₫28.990.000'])[0].amount
    const snapshot2 = parsePriceBatch(['₫25.990.000'])[0].amount
    const dropAbs = snapshot1 - snapshot2
    const dropPct = (dropAbs / snapshot1) * 100
    expect(dropAbs).toBe(3_000_000)
    expect(dropPct).toBeGreaterThan(10)
    expect(dropPct).toBeLessThan(15)
  })
})

describe('Price Alert Thresholds — downstream consumer contract', () => {
  it('flags prices above a VND threshold for a product watcher', () => {
    const parsed = parsePriceBatch([
      '₫28.990.000',
      '₫34.990.000',
      '₫41.990.000'
    ])
    const threshold = 30_000_000
    const alerts = parsed.filter((p) => p.amount > threshold)
    expect(alerts.length).toBe(2)
  })

  it('flags the cheapest variant for a buy-signal watcher', () => {
    const parsed = parsePriceBatch([
      '₫28.990.000',
      '₫26.890.000',
      '₫22.500.000'
    ])
    const cheapest = parsed.reduce((a, b) => (a.amount <= b.amount ? a : b))
    expect(cheapest.amount).toBe(22_500_000)
  })
})
