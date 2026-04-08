/**
 * Phase 17 — SEA Platform Templates
 *
 * Static registry of the major South-East-Asia e-commerce, payment and social
 * platforms Ghost Browser targets out of the box:
 *
 *   • Shopee          — regional e-commerce leader (VN, TH, ID, MY, PH, SG)
 *   • Lazada          — Alibaba-owned regional marketplace
 *   • TikTok Shop     — ByteDance live-commerce
 *   • Tiki            — Vietnam-local marketplace
 *   • VNPay           — Vietnam payment gateway (QR, bank redirect)
 *   • Grab            — Ride-hail + food + GrabPay wallet
 *
 * Each platform exposes:
 *   - Regional URL overrides
 *   - Recommended fingerprint preset + behaviour archetype
 *   - Common DOM selectors used by the workflow templates
 *   - Anti-bot / detection notes so users understand what they're up against
 *   - A list of `templateIds` that target the platform
 *
 * The catalog is static — shipped with the binary and read via IPC by the
 * renderer's `SEAPlatforms` section.  No database persistence is needed.
 */

import type { SeaPlatform, WorkflowTemplate } from '../shared/types'
import { WORKFLOW_TEMPLATES } from './workflow-templates'

export const SEA_PLATFORMS: SeaPlatform[] = [
  {
    id: 'shopee',
    name: 'Shopee',
    description:
      'Regional e-commerce leader across SEA. Heavy anti-bot (SLARDAR, RiskControl), mobile-first UX.',
    kind: 'ecommerce',
    regions: ['VN', 'TH', 'ID', 'MY', 'PH', 'SG'],
    currencies: ['VND', 'THB', 'IDR', 'MYR', 'PHP', 'SGD'],
    baseUrl: 'https://shopee.vn',
    regionUrls: {
      VN: 'https://shopee.vn',
      TH: 'https://shopee.co.th',
      ID: 'https://shopee.co.id',
      MY: 'https://shopee.com.my',
      PH: 'https://shopee.ph',
      SG: 'https://shopee.sg'
    },
    recommendedPresets: ['android-samsung-chrome120', 'android-pixel-chrome121', 'win11-chrome121'],
    recommendedArchetypes: ['sea-mobile-shopper', 'young-social'],
    selectors: {
      searchInput: 'input.shopee-searchbar-input__input',
      searchButton: 'button.btn.btn-solid-primary.btn--s.btn--inline.shopee-searchbar__search-button',
      productCard: 'div.shopee-search-item-result__item',
      productTitle: 'div[data-sqe="name"]',
      productPrice: 'div.ZEgDH9',
      addToCart: 'button.btn.btn-solid-primary--oVUmB.btn--l--vf7DT.btn--inline._6HeAm.stardust-button',
      loginEmail: 'input[name="loginKey"]',
      loginPassword: 'input[name="password"]',
      loginSubmit: 'button.wyhvVD._1EApiB.L-VL8Q.cepDQ1._7w24N1'
    },
    notes: [
      'Shopee runs SLARDAR behavioural analytics — use human-like typing cadence + mouse jitter.',
      'Login triggers CAPTCHA after 2-3 failed attempts per IP; pair with rotating residential proxy.',
      'Product listings are lazy-loaded — scroll slowly and waitForSelector before scraping.'
    ],
    icon: 'ShoppingBag',
    accent: 'text-orange-400',
    templateIds: [
      'tpl-sea-shopee-search',
      'tpl-sea-shopee-scrape-product',
      'tpl-sea-shopee-add-to-cart',
      'tpl-sea-shopee-login'
    ]
  },
  {
    id: 'lazada',
    name: 'Lazada',
    description:
      'Alibaba-owned marketplace. Strong in TH, ID, PH, MY, SG, VN. Uses Akamai Bot Manager.',
    kind: 'ecommerce',
    regions: ['TH', 'ID', 'MY', 'PH', 'SG', 'VN'],
    currencies: ['THB', 'IDR', 'MYR', 'PHP', 'SGD', 'VND'],
    baseUrl: 'https://www.lazada.vn',
    regionUrls: {
      VN: 'https://www.lazada.vn',
      TH: 'https://www.lazada.co.th',
      ID: 'https://www.lazada.co.id',
      MY: 'https://www.lazada.com.my',
      PH: 'https://www.lazada.com.ph',
      SG: 'https://www.lazada.sg'
    },
    recommendedPresets: ['win10-chrome120', 'android-oppo-chrome120'],
    recommendedArchetypes: ['sea-mobile-shopper', 'business-professional'],
    selectors: {
      searchInput: 'input[type="search"]#q',
      searchButton: 'a.search-box__button--1oH7',
      productCard: 'div[data-qa-locator="product-item"]',
      productTitle: 'div.RfADt a',
      productPrice: 'div.aBrP0 span.ooOxS',
      addToCart: 'button.pdp-button.pdp-button_theme_orange.pdp-button_type_text.pdp-mod-product-badge-ref',
      loginEmail: 'input[type="email"]',
      loginPassword: 'input[type="password"]',
      loginSubmit: 'button[type="submit"]'
    },
    notes: [
      'Akamai Bot Manager fingerprints TLS + canvas — Ghost Browser Layer 1 + Layer 4 patches recommended.',
      'Lazada shows a slider CAPTCHA on suspicious sessions — use hoverJitter + variable scroll speed.',
      'Product pages set a _m_h5_tk cookie that must be preserved across steps.'
    ],
    icon: 'Store',
    accent: 'text-sky-400',
    templateIds: [
      'tpl-sea-lazada-search',
      'tpl-sea-lazada-scrape-product',
      'tpl-sea-lazada-flash-sale'
    ]
  },
  {
    id: 'tiktok-shop',
    name: 'TikTok Shop',
    description:
      'ByteDance live-commerce platform. Heavy device fingerprinting via msToken + s_v_web_id cookies.',
    kind: 'ecommerce',
    regions: ['VN', 'TH', 'ID', 'MY', 'PH', 'SG'],
    currencies: ['VND', 'THB', 'IDR', 'MYR', 'PHP', 'SGD'],
    baseUrl: 'https://shop.tiktok.com',
    regionUrls: {
      VN: 'https://shop.tiktok.com/@vn',
      TH: 'https://shop.tiktok.com/@th',
      ID: 'https://shop.tiktok.com/@id'
    },
    recommendedPresets: ['android-pixel-chrome121', 'ios-iphone15-safari17'],
    recommendedArchetypes: ['young-social', 'sea-live-commerce-viewer'],
    selectors: {
      searchInput: 'input[data-e2e="search-user-input"]',
      searchButton: 'button[data-e2e="search-box-button"]',
      productCard: 'div[data-e2e="product-card"]',
      productTitle: 'a[data-e2e="product-card-title"]',
      productPrice: 'span[data-e2e="product-card-price"]',
      addToCart: 'button[data-e2e="add-to-cart"]',
      liveStream: 'div[data-e2e="live-card"]'
    },
    notes: [
      'TikTok Shop generates msToken on every page load — must reload between purchases to avoid replay.',
      'Live-stream pages use websockets for chat — do not block network.',
      'Regional geofencing is strict: use a proxy in the same country as the TikTok Shop region.',
      'Device fingerprint includes canvas hash + WebGL vendor — enable Phase 8 advanced patches.'
    ],
    icon: 'Video',
    accent: 'text-pink-400',
    templateIds: [
      'tpl-sea-tiktok-shop-browse',
      'tpl-sea-tiktok-shop-search',
      'tpl-sea-tiktok-shop-live-scrape'
    ]
  },
  {
    id: 'tiki',
    name: 'Tiki',
    description:
      'Vietnam-local marketplace (think Amazon of Vietnam). Lighter bot defence, good for testing.',
    kind: 'ecommerce',
    regions: ['VN'],
    currencies: ['VND'],
    baseUrl: 'https://tiki.vn',
    recommendedPresets: ['win10-chrome120', 'android-samsung-chrome120'],
    recommendedArchetypes: ['sea-mobile-shopper', 'casual-browser'],
    selectors: {
      searchInput: 'input[data-view-id="main_search_form_input"]',
      searchButton: 'button[data-view-id="main_search_form_button"]',
      productCard: 'a.product-item',
      productTitle: 'div.name h3',
      productPrice: 'div.price-discount__price',
      addToCart: 'button.styles__Button-sc-143954l-0'
    },
    notes: [
      'Tiki uses GraphQL — intercept /api/v2/products calls for structured JSON scraping.',
      'Prices in VND — format with space separator (e.g. "199 000 ₫"), parse carefully.'
    ],
    icon: 'Package',
    accent: 'text-blue-400',
    templateIds: ['tpl-sea-tiki-search', 'tpl-sea-tiki-flash-deal']
  },
  {
    id: 'vnpay',
    name: 'VNPay',
    description:
      'Vietnam bank-redirect + QR payment gateway. Used by ~40 Vietnamese banks for checkout.',
    kind: 'payment',
    regions: ['VN'],
    currencies: ['VND'],
    baseUrl: 'https://sandbox.vnpayment.vn',
    regionUrls: {
      VN: 'https://pay.vnpay.vn'
    },
    recommendedPresets: ['win10-chrome120', 'win11-chrome121'],
    recommendedArchetypes: ['business-professional', 'cautious-reader'],
    selectors: {
      bankGrid: 'div.bank-list',
      bankItem: 'div.bank-item',
      cardNumber: 'input[name="cardNumber"]',
      cardHolder: 'input[name="cardHolder"]',
      cardExpiry: 'input[name="issueDate"]',
      otpInput: 'input[name="otpvalue"]',
      submitButton: 'button.btn-pay'
    },
    notes: [
      'VNPay checkout is sandbox-testable at https://sandbox.vnpayment.vn — never use real cards in automation.',
      'OTP step requires a callback — use Ghost Browser credential vault to inject test OTP in sandbox mode.',
      'Session expires after 15 minutes — keep workflows under that timeout.'
    ],
    icon: 'CreditCard',
    accent: 'text-emerald-400',
    templateIds: ['tpl-sea-vnpay-checkout', 'tpl-sea-vnpay-bank-redirect']
  },
  {
    id: 'grab',
    name: 'Grab',
    description:
      'SEA super-app — ride-hail, food delivery, GrabPay wallet. Active across VN, TH, ID, MY, PH, SG.',
    kind: 'ride-hail',
    regions: ['VN', 'TH', 'ID', 'MY', 'PH', 'SG'],
    currencies: ['VND', 'THB', 'IDR', 'MYR', 'PHP', 'SGD'],
    baseUrl: 'https://food.grab.com',
    regionUrls: {
      VN: 'https://food.grab.com/vn/vi',
      TH: 'https://food.grab.com/th/th',
      ID: 'https://food.grab.com/id/id',
      SG: 'https://food.grab.com/sg/en'
    },
    recommendedPresets: ['android-pixel-chrome121', 'ios-iphone14-safari17'],
    recommendedArchetypes: ['sea-mobile-shopper', 'mobile-user'],
    selectors: {
      locationInput: 'input[placeholder*="delivery address"]',
      restaurantCard: 'a[data-testid="restaurant-card"]',
      menuItem: 'div[data-testid="menu-item"]',
      addToCart: 'button[data-testid="add-to-cart"]'
    },
    notes: [
      'Grab requires a delivery address before showing restaurants — first step must set location.',
      'Mobile-only UX — use Android or iOS fingerprint preset for realistic traffic.',
      'GrabPay wallet flows require phone OTP — not suitable for fully automated runs.'
    ],
    icon: 'Car',
    accent: 'text-green-400',
    templateIds: ['tpl-sea-grab-food-browse']
  }
]

export function getSeaPlatforms(): SeaPlatform[] {
  return SEA_PLATFORMS
}

export function getSeaPlatform(id: string): SeaPlatform | null {
  return SEA_PLATFORMS.find((p) => p.id === id) ?? null
}

/** Return all workflow templates that target a given SEA platform. */
export function getSeaPlatformTemplates(platformId: string): WorkflowTemplate[] {
  const platform = getSeaPlatform(platformId)
  if (!platform) return []
  return WORKFLOW_TEMPLATES.filter((t) => platform.templateIds.includes(t.id))
}

/** Return distinct region codes across all platforms (for filter UI). */
export function getSeaRegions(): string[] {
  const set = new Set<string>()
  for (const p of SEA_PLATFORMS) {
    for (const r of p.regions) set.add(r)
  }
  return Array.from(set).sort()
}
