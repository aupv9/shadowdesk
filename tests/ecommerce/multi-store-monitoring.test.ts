/**
 * E-Commerce Operations — Pillar 1: Multi-Store Monitoring
 *
 * Validates that for each of the 6 SEA marketplaces shipped in the workflow
 * catalog, the built-in scraping template:
 *
 *   1) Points at a URL we have a fixture for (navigate resolves)
 *   2) Every `waitForSelector` / `click` / `hover` selector exists in the fixture DOM
 *   3) Every `extractText` step with `all:true` yields a non-empty array
 *   4) Every scalar `extractText` with `saveAs` populates a string variable
 *   5) The final variable set matches the shape the downstream monitoring
 *      dashboard would expect
 *
 * This is a CONTRACT test against the live workflow-templates.ts registry,
 * so if a template is ever rewritten with new selectors the fixture has to
 * be updated in lock-step — preventing silent regressions.
 *
 * Covers:
 *   - Shopee VN (search)
 *   - Lazada VN (search, flash sale)
 *   - TikTok Shop (feed, search)
 *   - Tiki VN (search, flash deal)
 *   - GrabFood VN (restaurant browse)
 *   - VNPay (sandbox — structural check only, no extraction)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { WORKFLOW_TEMPLATES } from '../../src/main/workflow-templates'
import { OfflineWorkflowRunner, defineWorkflow } from './helpers/offline-workflow-runner'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES = resolve(__dirname, 'fixtures')

async function fx(name: string): Promise<string> {
  return readFile(resolve(FIXTURES, name), 'utf8')
}

function getTemplate(id: string) {
  const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === id)
  if (!tpl) throw new Error(`Template not found: ${id}`)
  return tpl
}

describe('Multi-Store Monitoring — contract tests against workflow-templates.ts', () => {
  let fixtures: Record<string, Record<string, string>>

  beforeAll(async () => {
    fixtures = {
      shopeeSearch: {
        'https://shopee.vn':                    await fx('shopee-search.html'),
        'https://shopee.vn/search?keyword=iphone 15 pro max': await fx('shopee-search.html')
      },
      shopeeProduct: {
        'https://shopee.vn/iphone-i.123.4567890': await fx('shopee-product.html')
      },
      lazadaSearch: {
        'https://www.lazada.vn':                 await fx('lazada-search.html'),
        'https://www.lazada.vn/catalog/?q=iphone 15 pro max': await fx('lazada-search.html')
      },
      lazadaProduct: {
        'https://www.lazada.vn/products/iphone-i401234567.html': await fx('lazada-product.html')
      },
      lazadaFlash: {
        'https://www.lazada.vn/shop-flash-sale': await fx('lazada-flash-sale.html')
      },
      tiktokFeed: {
        'https://shop.tiktok.com': await fx('tiktok-shop-feed.html')
      },
      tikiSearch: {
        'https://tiki.vn':                       await fx('tiki-search.html'),
        'https://tiki.vn/search?q=iphone 15 pro max': await fx('tiki-search.html')
      },
      tikiFlash: {
        'https://tiki.vn/khuyen-mai-hot':        await fx('tiki-flash-deal.html')
      },
      grabFood: {
        'https://food.grab.com/vn/vi':           await fx('grabfood-restaurants.html')
      }
    }
  })

  // ── Shopee ─────────────────────────────────────────────────────────────────

  describe('Shopee VN', () => {
    it('tpl-sea-shopee-search extracts ≥10 titles + prices', () => {
      const tpl = getTemplate('tpl-sea-shopee-search')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.shopeeSearch,
        variables: { keyword: 'iphone 15 pro max' }
      })
      const result = runner.run(wf)

      expect(result.status).toBe('completed')
      expect(result.arrays.shopee_titles).toBeDefined()
      expect(result.arrays.shopee_titles.length).toBeGreaterThanOrEqual(10)
      expect(result.arrays.shopee_prices).toBeDefined()
      expect(result.arrays.shopee_prices.length).toBeGreaterThanOrEqual(10)
      // Every title should be non-empty
      result.arrays.shopee_titles.forEach((t) => expect(t.length).toBeGreaterThan(0))
      // Every price should look like VND
      result.arrays.shopee_prices.forEach((p) => expect(p).toMatch(/₫/))
    })

    it('tpl-sea-shopee-scrape-product extracts title, price, seller, rating', () => {
      const tpl = getTemplate('tpl-sea-shopee-scrape-product')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.shopeeProduct,
        variables: { productUrl: 'https://shopee.vn/iphone-i.123.4567890' }
      })
      const result = runner.run(wf)

      expect(result.status).toBe('completed')
      expect(result.scalars.product_title).toMatch(/iPhone 15 Pro Max/i)
      expect(result.scalars.product_price).toMatch(/₫/)
      expect(result.scalars.seller_name.length).toBeGreaterThan(0)
      expect(result.scalars.rating).toMatch(/^\d/)
    })

    it('tpl-sea-shopee-add-to-cart finds the buy-box button', () => {
      const tpl = getTemplate('tpl-sea-shopee-add-to-cart')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.shopeeProduct,
        variables: { productUrl: 'https://shopee.vn/iphone-i.123.4567890' }
      })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      const clickStep = result.stepResults.find((s) => s.action === 'click')
      expect(clickStep?.success).toBe(true)
    })
  })

  // ── Lazada ─────────────────────────────────────────────────────────────────

  describe('Lazada VN', () => {
    it('tpl-sea-lazada-search extracts ≥10 products', () => {
      const tpl = getTemplate('tpl-sea-lazada-search')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.lazadaSearch,
        variables: { keyword: 'iphone 15 pro max' }
      })
      const result = runner.run(wf)

      expect(result.status).toBe('completed')
      expect(result.arrays.lazada_titles.length).toBeGreaterThanOrEqual(10)
      expect(result.arrays.lazada_prices.length).toBeGreaterThanOrEqual(10)
      // Titles and prices should be aligned (same cardinality)
      expect(result.arrays.lazada_titles.length).toBe(result.arrays.lazada_prices.length)
    })

    it('tpl-sea-lazada-scrape-product extracts all product fields', () => {
      const tpl = getTemplate('tpl-sea-lazada-scrape-product')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.lazadaProduct,
        variables: { productUrl: 'https://www.lazada.vn/products/iphone-i401234567.html' }
      })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      expect(result.scalars.lazada_title).toContain('iPhone')
      expect(result.scalars.lazada_price).toMatch(/₫/)
      expect(result.scalars.lazada_rating).toMatch(/^\d/)
    })

    it('tpl-sea-lazada-flash-sale extracts deal titles, prices and countdown', () => {
      const tpl = getTemplate('tpl-sea-lazada-flash-sale')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({ fixtures: fixtures.lazadaFlash })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      expect(result.scalars.flash_countdown).toMatch(/\d/)
      expect(result.arrays.flash_titles.length).toBeGreaterThanOrEqual(5)
      expect(result.arrays.flash_prices.length).toBe(result.arrays.flash_titles.length)
    })
  })

  // ── TikTok Shop ────────────────────────────────────────────────────────────

  describe('TikTok Shop VN', () => {
    it('tpl-sea-tiktok-shop-browse extracts ≥10 product titles and prices', () => {
      const tpl = getTemplate('tpl-sea-tiktok-shop-browse')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({ fixtures: fixtures.tiktokFeed })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      expect(result.arrays.tiktok_titles.length).toBeGreaterThanOrEqual(10)
      expect(result.arrays.tiktok_prices.length).toBe(result.arrays.tiktok_titles.length)
    })

    it('tpl-sea-tiktok-shop-search finds the search input and extracts results', () => {
      const tpl = getTemplate('tpl-sea-tiktok-shop-search')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.tiktokFeed,
        variables: { keyword: 'son môi' }
      })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      expect(result.arrays.search_titles.length).toBeGreaterThanOrEqual(10)
    })
  })

  // ── Tiki ───────────────────────────────────────────────────────────────────

  describe('Tiki VN', () => {
    it('tpl-sea-tiki-search extracts product titles and prices', () => {
      const tpl = getTemplate('tpl-sea-tiki-search')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.tikiSearch,
        variables: { keyword: 'iphone 15 pro max' }
      })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      expect(result.arrays.tiki_titles.length).toBeGreaterThanOrEqual(10)
      expect(result.arrays.tiki_prices.length).toBe(result.arrays.tiki_titles.length)
    })

    it('tpl-sea-tiki-flash-deal extracts deal titles and stock badges', () => {
      const tpl = getTemplate('tpl-sea-tiki-flash-deal')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({ fixtures: fixtures.tikiFlash })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      expect(result.arrays.flash_titles.length).toBeGreaterThanOrEqual(5)
      expect(result.arrays.stock_levels.length).toBeGreaterThanOrEqual(5)
    })
  })

  // ── GrabFood ───────────────────────────────────────────────────────────────

  describe('GrabFood VN', () => {
    it('tpl-sea-grab-food-browse extracts restaurant names for a delivery address', () => {
      const tpl = getTemplate('tpl-sea-grab-food-browse')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: fixtures.grabFood,
        variables: { deliveryAddress: 'Nguyen Hue Walking Street, Ho Chi Minh City' }
      })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      expect(result.arrays.restaurant_names.length).toBeGreaterThanOrEqual(5)
      // Every restaurant name should be non-empty
      result.arrays.restaurant_names.forEach((n) => expect(n.length).toBeGreaterThan(0))
    })
  })

  // ── VNPay (structural only — no data extraction, this is payment UI) ───────

  describe('VNPay sandbox', () => {
    it('tpl-sea-vnpay-checkout finds bank grid, card fields and submit button', async () => {
      const tpl = getTemplate('tpl-sea-vnpay-checkout')
      const wf = defineWorkflow(tpl.id, tpl.name, tpl.steps)
      const runner = new OfflineWorkflowRunner({
        fixtures: {
          'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html': await fx('vnpay-checkout.html')
        },
        variables: {
          vnpayCheckoutUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
        }
      })
      const result = runner.run(wf)
      expect(result.status).toBe('completed')
      // All waitForSelector steps should have passed — that's the contract
      const waits = result.stepResults.filter((s) => s.action === 'waitForSelector')
      expect(waits.length).toBeGreaterThan(0)
      waits.forEach((s) => expect(s.success).toBe(true))
    })
  })

  // ── Aggregation sanity: how many templates cover e-commerce monitoring? ────

  describe('catalog coverage', () => {
    it('ships ≥10 SEA e-commerce/payment templates', () => {
      const seaCategories = ['sea-ecommerce', 'sea-social', 'sea-payments']
      const count = WORKFLOW_TEMPLATES.filter((t) => seaCategories.includes(t.category as string)).length
      expect(count).toBeGreaterThanOrEqual(10)
    })

    it('every SEA template declares platform + region + tags', () => {
      const seaTemplates = WORKFLOW_TEMPLATES.filter((t) =>
        (t.category as string).startsWith('sea-')
      )
      for (const tpl of seaTemplates) {
        expect(tpl.platform, `${tpl.id} missing platform`).toBeTruthy()
        expect(tpl.region, `${tpl.id} missing region`).toBeTruthy()
        expect(Array.isArray(tpl.tags), `${tpl.id} missing tags`).toBe(true)
      }
    })
  })
})
