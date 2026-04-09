/**
 * Ghost Browser — E-Commerce Operations offline test harness
 *
 * Pure-Node HTML parser + minimal CSS selector matcher. Exists so the offline
 * test suite can validate workflow selectors against fixture HTML without
 * pulling in a DOM library (jsdom / happy-dom / cheerio).
 *
 * Scope — only the selector forms the real workflow templates actually use:
 *
 *   tagName
 *   .class
 *   #id
 *   [attr]                        (attribute presence)
 *   [attr="value"]                (exact match; quotes optional)
 *   [attr*="value"]               (substring match)
 *   combined:  div.shopee-search-item-result__item
 *   multi-class: div.F9RHbS.dQEiAI.jMXp4d
 *   descendant: div.RfADt a
 *   union:     div._44qnta, div.vR6K3w
 *
 * Intentional non-goals: pseudo-classes, sibling combinators, :nth-child,
 * attribute ^= / $=, namespaces, case-insensitivity flags. Add only when a
 * real workflow template requires it.
 */

export interface ParsedElement {
  index: number
  tag: string
  attrs: Record<string, string>
  classes: Set<string>
  id: string | null
  /** Offset just after the opening tag `>`. */
  innerStart: number
  /** Offset of the matching `</tag>`. */
  innerEnd: number
  /** Rendered text content — tags stripped, entities decoded, whitespace collapsed. */
  textContent: string
  /** Index of parent element in the flat list, or -1 for root. */
  parentIdx: number
  /** Self-closing / void element (no children). */
  voidTag: boolean
}

// HTML5 void elements — no closing tag, no children.
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'param', 'source', 'track', 'wbr'
])

// HTML elements whose content is raw text (don't parse children).
const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title'])

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAttrs(raw: string): Record<string, string> {
  // raw = the bit between the tag name and the closing >
  const out: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase()
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    out[name] = decodeEntities(value)
  }
  return out
}

/**
 * Parse an HTML string into a flat list of ParsedElement entries in document
 * order. Uses a stack to track parent/child relationships.
 *
 * This is deliberately forgiving: it skips doctype, comments, and CDATA, and
 * treats malformed markup as plain text rather than erroring out.
 */
export function parseHtml(html: string): ParsedElement[] {
  const elements: ParsedElement[] = []
  const stack: number[] = [] // indices into `elements`
  let i = 0
  const len = html.length

  while (i < len) {
    // Skip doctype
    if (html.startsWith('<!', i)) {
      const close = html.indexOf('>', i)
      if (close === -1) break
      i = close + 1
      continue
    }
    // Skip comments
    if (html.startsWith('<!--', i)) {
      const close = html.indexOf('-->', i + 4)
      if (close === -1) break
      i = close + 3
      continue
    }

    if (html[i] === '<') {
      // Closing tag?
      if (html[i + 1] === '/') {
        const close = html.indexOf('>', i)
        if (close === -1) break
        const tag = html.slice(i + 2, close).trim().toLowerCase()
        // Pop matching element off the stack
        for (let s = stack.length - 1; s >= 0; s--) {
          if (elements[stack[s]].tag === tag) {
            elements[stack[s]].innerEnd = i
            elements[stack[s]].textContent = stripTags(
              html.slice(elements[stack[s]].innerStart, i)
            )
            stack.length = s
            break
          }
        }
        i = close + 1
        continue
      }

      // Opening tag
      const close = html.indexOf('>', i)
      if (close === -1) break
      const rawTag = html.slice(i + 1, close)
      // rawTag may end with / for self-closing — strip it
      const selfClosing = rawTag.endsWith('/')
      const tagBody = selfClosing ? rawTag.slice(0, -1) : rawTag

      // Split tag name and attrs
      const nameMatch = tagBody.match(/^([a-zA-Z][a-zA-Z0-9-]*)/)
      if (!nameMatch) {
        i = close + 1
        continue
      }
      const tag = nameMatch[1].toLowerCase()
      const attrs = parseAttrs(tagBody.slice(nameMatch[0].length))
      const classes = new Set<string>(
        (attrs.class ?? '').split(/\s+/).filter(Boolean)
      )
      const id = attrs.id || null
      const voidTag = VOID_TAGS.has(tag) || selfClosing

      const el: ParsedElement = {
        index: elements.length,
        tag,
        attrs,
        classes,
        id,
        innerStart: close + 1,
        innerEnd: close + 1,
        textContent: '',
        parentIdx: stack.length > 0 ? stack[stack.length - 1] : -1,
        voidTag
      }
      elements.push(el)

      if (!voidTag) {
        // Raw-text containers: fast-forward to the matching closer
        if (RAW_TEXT_TAGS.has(tag)) {
          const closer = new RegExp(`</${tag}\\s*>`, 'i')
          const rest = html.slice(close + 1)
          const m = closer.exec(rest)
          if (m) {
            el.innerEnd = close + 1 + m.index
            el.textContent = stripTags(html.slice(el.innerStart, el.innerEnd))
            i = close + 1 + m.index + m[0].length
          } else {
            el.innerEnd = len
            el.textContent = stripTags(html.slice(el.innerStart, len))
            i = len
          }
        } else {
          stack.push(el.index)
          i = close + 1
        }
      } else {
        i = close + 1
      }
      continue
    }

    // Plain text — skip until next `<`
    const next = html.indexOf('<', i)
    if (next === -1) break
    i = next
  }

  // Flush any unclosed elements (innerEnd already defaults to close+1 which is wrong —
  // use `len` so textContent captures everything after the opening tag).
  for (const openIdx of stack) {
    const el = elements[openIdx]
    el.innerEnd = len
    el.textContent = stripTags(html.slice(el.innerStart, len))
  }

  return elements
}

