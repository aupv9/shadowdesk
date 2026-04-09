/**
 * Multi-currency price parser for SEA marketplaces.
 *
 * The workflow templates extract raw price strings — something like:
 *   "₫28.990.000"        (Shopee VN)
 *   "28.590.000₫"        (Tiki VN — symbol after)
 *   "1.990.000 VND"      (VNPay)
 *   "RM 3,499"           (Shopee MY)
 *   "฿25,999"            (Shopee TH)
 *   "Rp 12.500.000"      (Shopee ID)
 *   "₱56,990"            (Shopee PH)
 *   "S$2,499"            (Shopee SG)
 *   "$1,199"             (fallback USD)
 *
 * Each SEA country uses a different thousands separator / decimal style:
 *   - VN: dots as thousands sep, no decimals
 *   - TH, MY, SG, PH, US: commas as thousands sep, dot as decimal
 *   - ID: dots as thousands sep, comma as decimal (or none)
 *
 * This parser returns a normalised { amount: number, currency: string } so
 * downstream tests can compare across platforms.
 */

export type Currency = 'VND' | 'THB' | 'MYR' | 'SGD' | 'PHP' | 'IDR' | 'USD' | 'UNKNOWN'

export interface ParsedPrice {
  amount: number
  currency: Currency
  raw: string
}

interface CurrencyHint {
  currency: Currency
  /** Symbols or words that indicate this currency. Order matters for matching. */
  tokens: string[]
  /** Decimal convention used by this locale. */
  decimalSep: '.' | ',' | 'none'
}

const CURRENCIES: CurrencyHint[] = [
  { currency: 'VND', tokens: ['₫', 'VND', 'đ'],   decimalSep: 'none' },
  { currency: 'IDR', tokens: ['Rp', 'IDR'],       decimalSep: 'none' },
  { currency: 'THB', tokens: ['฿', 'THB'],        decimalSep: '.'    },
  { currency: 'MYR', tokens: ['RM', 'MYR'],       decimalSep: '.'    },
  { currency: 'SGD', tokens: ['S$', 'SGD'],       decimalSep: '.'    },
  { currency: 'PHP', tokens: ['₱', 'PHP'],        decimalSep: '.'    },
  { currency: 'USD', tokens: ['US$', 'USD', '$'], decimalSep: '.'    }
]

/** Detect currency from the raw string — longest-token-first wins. */
function detectCurrency(raw: string): CurrencyHint | null {
  // Sort so "S$" wins over "$" when both would match
  const sorted = [...CURRENCIES].sort((a, b) => {
    const aLen = Math.max(...a.tokens.map((t) => t.length))
    const bLen = Math.max(...b.tokens.map((t) => t.length))
    return bLen - aLen
  })
  for (const hint of sorted) {
    for (const token of hint.tokens) {
      if (raw.includes(token)) return hint
    }
  }
  return null
}

/**
 * Parse a single price string. Returns null on unparsable input.
 *
 * Heuristic for decimal vs thousands separator:
 *   1. If the locale is "no decimals" (VND/IDR) — every . or , is a thousands sep.
 *   2. Otherwise, the LAST . or , is the decimal point IF it has 1-2 digits
 *      after it; earlier separators are thousands grouping.
 */
export function parsePrice(raw: string): ParsedPrice | null {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const hint = detectCurrency(trimmed)

  // Keep only digits, dots, commas — strip symbols, whitespace, NBSP.
  const digitsOnly = trimmed.replace(/[^\d.,]/g, '')
  if (!/\d/.test(digitsOnly)) return null

  let amount: number

  if (hint?.decimalSep === 'none') {
    // Strip all separators — VND/IDR have no fractional cents.
    amount = parseInt(digitsOnly.replace(/[.,]/g, ''), 10)
  } else {
    // Find the last separator; if 1-2 trailing digits it's a decimal.
    const lastDot = digitsOnly.lastIndexOf('.')
    const lastComma = digitsOnly.lastIndexOf(',')
    const lastSep = Math.max(lastDot, lastComma)

    if (lastSep === -1) {
      amount = parseInt(digitsOnly, 10)
    } else {
      const trailing = digitsOnly.length - lastSep - 1
      if (trailing === 1 || trailing === 2) {
        // Decimal point candidate — strip all OTHER separators, then replace.
        const intPart = digitsOnly
          .slice(0, lastSep)
          .replace(/[.,]/g, '')
        const fracPart = digitsOnly.slice(lastSep + 1)
        amount = parseFloat(`${intPart}.${fracPart}`)
      } else {
        amount = parseInt(digitsOnly.replace(/[.,]/g, ''), 10)
      }
    }
  }

  if (!Number.isFinite(amount)) return null

  return {
    amount,
    currency: hint?.currency ?? 'UNKNOWN',
    raw: trimmed
  }
}

/**
 * Parse a batch of price strings into `ParsedPrice[]`, dropping entries that
 * can't be parsed. Used by multi-store monitoring + price intelligence tests.
 */
export function parsePriceBatch(prices: string[]): ParsedPrice[] {
  return prices
    .map((p) => parsePrice(p))
    .filter((p): p is ParsedPrice => p !== null)
}

export interface PriceStats {
  min: number
  max: number
  mean: number
  median: number
  count: number
  currency: Currency
}

export function priceStats(parsed: ParsedPrice[]): PriceStats | null {
  if (parsed.length === 0) return null
  // All must share a currency for meaningful stats
  const currency = parsed[0].currency
  const amounts = parsed
    .filter((p) => p.currency === currency)
    .map((p) => p.amount)
    .sort((a, b) => a - b)
  if (amounts.length === 0) return null
  const sum = amounts.reduce((a, b) => a + b, 0)
  const mid = Math.floor(amounts.length / 2)
  const median =
    amounts.length % 2 === 0
      ? (amounts[mid - 1] + amounts[mid]) / 2
      : amounts[mid]
  return {
    min: amounts[0],
    max: amounts[amounts.length - 1],
    mean: Math.round(sum / amounts.length),
    median,
    count: amounts.length,
    currency
  }
}
