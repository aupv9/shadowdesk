import type { WorkflowTemplate, AutomationStep } from '../shared/types'

function step(
  action: AutomationStep['action'],
  label: string,
  params: Record<string, any>
): AutomationStep {
  return { id: crypto.randomUUID(), action, label, params }
}

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
  }
]

export function getTemplates(): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES
}

export function getTemplate(id: string): WorkflowTemplate | null {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id) ?? null
}
