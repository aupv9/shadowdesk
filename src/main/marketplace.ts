/**
 * Phase 15.A — Workflow Marketplace
 *
 * Provides a local-first marketplace backed by a bundled JSON catalog.
 * In production this catalog would be fetched from a remote CDN; for now it
 * is shipped with the app and can be supplemented with user-installed items.
 *
 * "Install" = clone the workflow steps into the local DB (same as
 * templates:createFromTemplate but from a marketplace entry).
 */

import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'
import type { MarketplaceWorkflow, MarketplaceCategory } from '../shared/types'

// ── Built-in catalog ──────────────────────────────────────────────────────────

const CATALOG: MarketplaceWorkflow[] = [
  {
    id: 'mkt-social-warmup',
    name: 'Social Account Warm-up',
    description: 'Gradually builds account history — visits feed, likes posts, follows users over several sessions.',
    author: 'ShadowDesk Team',
    category: 'social',
    tags: ['warmup', 'social', 'facebook', 'instagram'],
    stars: 4.8,
    downloads: 1240,
    version: '1.2.0',
    publishedAt: '2025-11-01',
    steps: [
      { id: 's1', type: 'navigate', params: { url: 'https://facebook.com' } },
      { id: 's2', type: 'wait', params: { ms: 2000 } },
      { id: 's3', type: 'scroll', params: { x: 0, y: 400 } },
      { id: 's4', type: 'wait', params: { ms: 1500 } },
      { id: 's5', type: 'scroll', params: { x: 0, y: 800 } }
    ]
  },
  {
    id: 'mkt-ecom-price-monitor',
    name: 'E-commerce Price Monitor',
    description: 'Scrapes product prices from a list of URLs and exports them to a CSV variable.',
    author: 'community_dev_42',
    category: 'ecommerce',
    tags: ['price', 'scraping', 'shopee', 'lazada', 'monitor'],
    stars: 4.5,
    downloads: 870,
    version: '2.0.1',
    publishedAt: '2025-12-15',
    steps: [
      { id: 's1', type: 'navigate', params: { url: '{{url}}' } },
      { id: 's2', type: 'wait', params: { ms: 1000 } },
      { id: 's3', type: 'extract', params: { selector: '.price', variable: 'price' } }
    ]
  },
  {
    id: 'mkt-captcha-bypass-login',
    name: 'Captcha-Bypass Login',
    description: 'Login flow with automatic captcha solving via configured provider.',
    author: 'ShadowDesk Team',
    category: 'utility',
    tags: ['login', 'captcha', 'authentication'],
    stars: 4.7,
    downloads: 2100,
    version: '1.0.3',
    publishedAt: '2026-01-10',
    steps: [
      { id: 's1', type: 'navigate', params: { url: '{{loginUrl}}' } },
      { id: 's2', type: 'type', params: { selector: '#username', text: '{{username}}' } },
      { id: 's3', type: 'type', params: { selector: '#password', text: '{{password}}' } },
      { id: 's4', type: 'solveCaptcha', params: {} },
      { id: 's5', type: 'click', params: { selector: 'button[type=submit]' } },
      { id: 's6', type: 'waitForNavigation', params: {} }
    ]
  },
  {
    id: 'mkt-shopee-flash-deal',
    name: 'Shopee Flash Deal Sniper',
    description: 'Waits for flash sale start time, then adds item to cart and checks out instantly.',
    author: 'vn_seller_tools',
    category: 'ecommerce',
    tags: ['shopee', 'flash-sale', 'checkout', 'vietnam'],
    stars: 4.9,
    downloads: 3400,
    version: '3.1.0',
    publishedAt: '2026-02-05',
    steps: [
      { id: 's1', type: 'navigate', params: { url: '{{productUrl}}' } },
      { id: 's2', type: 'wait', params: { ms: '{{msUntilSale}}' } },
      { id: 's3', type: 'click', params: { selector: '.btn-buy-now' } },
      { id: 's4', type: 'wait', params: { ms: 500 } },
      { id: 's5', type: 'click', params: { selector: '.checkout-btn' } }
    ]
  },
  {
    id: 'mkt-linkedin-outreach',
    name: 'LinkedIn Connection Outreach',
    description: 'Sends personalized connection requests to a list of LinkedIn profiles.',
    author: 'b2b_growth_hacks',
    category: 'social',
    tags: ['linkedin', 'outreach', 'b2b', 'connections'],
    stars: 4.3,
    downloads: 650,
    version: '1.1.0',
    publishedAt: '2026-01-28',
    steps: [
      { id: 's1', type: 'navigate', params: { url: '{{profileUrl}}' } },
      { id: 's2', type: 'wait', params: { ms: 1200 } },
      { id: 's3', type: 'click', params: { selector: '.connect-button' } },
      { id: 's4', type: 'type', params: { selector: '.note-textarea', text: '{{message}}' } },
      { id: 's5', type: 'click', params: { selector: '.send-now' } }
    ]
  },
  {
    id: 'mkt-detection-audit',
    name: 'Weekly Detection Audit',
    description: 'Runs a detection test on all profiles and flags any that score below 70.',
    author: 'ShadowDesk Team',
    category: 'testing',
    tags: ['detection', 'audit', 'schedule', 'monitoring'],
    stars: 4.6,
    downloads: 980,
    version: '1.0.0',
    publishedAt: '2025-10-20',
    steps: [
      { id: 's1', type: 'runDetectionTest', params: { profileId: '{{profileId}}' } },
      { id: 's2', type: 'condition', params: { variable: 'lastDetectionScore', operator: '<', value: 70 } }
    ]
  }
]

// ── MarketplaceManager ────────────────────────────────────────────────────────

export class MarketplaceManager {
  private static instance: MarketplaceManager | null = null
  /** Allow tests to override the catalog. */
  public catalog: MarketplaceWorkflow[] = CATALOG

  static getInstance(): MarketplaceManager {
    if (!this.instance) this.instance = new MarketplaceManager()
    return this.instance
  }

  static _reset(): MarketplaceManager {
    this.instance = new MarketplaceManager()
    return this.instance
  }

  list(opts: { category?: MarketplaceCategory; q?: string } = {}): MarketplaceWorkflow[] {
    let results = [...this.catalog]
    if (opts.category) results = results.filter((w) => w.category === opts.category)
    if (opts.q) {
      const q = opts.q.toLowerCase()
      results = results.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.tags.some((t) => t.includes(q))
      )
    }
    return results
  }

  get(id: string): MarketplaceWorkflow | null {
    return this.catalog.find((w) => w.id === id) ?? null
  }

  /**
   * Install a marketplace workflow into the local DB.
   * Returns the newly created workflow row.
   */
  install(id: string, customName?: string): any {
    const entry = this.get(id)
    if (!entry) throw new Error(`Marketplace workflow "${id}" not found`)

    const db = Database.getInstance()
    const newId = uuidv4()
    const steps = JSON.parse(JSON.stringify(entry.steps ?? [])).map((s: any) => ({
      ...s,
      id: uuidv4()
    }))
    db.createWorkflow({
      id: newId,
      name: customName ?? entry.name,
      description: `[Marketplace] ${entry.description}`,
      steps
    })
    const row = db.getWorkflow(newId)
    return { ...row, steps: JSON.parse(row.steps) }
  }
}

export function getMarketplace(): MarketplaceManager {
  return MarketplaceManager.getInstance()
}