// ─── Selector parser ─────────────────────────────────────────────────────────

export interface CompoundSelector {
  tag: string | null
  id: string | null
  classes: string[]
  attrs: {
    name: string
    op: 'exists' | 'eq' | 'contains'
    value: string
  }[]
}

/** A complex selector is a chain of compound selectors joined by descendant combinators. */
export type ComplexSelector = CompoundSelector[]

/** A full selector list is a union of complex selectors (comma-separated). */
export type SelectorList = ComplexSelector[]

/**
 * Bracket-and-quote-aware split on a delimiter character. Commas, spaces
 * and other delimiters inside `[...]`, `"..."`, or `'...'` are preserved.
 *
 * Needed because selectors like `input[placeholder*="delivery address"]`
 * contain a space inside an attribute value — a naive split would chop it in
 * half. Same story for a comma inside a selector union like
 * `div[data-x="a,b"], span`.
 */
function smartSplit(src: string, delim: (ch: string) => boolean): string[] {
  const out: string[] = []
  let buf = ''
  let bracketDepth = 0
  let quote: '"' | "'" | null = null
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quote) {
      buf += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      buf += ch
      continue
    }
    if (ch === '[') { bracketDepth++; buf += ch; continue }
    if (ch === ']') { bracketDepth = Math.max(0, bracketDepth - 1); buf += ch; continue }
    if (bracketDepth === 0 && delim(ch)) {
      if (buf.trim()) out.push(buf.trim())
      buf = ''
      continue
    }
    buf += ch
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

export function parseSelector(selector: string): SelectorList {
  const lists = smartSplit(selector, (ch) => ch === ',')
  return lists.map((sel) => {
    const compounds = smartSplit(sel, (ch) => /\s/.test(ch))
    return compounds.map(parseCompound)
  })
}

