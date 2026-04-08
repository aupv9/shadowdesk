/**
 * CSS Selector validation and analysis utilities
 * Provides real-time validation without needing a DOM
 */

export interface SelectorValidationResult {
  isValid: boolean
  error?: string
  warning?: string
  suggestions?: string[]
  examples?: string[]
}

/**
 * Validate CSS selector syntax (without DOM)
 * Returns validation result with suggestions
 */
export function validateCSSSelector(selector: string): SelectorValidationResult {
  if (!selector || !selector.trim()) {
    return {
      isValid: false,
      error: 'Selector cannot be empty',
      examples: ['.login-btn', '#submit', '[type="button"]']
    }
  }

  const trimmed = selector.trim()

  // Try to parse as CSS selector
  try {
    document.querySelector(trimmed)
  } catch (e) {
    const errorMsg = String(e)
    return {
      isValid: false,
      error: `Invalid CSS selector: ${errorMsg.split(':')[1]?.trim() || 'Invalid syntax'}`,
      suggestions: getSelectorSuggestions(trimmed),
      examples: ['.element', '#id', '[attr="value"]']
    }
  }

  // Check for common issues
  const warnings = checkSelectorWarnings(trimmed)

  return {
    isValid: true,
    warning: warnings.length > 0 ? warnings[0] : undefined,
    suggestions: getSelectorSuggestions(trimmed),
    examples: getCommonPatterns()
  }
}

/**
 * Validate XPath syntax
 */
