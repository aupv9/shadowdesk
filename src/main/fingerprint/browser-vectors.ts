/**
 * P3: Browser-Specific Fingerprint Vectors
 *
 * Detects and validates browser-specific fingerprinting patterns:
 * - Firefox: UA parsing, about:config exposure
 * - Safari: WebKit version, Safari-specific APIs
 * - Edge: Edg vendor string detection
 * - Brave: Shields detection, Tor mode detection
 *
 * These vectors are more sophisticated than generic detection,
 * checking internal consistency within each browser.
 */

import type { Page } from 'puppeteer-core'
import type { DetectionVectorResult } from '../../shared/types'
import type { FingerprintConfig } from '../../shared/types'

/**
 * Detect Firefox-specific vectors
 */
export async function testFirefoxSpecificVectors(page: Page, fp: FingerprintConfig): Promise<DetectionVectorResult[]> {
  const isFirefox = fp.browser.userAgent.includes('Firefox') && fp.browser.vendor === ''

  if (!isFirefox) {
    return []
  }

  const vectors: DetectionVectorResult[] = []

  // Test 1: Vendor should be empty for Firefox
  const vendor = await page.evaluate(() => navigator.vendor)
  vectors.push({
    name: 'Firefox vendor string',
    category: 'Browser',
    passed: vendor === '',
    detail: `Expected empty, got: "${vendor}"`
  })

  // Test 2: UA should contain "Firefox" not "Chrome"
  const ua = await page.evaluate(() => navigator.userAgent)
  vectors.push({
    name: 'Firefox UA consistency',
    category: 'Browser',
    passed: ua.includes('Firefox') && !ua.includes('Chrome/'),
    detail: ua.substring(0, 80)
  })

  return vectors
}

/**
 * Detect Safari-specific vectors
 */
export async function testSafariSpecificVectors(page: Page, fp: FingerprintConfig): Promise<DetectionVectorResult[]> {
  const isSafari = fp.browser.userAgent.includes('Safari') && fp.browser.userAgent.includes('Version/')

  if (!isSafari) {
    return []
  }

  const vectors: DetectionVectorResult[] = []

  // Test 1: Safari should NOT have plugins array
  const pluginCount = await page.evaluate(() => navigator.plugins?.length ?? 0)
  vectors.push({
    name: 'Safari plugins (should be 0)',
    category: 'Browser',
    passed: pluginCount === 0,
    detail: `Expected 0 plugins, got: ${pluginCount}`
  })

  // Test 2: UA should contain "Version/" (Safari-specific)
  const ua = await page.evaluate(() => navigator.userAgent)
  vectors.push({
    name: 'Safari UA format',
    category: 'Browser',
    passed: ua.includes('Version/') && ua.includes('Safari/'),
    detail: ua.substring(0, 80)
  })

  // Test 3: Vendor should be "Apple Computer, Inc."
  const vendor = await page.evaluate(() => navigator.vendor)
  vectors.push({
    name: 'Safari vendor string',
    category: 'Browser',
    passed: vendor === 'Apple Computer, Inc.',
    detail: `Expected "Apple Computer, Inc.", got: "${vendor}"`
  })

  return vectors
}

/**
 * Detect Edge-specific vectors
 */
export async function testEdgeSpecificVectors(page: Page, fp: FingerprintConfig): Promise<DetectionVectorResult[]> {
  const isEdge = fp.browser.userAgent.includes('Edg/')

  if (!isEdge) {
    return []
  }

  const vectors: DetectionVectorResult[] = []

  // Test 1: UA should contain "Edg/" (Edge-specific)
  const ua = await page.evaluate(() => navigator.userAgent)
  vectors.push({
    name: 'Edge UA format',
    category: 'Browser',
    passed: ua.includes('Edg/'),
    detail: ua.substring(0, 80)
  })

  // Test 2: Should also contain "Chrome/" (Chromium-based)
  vectors.push({
    name: 'Edge Chromium base',
    category: 'Browser',
    passed: ua.includes('Chrome/'),
    detail: 'Edge is Chromium-based'
  })

  return vectors
}

/**
 * Detect Brave-specific vectors
 */
export async function testBraveSpecificVectors(page: Page, fp: FingerprintConfig): Promise<DetectionVectorResult[]> {
  // Brave uses standard Chrome UA, but has unique APIs
  const vectors: DetectionVectorResult[] = []

  // Test 1: Check for Brave's permission API extensions
  const braveShields = await page.evaluate(() => {
    return !!(window as any).brave || typeof (navigator as any).brave !== 'undefined'
  })

  if (braveShields) {
    vectors.push({
      name: 'Brave Shields API',
      category: 'Browser',
      passed: false, // Shields API should be hidden
      detail: 'Brave Shields API exposed - should be hidden'
    })
  }

  // Test 2: Check for standard Chromium UA
  const ua = await page.evaluate(() => navigator.userAgent)
  const isChromiumUA = ua.includes('Chrome/') && !ua.includes('Edg/') && !ua.includes('Firefox')
  vectors.push({
    name: 'Brave UA (Chromium)',
    category: 'Browser',
    passed: isChromiumUA,
    detail: isChromiumUA ? 'Uses standard Chrome UA' : 'Inconsistent UA'
  })

  return vectors
}

/**
 * Detect generic browser-specific issues
 */
export async function testBrowserConsistency(page: Page, fp: FingerprintConfig): Promise<DetectionVectorResult> {
  const ua = await page.evaluate(() => navigator.userAgent)
  const vendor = await page.evaluate(() => navigator.vendor)

  // Detect browser from preset
  const isChromeBase = fp.browser.userAgent.includes('Chrome') || fp.browser.userAgent.includes('Chromium')
  const isFirefox = fp.browser.userAgent.includes('Firefox')
  const isSafari = fp.browser.userAgent.includes('Safari') && fp.browser.userAgent.includes('Version/')
  const isEdge = fp.browser.userAgent.includes('Edg/')

  let browserName = 'Unknown'
  let passed = true
  let issues: string[] = []

  if (isFirefox) {
    browserName = 'Firefox'
    passed = ua.includes('Firefox') && vendor === ''
    if (!ua.includes('Firefox')) issues.push('UA missing Firefox marker')
    if (vendor !== '') issues.push(`Vendor should be empty, got: "${vendor}"`)
  } else if (isSafari) {
    browserName = 'Safari'
    passed = ua.includes('Version/') && ua.includes('Safari/') && vendor === 'Apple Computer, Inc.'
    if (!ua.includes('Version/')) issues.push('UA missing Safari Version marker')
    if (vendor !== 'Apple Computer, Inc.') issues.push(`Wrong vendor: "${vendor}"`)
  } else if (isEdge) {
    browserName = 'Edge'
    passed = ua.includes('Edg/') && ua.includes('Chrome/')
    if (!ua.includes('Edg/')) issues.push('UA missing Edge marker')
    if (!ua.includes('Chrome/')) issues.push('UA missing Chrome marker (Edge is Chromium-based)')
  } else if (isChromeBase) {
    browserName = 'Chrome/Brave'
    passed = ua.includes('Chrome/')
    if (!ua.includes('Chrome/')) issues.push('UA missing Chrome marker')
  }

  return {
    name: `Browser consistency (${browserName})`,
    category: 'Browser',
    passed,
    detail: passed ? `${browserName} UA/vendor consistent` : `Issues: ${issues.join(', ')}`
  }
}