function parseCompound(src: string): CompoundSelector {
  const compound: CompoundSelector = {
    tag: null,
    id: null,
    classes: [],
    attrs: []
  }
  let i = 0
  const len = src.length

  // Leading tag name (optional)
  const tagMatch = src.slice(i).match(/^[a-zA-Z][a-zA-Z0-9-]*/)
  if (tagMatch) {
    compound.tag = tagMatch[0].toLowerCase()
    i += tagMatch[0].length
  }

  while (i < len) {
    const ch = src[i]
    if (ch === '.') {
      const m = src.slice(i + 1).match(/^[\w-]+/)
      if (!m) break
      compound.classes.push(m[0])
      i += 1 + m[0].length
    } else if (ch === '#') {
      const m = src.slice(i + 1).match(/^[\w-]+/)
      if (!m) break
      compound.id = m[0]
      i += 1 + m[0].length
    } else if (ch === '[') {
      const close = src.indexOf(']', i)
      if (close === -1) break
      const body = src.slice(i + 1, close)
      // [name], [name=val], [name="val"], [name*=val], [name*="val"]
      const attrMatch = body.match(
        /^([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:(\*?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s"'\]]+)))?$/
      )
      if (attrMatch) {
        const name = attrMatch[1].toLowerCase()
        const opRaw = attrMatch[2]
        const value = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? ''
        const op: 'exists' | 'eq' | 'contains' =
          !opRaw ? 'exists' : opRaw === '*=' ? 'contains' : 'eq'
        compound.attrs.push({ name, op, value })
      }
      i = close + 1
    } else {
      // Unknown — bail out
      break
    }
  }

  return compound
}

// ─── Matching ────────────────────────────────────────────────────────────────

function matchesCompound(el: ParsedElement, comp: CompoundSelector): boolean {
  if (comp.tag && el.tag !== comp.tag) return false
  if (comp.id && el.id !== comp.id) return false
  for (const cls of comp.classes) {
    if (!el.classes.has(cls)) return false
  }
  for (const attr of comp.attrs) {
    const actual = el.attrs[attr.name]
    if (actual === undefined) return false
    if (attr.op === 'eq' && actual !== attr.value) return false
    if (attr.op === 'contains' && !actual.includes(attr.value)) return false
  }
  return true
}

function matchesComplex(
  el: ParsedElement,
  complex: ComplexSelector,
  all: ParsedElement[]
): boolean {
  // The last compound must match `el` itself; earlier compounds must match
  // any ancestor chain (descendant combinator only).
  if (complex.length === 0) return false
  if (!matchesCompound(el, complex[complex.length - 1])) return false
  if (complex.length === 1) return true

  let parentIdx = el.parentIdx
  let compoundIdx = complex.length - 2
  while (parentIdx >= 0 && compoundIdx >= 0) {
    const parent = all[parentIdx]
    if (matchesCompound(parent, complex[compoundIdx])) {
      compoundIdx--
    }
    parentIdx = parent.parentIdx
  }
  return compoundIdx < 0
}

export interface QueryResult {
  element: ParsedElement
  textContent: string
}

/**
 * Run a CSS selector against a previously-parsed HTML document. Mirrors
 * `document.querySelectorAll` for the selector subset above.
 */
export function querySelectorAll(
  parsed: ParsedElement[],
  selector: string
): QueryResult[] {
  const list = parseSelector(selector)
  const out: QueryResult[] = []
  for (const el of parsed) {
    for (const complex of list) {
      if (matchesComplex(el, complex, parsed)) {
        out.push({ element: el, textContent: el.textContent })
        break
      }
    }
  }
  return out
}

export function querySelector(
  parsed: ParsedElement[],
  selector: string
): QueryResult | null {
  const list = parseSelector(selector)
  for (const el of parsed) {
    for (const complex of list) {
      if (matchesComplex(el, complex, parsed)) {
        return { element: el, textContent: el.textContent }
      }
    }
  }
  return null
}

/** Convenience — parse once and query repeatedly. */
export class HtmlDoc {
  readonly elements: ParsedElement[]
  constructor(html: string) {
    this.elements = parseHtml(html)
  }
  query(sel: string): QueryResult | null {
    return querySelector(this.elements, sel)
  }
  queryAll(sel: string): QueryResult[] {
    return querySelectorAll(this.elements, sel)
  }
  /** Returns only text contents — matches the common extractText(all=true) shape. */
  extractAll(sel: string): string[] {
    return this.queryAll(sel).map((r) => r.textContent)
  }
  extract(sel: string): string | null {
    const r = this.query(sel)
    return r ? r.textContent : null
  }
}
