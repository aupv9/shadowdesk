import type { WorkflowTemplate, AutomationStep } from '../shared/types'

function step(
  action: AutomationStep['action'],
  label: string,
  params: Record<string, any>
): AutomationStep {
  return { id: crypto.randomUUID(), action, label, params }
}

// ─── Phase 17 — SEA Platform Template Helpers ──────────────────────────────
// Small helper to keep the SEA templates below readable. Each template uses
// interpolated {keyword}, {productUrl}, etc. via AutomationEngine variables.

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'tpl-web-scraper',
    name: 'Web Page Scraper',
    description: 'Navigate to a URL, wait for content to load, extract text from a selector, and take a screenshot.',
    category: 'scraping',
    steps: [
      step('navigate', 'Open target page', { url: 'https://example.com', waitUntil: 'networkidle2' }),
      step('waitForSelector', 'Wait for content', { selector: 'body', visible: true, timeout: 10000 }),
      step('extractText', 'Extract page text', { selector: 'body' }),
      step('screenshot', 'Capture screenshot', { fullPage: true })
    ]
  },
  {
    id: 'tpl-login-flow',
    name: 'Login Flow',
    description: 'Automate login: navigate to login page, fill credentials, click submit, and wait for redirect.',
    category: 'general',
    steps: [
      step('navigate', 'Open login page', { url: 'https://example.com/login', waitUntil: 'networkidle2' }),
      step('waitForSelector', 'Wait for form', { selector: 'input[type="email"], input[name="email"]', visible: true }),
      step('type', 'Enter email', { selector: 'input[type="email"], input[name="email"]', text: 'user@example.com', delay: 30 }),
      step('type', 'Enter password', { selector: 'input[type="password"]', text: 'password123', delay: 30 }),
      step('click', 'Click submit', { selector: 'button[type="submit"]' }),
      step('wait', 'Wait for redirect', { ms: 3000 }),
      step('screenshot', 'Capture result', { fullPage: false })
    ]
  },
  {
    id: 'tpl-social-scroll',
    name: 'Social Media Feed Scroll',
    description: 'Scroll through a social media feed, pausing between scrolls to simulate human behavior.',
    category: 'social',
    steps: [
      step('navigate', 'Open feed', { url: 'https://example.com/feed', waitUntil: 'networkidle2' }),
      step('wait', 'Initial wait', { ms: 2000 }),
      step('loop', 'Scroll loop', {
        times: 5,
        steps: [
          step('scroll', 'Scroll down', { y: 800 }),
          step('wait', 'Pause between scrolls', { ms: 1500 })
        ]
      }),
      step('screenshot', 'Capture final view', { fullPage: false })
    ]
  },
  {
    id: 'tpl-ecommerce-check',
    name: 'E-Commerce Price Checker',
    description: 'Navigate to a product page, extract the price and title, then take a screenshot.',
    category: 'ecommerce',
    steps: [
      step('navigate', 'Open product page', { url: 'https://example.com/product/123', waitUntil: 'networkidle2' }),
      step('waitForSelector', 'Wait for price', { selector: '.price, [data-price]', visible: true, timeout: 15000 }),
      step('extractText', 'Get product title', { selector: 'h1' }),
      step('extractText', 'Get price', { selector: '.price, [data-price]' }),
      step('screenshot', 'Screenshot product', { fullPage: false })
    ]
  },
  {
    id: 'tpl-form-fill',
    name: 'Form Auto-Fill',
    description: 'Fill out a multi-field form with configurable values and submit it.',
    category: 'general',
    steps: [
      step('navigate', 'Open form page', { url: 'https://example.com/register', waitUntil: 'networkidle2' }),
      step('waitForSelector', 'Wait for form', { selector: 'form', visible: true }),
      step('type', 'Enter name', { selector: 'input[name="name"]', text: 'John Doe', delay: 40 }),
      step('type', 'Enter email', { selector: 'input[name="email"]', text: 'john@example.com', delay: 40 }),
      step('type', 'Enter phone', { selector: 'input[name="phone"]', text: '+84901234567', delay: 40 }),
      step('click', 'Submit form', { selector: 'button[type="submit"]' }),
      step('wait', 'Wait for response', { ms: 2000 }),
      step('screenshot', 'Capture confirmation', { fullPage: false })
    ]
  },
  {
    id: 'tpl-site-health',
    name: 'Site Health Check',
    description: 'Run a basic site health check: load the page, check key elements exist, capture performance.',
    category: 'testing',
    steps: [
      step('navigate', 'Load homepage', { url: 'https://example.com', waitUntil: 'networkidle2', timeout: 30000 }),
      step('evaluate', 'Check page load time', { script: 'JSON.stringify(performance.timing)' }),
      step('evaluate', 'Count DOM elements', { script: 'document.querySelectorAll("*").length' }),
      step('conditional', 'Check for errors', {
        selector: '.error, .alert-danger, [role="alert"]',
        thenSteps: [
          step('extractText', 'Extract error text', { selector: '.error, .alert-danger, [role="alert"]' }),
          step('screenshot', 'Screenshot error', { fullPage: true })
        ],
        elseSteps: [
          step('screenshot', 'Screenshot healthy page', { fullPage: false })
        ]
      })
    ]
  },

  // ─── Phase 17 — SEA Platform Templates ───────────────────────────────────

  // ── Shopee ───────────────────────────────────────────────────────────────
  {
    id: 'tpl-sea-shopee-search',
    name: 'Shopee — Search & Extract Listings',
    description:
      'Navigate to Shopee VN, search for a keyword, scroll the results page and extract the first 10 product titles + prices.',
    category: 'sea-ecommerce',
    platform: 'shopee',
    region: 'VN',
    tags: ['shopee', 'vietnam', 'search', 'scraping'],
    steps: [
      step('navigate', 'Open Shopee VN', { url: 'https://shopee.vn', waitUntil: 'networkidle2', timeout: 30000 }),
      step('wait', 'Let hydration finish', { ms: 2500 }),
      step('waitForSelector', 'Wait for search bar', {
        selector: 'input.shopee-searchbar-input__input',
        visible: true,
        timeout: 15000
      }),
      step('click', 'Focus search bar', { selector: 'input.shopee-searchbar-input__input' }),
      step('type', 'Type keyword', {
        selector: 'input.shopee-searchbar-input__input',
        text: '{keyword}',
        delay: 85
      }),
      step('keyPress', 'Submit search', { key: 'Enter' }),
      step('waitForNavigation', 'Wait for results', { waitUntil: 'networkidle2', timeout: 30000 }),
      step('waitForSelector', 'Wait for first product card', {
        selector: 'div.shopee-search-item-result__item',
        visible: true,
        timeout: 15000
      }),
      step('loop', 'Lazy-scroll results', {
        times: 4,
        steps: [
          step('scroll', 'Scroll down', { y: 900 }),
          step('wait', 'Human pause', { ms: 1200 })
        ]
      }),
      step('extractText', 'Extract product titles', {
        selector: 'div[data-sqe="name"]',
        all: true,
        saveAs: 'shopee_titles'
      }),
      step('extractText', 'Extract product prices', {
        selector: 'div.ZEgDH9',
        all: true,
        saveAs: 'shopee_prices'
      }),
      step('screenshot', 'Screenshot results', { fullPage: false })
    ]
  },
  {
    id: 'tpl-sea-shopee-scrape-product',
    name: 'Shopee — Scrape Product Page',
    description:
      'Open a Shopee product URL, extract title, price, rating, seller and stock level, save full screenshot.',
    category: 'sea-ecommerce',
    platform: 'shopee',
    region: 'VN',
    tags: ['shopee', 'vietnam', 'product', 'scraping'],
    steps: [
      step('navigate', 'Open product page', {
        url: '{productUrl}',
        waitUntil: 'networkidle2',
        timeout: 30000
      }),
      step('waitForSelector', 'Wait for product title', {
        selector: 'div._44qnta, div.vR6K3w',
        visible: true,
        timeout: 15000
      }),
      step('wait', 'Humanise pause', { ms: 1500 }),
      step('scroll', 'Scroll to description', { y: 600 }),
      step('extractText', 'Extract title', {
        selector: 'div._44qnta, div.vR6K3w',
        saveAs: 'product_title'
      }),
      step('extractText', 'Extract price', {
        selector: 'div.IZPeQz, div.pqTWkA',
        saveAs: 'product_price'
      }),
      step('extractText', 'Extract seller', {
        selector: 'div.fV3TIn',
        saveAs: 'seller_name'
      }),
      step('extractText', 'Extract rating', {
        selector: 'div.F9RHbS.dQEiAI.jMXp4d',
        saveAs: 'rating'
      }),
      step('screenshot', 'Full product screenshot', { fullPage: true })
    ]
  },
  {
    id: 'tpl-sea-shopee-add-to-cart',
    name: 'Shopee — Add Product to Cart',
    description:
      'Open a Shopee product, wait for the Add-to-Cart button, click it, and confirm the cart count updated.',
    category: 'sea-ecommerce',
    platform: 'shopee',
    region: 'VN',
    tags: ['shopee', 'vietnam', 'cart', 'checkout'],
    steps: [
      step('navigate', 'Open product page', {
        url: '{productUrl}',
        waitUntil: 'networkidle2',
        timeout: 30000
      }),
      step('wait', 'Wait for hydration', { ms: 2000 }),
      step('scroll', 'Scroll to buy box', { y: 400 }),
      step('waitForSelector', 'Wait for add-to-cart button', {
        selector: 'button.btn.btn-solid-primary--oVUmB',
        visible: true,
        timeout: 15000
      }),
      step('hover', 'Hover on button (human)', {
        selector: 'button.btn.btn-solid-primary--oVUmB'
      }),
      step('wait', 'Pause before click', { ms: 600 }),
      step('click', 'Click add to cart', {
        selector: 'button.btn.btn-solid-primary--oVUmB'
      }),
      step('wait', 'Wait for cart toast', { ms: 2500 }),
      step('screenshot', 'Screenshot cart state', { fullPage: false })
    ]
  },
  {
    id: 'tpl-sea-shopee-login',
    name: 'Shopee — Login Flow',
    description:
      'Navigate to Shopee login page, fill credentials from the vault and submit. Stops at CAPTCHA if triggered.',
    category: 'sea-ecommerce',
    platform: 'shopee',
    region: 'VN',
    tags: ['shopee', 'login', 'auth'],
    steps: [
      step('navigate', 'Open login page', {
        url: 'https://shopee.vn/buyer/login',
        waitUntil: 'networkidle2'
      }),
      step('waitForSelector', 'Wait for login form', {
        selector: 'input[name="loginKey"]',
        visible: true,
        timeout: 15000
      }),
      step('type', 'Enter phone / email', {
        selector: 'input[name="loginKey"]',
        text: '{shopee_user}',
        delay: 110
      }),
      step('wait', 'Human pause', { ms: 700 }),
      step('type', 'Enter password', {
        selector: 'input[name="password"]',
        text: '{shopee_password}',
        delay: 120
      }),
      step('wait', 'Pause before submit', { ms: 900 }),
      step('click', 'Click login', { selector: 'button.wyhvVD._1EApiB' }),
      step('wait', 'Wait for redirect', { ms: 5000 }),
      step('screenshot', 'Screenshot post-login state', { fullPage: false })
    ]
  },

  // ── Lazada ───────────────────────────────────────────────────────────────
  {
    id: 'tpl-sea-lazada-search',
    name: 'Lazada — Search & Extract Listings',
    description:
      'Navigate to Lazada VN, search for a keyword, scroll and extract the first page of product cards.',
    category: 'sea-ecommerce',
    platform: 'lazada',
    region: 'VN',
    tags: ['lazada', 'search', 'scraping'],
    steps: [
      step('navigate', 'Open Lazada VN', { url: 'https://www.lazada.vn', waitUntil: 'networkidle2', timeout: 30000 }),
      step('wait', 'Wait for hydration', { ms: 3000 }),
      step('waitForSelector', 'Wait for search input', {
        selector: 'input[type="search"]#q',
        visible: true,
        timeout: 15000
      }),
      step('click', 'Focus search', { selector: 'input[type="search"]#q' }),
      step('type', 'Type keyword', {
        selector: 'input[type="search"]#q',
        text: '{keyword}',
        delay: 90
      }),
      step('keyPress', 'Submit search', { key: 'Enter' }),
      step('waitForNavigation', 'Wait for results', { waitUntil: 'networkidle2', timeout: 30000 }),
      step('waitForSelector', 'Wait for first product card', {
        selector: 'div[data-qa-locator="product-item"]',
        visible: true,
        timeout: 15000
      }),
      step('loop', 'Lazy-scroll results', {
        times: 4,
        steps: [
          step('scroll', 'Scroll down', { y: 900 }),
          step('wait', 'Pause', { ms: 1200 })
        ]
      }),
      step('extractText', 'Extract product titles', {
        selector: 'div.RfADt a',
        all: true,
        saveAs: 'lazada_titles'
      }),
      step('extractText', 'Extract product prices', {
        selector: 'div.aBrP0 span.ooOxS',
        all: true,
        saveAs: 'lazada_prices'
      }),
      step('screenshot', 'Screenshot results', { fullPage: false })
    ]
  },
  {
    id: 'tpl-sea-lazada-scrape-product',
    name: 'Lazada — Scrape Product Page',
    description:
      'Open a Lazada product page, extract title, price, discount, seller, and total reviews.',
    category: 'sea-ecommerce',
    platform: 'lazada',
    region: 'VN',
    tags: ['lazada', 'product', 'scraping'],
    steps: [
      step('navigate', 'Open product page', {
        url: '{productUrl}',
        waitUntil: 'networkidle2',
        timeout: 30000
      }),
      step('waitForSelector', 'Wait for title', {
        selector: 'span.pdp-mod-product-badge-title',
        visible: true,
        timeout: 15000
      }),
      step('wait', 'Pause', { ms: 1500 }),
      step('extractText', 'Extract title', {
        selector: 'span.pdp-mod-product-badge-title',
        saveAs: 'lazada_title'
      }),
      step('extractText', 'Extract price', {
        selector: 'span.pdp-price.pdp-price_type_normal',
        saveAs: 'lazada_price'
      }),
      step('extractText', 'Extract rating', {
        selector: 'div.score-average',
        saveAs: 'lazada_rating'
      }),
      step('scroll', 'Scroll to reviews', { y: 1200 }),
      step('screenshot', 'Full page screenshot', { fullPage: true })
    ]
  },
  {
    id: 'tpl-sea-lazada-flash-sale',
    name: 'Lazada — Flash Sale Tracker',
    description:
      'Visit the Lazada flash sale page, wait for items, extract current deals and timer.',
    category: 'sea-ecommerce',
    platform: 'lazada',
    region: 'VN',
    tags: ['lazada', 'flash-sale', 'monitor'],
    steps: [
      step('navigate', 'Open flash sale', {
        url: 'https://www.lazada.vn/shop-flash-sale',
        waitUntil: 'networkidle2'
      }),
      step('wait', 'Wait for hydration', { ms: 3000 }),
      step('waitForSelector', 'Wait for deal grid', {
        selector: 'div.lzd-fs-item, div[data-tracking="product-card"]',
        visible: true,
        timeout: 15000
      }),
      step('extractText', 'Extract countdown', {
        selector: 'div.countdown, div.lzd-countdown',
        saveAs: 'flash_countdown'
      }),
      step('extractText', 'Extract deal titles', {
        selector: 'div.lzd-fs-item-title',
        all: true,
        saveAs: 'flash_titles'
      }),
      step('extractText', 'Extract deal prices', {
        selector: 'div.lzd-fs-item-price',
        all: true,
        saveAs: 'flash_prices'
      }),
      step('screenshot', 'Screenshot sale page', { fullPage: true })
    ]
  },

  // ── TikTok Shop ──────────────────────────────────────────────────────────
  {
    id: 'tpl-sea-tiktok-shop-browse',
    name: 'TikTok Shop — Browse Feed',
    description:
      'Open the TikTok Shop feed, wait for product cards, scroll the feed and capture trending items.',
    category: 'sea-ecommerce',
    platform: 'tiktok-shop',
    region: 'VN',
    tags: ['tiktok', 'live-commerce', 'browse'],
    steps: [
      step('navigate', 'Open TikTok Shop', {
        url: 'https://shop.tiktok.com',
        waitUntil: 'networkidle2',
        timeout: 30000
      }),
      step('wait', 'Wait for hydration', { ms: 3500 }),
      step('waitForSelector', 'Wait for product grid', {
        selector: 'div[data-e2e="product-card"]',
        visible: true,
        timeout: 20000
      }),
      step('loop', 'Scroll feed', {
        times: 6,
        steps: [
          step('scroll', 'Scroll down', { y: 700 }),
          step('wait', 'Humanise', { ms: 1800 })
        ]
      }),
      step('extractText', 'Extract titles', {
        selector: 'a[data-e2e="product-card-title"]',
        all: true,
        saveAs: 'tiktok_titles'
      }),
      step('extractText', 'Extract prices', {
        selector: 'span[data-e2e="product-card-price"]',
        all: true,
        saveAs: 'tiktok_prices'
      }),
      step('screenshot', 'Screenshot feed', { fullPage: false })
    ]
  },
  {
    id: 'tpl-sea-tiktok-shop-search',
    name: 'TikTok Shop — Search Products',
    description:
      'Search for a product on TikTok Shop, extract result titles and prices, screenshot the first results page.',
    category: 'sea-ecommerce',
    platform: 'tiktok-shop',
    region: 'VN',
    tags: ['tiktok', 'search'],
    steps: [
      step('navigate', 'Open TikTok Shop', {
        url: 'https://shop.tiktok.com',
        waitUntil: 'networkidle2'
      }),
      step('wait', 'Wait for hydration', { ms: 3000 }),
      step('waitForSelector', 'Wait for search box', {
        selector: 'input[data-e2e="search-user-input"]',
        visible: true,
        timeout: 15000
      }),
      step('click', 'Focus search', {
        selector: 'input[data-e2e="search-user-input"]'
      }),
      step('type', 'Type query', {
        selector: 'input[data-e2e="search-user-input"]',
        text: '{keyword}',
        delay: 95
      }),
      step('keyPress', 'Press enter', { key: 'Enter' }),
      step('wait', 'Wait for results', { ms: 4000 }),
      step('waitForSelector', 'Wait for result cards', {
        selector: 'div[data-e2e="product-card"]',
        visible: true,
        timeout: 15000
      }),
      step('extractText', 'Extract titles', {
        selector: 'a[data-e2e="product-card-title"]',
        all: true,
        saveAs: 'search_titles'
      }),
      step('screenshot', 'Screenshot results', { fullPage: false })
    ]
  },
  {
    id: 'tpl-sea-tiktok-shop-live-scrape',
    name: 'TikTok Shop — Live Stream Scraper',
    description:
      'Open a TikTok live-commerce stream URL, extract viewer count + product pins, loop for 30s of snapshots.',
    category: 'sea-social',
    platform: 'tiktok-shop',
    region: 'VN',
    tags: ['tiktok', 'live', 'monitor'],
    steps: [
      step('navigate', 'Open live stream', {
        url: '{liveUrl}',
        waitUntil: 'networkidle2',
        timeout: 30000
      }),
      step('wait', 'Buffer start', { ms: 4000 }),
      step('waitForSelector', 'Wait for live card', {
        selector: 'div[data-e2e="live-card"], div.live-room',
        visible: true,
        timeout: 20000
      }),
      step('loop', 'Snapshot viewers + pins x5', {
        times: 5,
        steps: [
          step('extractText', 'Viewer count', {
            selector: 'div[data-e2e="live-people-count"]',
            saveAs: 'viewer_count'
          }),
          step('extractText', 'Pinned product', {
            selector: 'div[data-e2e="live-pinned-goods"]',
            saveAs: 'pinned_product'
          }),
          step('screenshot', 'Stream snapshot', { fullPage: false }),
          step('wait', 'Inter-snapshot', { ms: 6000 })
        ]
      })
    ]
  },

  // ── Tiki ─────────────────────────────────────────────────────────────────
  {
    id: 'tpl-sea-tiki-search',
    name: 'Tiki — Search Products',
    description:
      'Search Tiki (Vietnam marketplace) for a keyword and extract first-page product titles + prices.',
    category: 'sea-ecommerce',
    platform: 'tiki',
    region: 'VN',
    tags: ['tiki', 'vietnam', 'search'],
    steps: [
      step('navigate', 'Open Tiki', { url: 'https://tiki.vn', waitUntil: 'networkidle2' }),
      step('wait', 'Wait for hydration', { ms: 2000 }),
      step('waitForSelector', 'Wait for search input', {
        selector: 'input[data-view-id="main_search_form_input"]',
        visible: true,
        timeout: 15000
      }),
      step('click', 'Focus search', { selector: 'input[data-view-id="main_search_form_input"]' }),
      step('type', 'Type keyword', {
        selector: 'input[data-view-id="main_search_form_input"]',
        text: '{keyword}',
        delay: 85
      }),
      step('keyPress', 'Submit', { key: 'Enter' }),
      step('waitForNavigation', 'Wait for results', { waitUntil: 'networkidle2' }),
      step('waitForSelector', 'Wait for product card', {
        selector: 'a.product-item',
        visible: true,
        timeout: 15000
      }),
      step('extractText', 'Extract titles', {
        selector: 'div.name h3',
        all: true,
        saveAs: 'tiki_titles'
      }),
      step('extractText', 'Extract prices', {
        selector: 'div.price-discount__price',
        all: true,
        saveAs: 'tiki_prices'
      }),
      step('screenshot', 'Screenshot results', { fullPage: false })
    ]
  },
  {
    id: 'tpl-sea-tiki-flash-deal',
    name: 'Tiki — Flash Deal Monitor',
    description:
      'Visit Tiki flash deal page, extract ongoing deals and their remaining stock indicators.',
    category: 'sea-ecommerce',
    platform: 'tiki',
    region: 'VN',
    tags: ['tiki', 'flash-deal', 'monitor'],
    steps: [
      step('navigate', 'Open flash deals', {
        url: 'https://tiki.vn/khuyen-mai-hot',
        waitUntil: 'networkidle2'
      }),
      step('wait', 'Hydration pause', { ms: 2500 }),
      step('scroll', 'Scroll to deals', { y: 600 }),
      step('extractText', 'Deal titles', {
        selector: 'div.name',
        all: true,
        saveAs: 'flash_titles'
      }),
      step('extractText', 'Stock badges', {
        selector: 'div.progress-text, span.stock',
        all: true,
        saveAs: 'stock_levels'
      }),
      step('screenshot', 'Screenshot deals', { fullPage: true })
    ]
  },

  // ── VNPay ────────────────────────────────────────────────────────────────
  {
    id: 'tpl-sea-vnpay-checkout',
    name: 'VNPay — Sandbox Checkout',
    description:
      'Drive the VNPay SANDBOX checkout form: pick test bank, enter test card, submit. Safe for QA only.',
    category: 'sea-payments',
    platform: 'vnpay',
    region: 'VN',
    tags: ['vnpay', 'payment', 'sandbox', 'checkout'],
    steps: [
      step('navigate', 'Open sandbox gateway', {
        url: '{vnpayCheckoutUrl}',
        waitUntil: 'networkidle2',
        timeout: 30000
      }),
      step('wait', 'Wait for gateway', { ms: 2500 }),
      step('waitForSelector', 'Wait for bank grid', {
        selector: 'div.bank-list, div.list-bank',
        visible: true,
        timeout: 15000
      }),
      step('click', 'Pick test bank (NCB)', {
        selector: 'div[data-bank-code="NCB"], div.bank-item.NCB'
      }),
      step('wait', 'Wait for card form', { ms: 2000 }),
      step('waitForSelector', 'Wait for card number field', {
        selector: 'input[name="cardNumber"]',
        visible: true,
        timeout: 15000
      }),
      step('type', 'Card number', {
        selector: 'input[name="cardNumber"]',
        text: '9704198526191432198',
        delay: 60
      }),
      step('type', 'Card holder', {
        selector: 'input[name="cardHolder"]',
        text: 'NGUYEN VAN A',
        delay: 60
      }),
      step('type', 'Issue date', {
        selector: 'input[name="issueDate"]',
        text: '07/15',
        delay: 60
      }),
      step('click', 'Submit card', { selector: 'button.btn-pay' }),
      step('wait', 'Wait for OTP screen', { ms: 3000 }),
      step('screenshot', 'OTP step screenshot', { fullPage: false })
    ]
  },
  {
    id: 'tpl-sea-vnpay-bank-redirect',
    name: 'VNPay — Bank Redirect Flow',
    description:
      'Open a VNPay-initiated redirect URL, follow the bank page and extract the transaction reference.',
    category: 'sea-payments',
    platform: 'vnpay',
    region: 'VN',
    tags: ['vnpay', 'payment', 'redirect'],
    steps: [
      step('navigate', 'Open VNPay redirect', {
        url: '{vnpayRedirectUrl}',
        waitUntil: 'networkidle2'
      }),
      step('wait', 'Wait for bank screen', { ms: 3000 }),
      step('extractText', 'Extract transaction ref', {
        selector: 'span.transaction-ref, div.txn-ref',
        saveAs: 'vnpay_txn_ref'
      }),
      step('extractText', 'Extract amount', {
        selector: 'span.amount, div.txn-amount',
        saveAs: 'vnpay_amount'
      }),
      step('screenshot', 'Redirect screenshot', { fullPage: true })
    ]
  },

  // ── Grab ─────────────────────────────────────────────────────────────────
  {
    id: 'tpl-sea-grab-food-browse',
    name: 'Grab Food — Browse Restaurants',
    description:
      'Open GrabFood Vietnam, set a Ho Chi Minh City delivery address and scrape nearby restaurant cards.',
    category: 'sea-ecommerce',
    platform: 'grab',
    region: 'VN',
    tags: ['grab', 'food', 'delivery', 'browse'],
    steps: [
      step('navigate', 'Open GrabFood VN', {
        url: 'https://food.grab.com/vn/vi',
        waitUntil: 'networkidle2',
        timeout: 30000
      }),
      step('wait', 'Hydration', { ms: 3000 }),
      step('waitForSelector', 'Wait for address input', {
        selector: 'input[placeholder*="delivery address"], input[placeholder*="địa chỉ"]',
        visible: true,
        timeout: 15000
      }),
      step('click', 'Focus address input', {
        selector: 'input[placeholder*="delivery address"], input[placeholder*="địa chỉ"]'
      }),
      step('type', 'Enter address', {
        selector: 'input[placeholder*="delivery address"], input[placeholder*="địa chỉ"]',
        text: '{deliveryAddress}',
        delay: 95
      }),
      step('wait', 'Wait for suggestions', { ms: 2000 }),
      step('keyPress', 'Arrow down', { key: 'ArrowDown' }),
      step('keyPress', 'Select first suggestion', { key: 'Enter' }),
      step('wait', 'Wait for restaurants', { ms: 4000 }),
      step('waitForSelector', 'Wait for restaurant card', {
        selector: 'a[data-testid="restaurant-card"]',
        visible: true,
        timeout: 20000
      }),
      step('extractText', 'Extract restaurant names', {
        selector: 'a[data-testid="restaurant-card"] h6',
        all: true,
        saveAs: 'restaurant_names'
      }),
      step('screenshot', 'Screenshot restaurant list', { fullPage: false })
    ]
  }
]

export function getTemplates(): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES
}

export function getTemplate(id: string): WorkflowTemplate | null {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id) ?? null
}
