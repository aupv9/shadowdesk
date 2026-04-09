/**
 * E-Commerce Operations — Pillar 3: Inventory Scraping
 *
 * Validates that product-page workflows correctly detect three stock states
 * across the fixture set:
 *
 *   1) IN-STOCK       — shopee-product.html       → "54 sản phẩm có sẵn"
 *   2) LOW-STOCK      — shopee-product-low-stock  → "Chỉ còn 3 sản phẩm"
 *   3) OUT-OF-STOCK   — shopee-product-oos        → "Hết hàng" + disabled btn
 *
 * The tests also exercise Tiki's flash-deal stock badges (which use a
 * different selector set), and verify that a downstream "inventory tracker"
 * feature can ingest these signals into a consistent state machine.
 *
 * The test extracts stock fields via the HtmlDoc helper directly rather than
 * through a workflow template — the existing SEA templates don't extract
 * stock yet, so this layer proves the DOM shape is stable and the selectors
 * a future workflow WOULD use are well-defined.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { HtmlDoc } from './helpers/html-matcher'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, 'fixtures')
const fx = async (name: string) => readFile(resolve(FIXTURES, name), 'utf8')

export type StockState = 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown'

export interface InventoryReading {
  platform: string
  productTitle: string | null
  rawStockText: string | null
  quantity: number | null
  state: StockState
}

/**
 * Canonical inventory classifier. Downstream features (alerts, dashboards,
 * forecasting) build on this — so the test suite doubles as the contract.
 */
function classifyStock(rawText: string | null): {
  state: StockState
  quantity: number | null
} {
  if (!rawText) return { state: 'unknown', quantity: null }
  const lower = rawText.toLowerCase()
  if (
    lower.includes('hết hàng') ||
    lower.includes('out of stock') ||
    lower.includes('sold out') ||
    lower.includes('hết sạch')
  ) {
    return { state: 'out-of-stock', quantity: 0 }
  }
  // Extract first integer we can find
  const match = rawText.match(/(\d+(?:[.,]\d+)*)/)
  if (!match) return { state: 'unknown', quantity: null }
  const quantity = parseInt(match[1].replace(/[.,]/g, ''), 10)
  if (!Number.isFinite(quantity)) return { state: 'unknown', quantity: null }
  if (quantity === 0) return { state: 'out-of-stock', quantity: 0 }
  if (quantity <= 5) return { state: 'low-stock', quantity }
  return { state: 'in-stock', quantity }
}

describe('Inventory Scraping — Shopee stock state classification', () => {
  let inStockHtml: string
  let lowStockHtml: string
  let oosHtml: string

  beforeAll(async () => {
    inStockHtml = await fx('shopee-product.html')
    lowStockHtml = await fx('shopee-product-low-stock.html')
    oosHtml = await fx('shopee-product-oos.html')
  })

  it('detects IN-STOCK state with a concrete quantity', () => {
    const doc = new HtmlDoc(inStockHtml)
    const title = doc.extract('div._44qnta, div.vR6K3w')
    // Stock value sits in .stock-value. We don't hit an engine selector —
    // this is a stability check on the DOM shape we ship in the fixture.
    const stockText = doc.extract('span.stock-value')
    const { state, quantity } = classifyStock(stockText)

    const reading: InventoryReading = {
      platform: 'shopee',
      productTitle: title,
      rawStockText: stockText,
      quantity,
      state
    }

    expect(reading.state).toBe('in-stock')
    expect(reading.quantity).toBe(54)
    expect(reading.productTitle).toContain('iPhone 15 Pro Max')
  })

  it('detects LOW-STOCK state when quantity ≤ 5', () => {
    const doc = new HtmlDoc(lowStockHtml)
    const stockText = doc.extract('span.stock-value')
    const { state, quantity } = classifyStock(stockText)
    expect(state).toBe('low-stock')
    expect(quantity).toBe(3)
  })

  it('detects OUT-OF-STOCK state when text says "Hết hàng"', () => {
    const doc = new HtmlDoc(oosHtml)
    const stockText = doc.extract('span.stock-value')
    const { state, quantity } = classifyStock(stockText)
    expect(state).toBe('out-of-stock')
    expect(quantity).toBe(0)

    // Buy button should also be disabled — a secondary signal the dashboard
    // can cross-check.
    const btn = doc.query('button.btn-disabled')
    expect(btn).not.toBeNull()
  })

  it('classifier handles null / empty stock text as unknown', () => {
    expect(classifyStock(null).state).toBe('unknown')
    expect(classifyStock('').state).toBe('unknown')
    expect(classifyStock('Liên hệ người bán').state).toBe('unknown')
  })
})

describe('Inventory Scraping — Tiki flash-deal badges', () => {
  let flashHtml: string
  beforeAll(async () => { flashHtml = await fx('tiki-flash-deal.html') })

  it('extracts stock badges from ≥5 deals', () => {
    const doc = new HtmlDoc(flashHtml)
    const stocks = doc.extractAll('div.progress-text, span.stock')
    expect(stocks.length).toBeGreaterThanOrEqual(5)
  })

  it('classifies the "Hết hàng" deal as out-of-stock', () => {
    const doc = new HtmlDoc(flashHtml)
    // Find the stock span with "Hết hàng"
    const all = doc.extractAll('span.stock')
    const outOfStockCount = all.filter((s) => classifyStock(s).state === 'out-of-stock').length
    expect(outOfStockCount).toBeGreaterThanOrEqual(1)
  })

  it('classifies "Còn 5 sản phẩm" and below as low-stock', () => {
    const doc = new HtmlDoc(flashHtml)
    const all = doc.extractAll('span.stock')
    const lowStockCount = all.filter((s) => classifyStock(s).state === 'low-stock').length
    expect(lowStockCount).toBeGreaterThanOrEqual(1)
  })

  it('builds a tri-state inventory report from the whole page', () => {
    const doc = new HtmlDoc(flashHtml)
    const names = doc.extractAll('div.name')
    const stocks = doc.extractAll('span.stock')
    const readings = names.map((name, i) => {
      const stock = stocks[i] ?? null
      const { state, quantity } = classifyStock(stock)
      return { name, stock, state, quantity }
    })

    expect(readings.length).toBeGreaterThanOrEqual(5)

    const states = new Set(readings.map((r) => r.state))
    // The fixture is intentionally crafted to contain at least 2 of the 3
    // possible stock states so the dashboard can render a chart.
    expect(states.size).toBeGreaterThanOrEqual(2)
  })
})

describe('Inventory Scraping — cross-platform report aggregation', () => {
  it('summarises readings into counters consumable by a dashboard', async () => {
    const docs = [
      new HtmlDoc(await fx('shopee-product.html')),
      new HtmlDoc(await fx('shopee-product-low-stock.html')),
      new HtmlDoc(await fx('shopee-product-oos.html'))
    ]

    const readings: StockState[] = docs.map((doc) => {
      const text = doc.extract('span.stock-value')
      return classifyStock(text).state
    })

    const summary = readings.reduce<Record<StockState, number>>(
      (acc, s) => { acc[s] = (acc[s] ?? 0) + 1; return acc },
      { 'in-stock': 0, 'low-stock': 0, 'out-of-stock': 0, unknown: 0 }
    )

    expect(summary['in-stock']).toBe(1)
    expect(summary['low-stock']).toBe(1)
    expect(summary['out-of-stock']).toBe(1)
    expect(summary.unknown).toBe(0)
  })
})