export function validateXPath(xpath: string): SelectorValidationResult {
  if (!xpath || !xpath.trim()) {
    return {
      isValid: false,
      error: 'XPath cannot be empty',
      examples: ['//button[@class="submit"]', '//input[@type="email"]']
    }
  }

  const trimmed = xpath.trim()

  try {
    document.evaluate(trimmed, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
  } catch (e) {
    const errorMsg = String(e)
    return {
      isValid: false,
      error: `Invalid XPath: ${errorMsg.split('message')[1]?.trim() || 'Invalid syntax'}`,
      examples: ['//button', '//input[@type="email"]', '//*[@id="login"]']
    }
  }

  return {
    isValid: true,
    examples: getCommonXPathPatterns()
  }
}

/**
 * Check for common selector issues that suggest improvements
 */
function checkSelectorWarnings(selector: string): string[] {
  const warnings: string[] = []

  // Warn if selector is too general
  if (selector === '*') {
    warnings.push('⚠️ Universal selector (*) matches everything—be more specific')
  }

  if (selector === 'body' || selector === 'div') {
    warnings.push('⚠️ Very broad selector—consider using class or ID')
  }

  // Warn about deprecated/risky patterns
  if (selector.includes('div > span > a')) {
    warnings.push('⚠️ Deep nesting (3+ levels) is fragile—consider class-based selectors')
  }

  if (selector.match(/\d{4,}/)) {
    warnings.push('⚠️ Selector contains long numbers (possibly generated IDs)—may break if page changes')
  }

  // Warn about missing attribute quotes
  if (selector.match(/\[[^\]]*=[^\]]*"[^\]]*\]/)) {
    const unquoted = selector.match(/\[([^\]]*=)([^"\]][^\]]*)\]/)?.[0]
    if (unquoted) {
      warnings.push(`⚠️ Attribute value should be quoted: ${unquoted}`)
    }
  }

  return warnings
}

/**
 * Generate selector suggestions based on pattern
 */
function getSelectorSuggestions(selector: string): string[] {
  const suggestions: string[] = []

  // If starts with dot, it's a class
  if (selector.startsWith('.')) {
    const className = selector.slice(1).split(/[.#\s\[]/)[0]
    if (className) {
      suggestions.push(`.${className}`)
      suggestions.push(`[class*="${className}"]`)
      suggestions.push(`[class~="${className}"]`)
    }
  }

  // If starts with hash, it's an ID
  if (selector.startsWith('#')) {
    const idName = selector.slice(1).split(/[.#\s\[]/)[0]
    if (idName) {
      suggestions.push(`#${idName}`)
      suggestions.push(`[id="${idName}"]`)
    }
  }

  // Element selector suggestions
  if (selector.match(/^[a-z]/i)) {
    const element = selector.split(/[.#\s\[]/)[0]
    if (element) {
      suggestions.push(`${element}`)
      suggestions.push(`${element}[type="submit"]`)
      suggestions.push(`.${element}`)
    }
  }

  // Attribute selector suggestions
  if (selector.includes('[') && selector.includes('=')) {
    suggestions.push(selector)
    // Extract potential class
    const classMatch = selector.match(/class="([^"]+)"/)
    if (classMatch) {
      suggestions.push(`.${classMatch[1].split(' ')[0]}`)
    }
  }

  return [...new Set(suggestions)].slice(0, 3)
}

/**
 * Get common CSS selector patterns for examples
 */
function getCommonPatterns(): string[] {
  return [
    '.button', // Class selector
    '#submit', // ID selector
    'button[type="submit"]', // Element + attribute
    'form > button', // Parent-child
    '.modal .close', // Descendant
    '[aria-label="Close"]', // Attribute selector
    'input[name="email"]', // Named input
    '.active', // Class
    '#modal-header', // ID
    '[data-testid="login"]' // Data attribute
  ]
}

/**
 * Get common XPath patterns for examples
 */
function getCommonXPathPatterns(): string[] {
  return [
    '//button[@type="submit"]',
    '//input[@name="email"]',
    '//*[@id="login"]',
    '//a[contains(text(), "Log in")]',
    '//div[@class="modal"]//button',
    '//form//input[@type="password"]',
    '//*[contains(@class, "error")]',
    '//button[text()="Submit"]',
    '//nav//a',
    '//span[@aria-label="Close"]'
  ]
}

/**
 * Analyze selector complexity (for difficulty hints)
 */
export function analyzeSelectorComplexity(selector: string): 'simple' | 'moderate' | 'complex' {
  if (!selector) return 'simple'

  const nestingLevel = (selector.match(/\s/g) || []).length
  const combinatorCount = (selector.match(/[>+~]/g) || []).length
  const attributeCount = (selector.match(/\[/g) || []).length

  if (nestingLevel === 0 && combinatorCount === 0 && attributeCount <= 1) {
    return 'simple'
  }
  if (nestingLevel <= 2 && combinatorCount <= 1 && attributeCount <= 2) {
    return 'moderate'
  }
  return 'complex'
}

/**
 * Get selector complexity explanation
 */
export function getSelectorComplexityExplanation(complexity: 'simple' | 'moderate' | 'complex'): string {
  switch (complexity) {
    case 'simple':
      return '✓ Simple selector—reliable and fast'
    case 'moderate':
      return '⚠️ Moderate complexity—may break if page structure changes'
    case 'complex':
      return '⚠️ Complex selector—fragile, consider simpler alternatives'
  }
}

/**
 * Provide guidance based on selector type
 */
export function getSelectorGuidance(selector: string): string {
  if (!selector) return 'Enter a CSS selector to get started'

  if (selector.startsWith('.')) {
    return '📌 Class selector—most reliable for styling-based elements'
  }
  if (selector.startsWith('#')) {
    return '📌 ID selector—unique per page, very reliable'
  }
  if (selector.includes('[')) {
    return '📌 Attribute selector—great for data attributes and input types'
  }
  if (selector.includes('>')) {
    return '📌 Child combinator—matches direct children only'
  }
  if (selector.includes(' ') && !selector.includes('>')) {
    return '📌 Descendant selector—matches nested elements'
  }
  if (selector.match(/^[a-z]/i)) {
    return '📌 Element selector—less reliable (generic)'
  }

  return '📌 CSS selector'
}
