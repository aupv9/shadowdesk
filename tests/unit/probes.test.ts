/**
 * External probe manifest — evaluation and rot behaviour.
 *
 * The load-bearing property here is not "does a probe pass". It is that a
 * probe whose selector has rotted reports `unavailable` and a maintenance
 * warning, never `fail`. The SEA workflow templates already show the cost of
 * getting this wrong: selectors verified against saved fixtures stay green
 * while the live site has moved on. Here the failure mode would be worse —
 * every user's score silently drops the day CreepJS changes its layout.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  evaluateExtraction,
  applyPattern,
  loadManifest,
  probeVector,
  type DetectionProbe,
  type Extraction
} from '../../src/main/detection/probes'

const probe = (over: Partial<DetectionProbe> = {}): DetectionProbe => ({
  id: 'test',
  name: 'Test probe',
  url: 'https://example.com/',
  category: 'Browser',
  severity: 'high',
  settleMs: 0,
  timeoutMs: 1000,
  lastVerified: null,
  extract: { kind: 'count', selector: '.failed' },
  expect: { type: 'maxCount', value: 0 },
  ...over
})

describe('rot handling — the point of the whole design', () => {
  it('reports a selector that matched nothing as unavailable, not failed', () => {
    const missing: Extraction = { kind: 'missing', reason: 'selector ".failed" matched nothing' }
    const outcome = evaluateExtraction(probe(), missing)

    expect(outcome.status).toBe('unavailable')
    expect(outcome.status).not.toBe('fail')
  })

  it('says the manifest may be stale so the cause is actionable', () => {
    const outcome = evaluateExtraction(probe(), { kind: 'missing', reason: 'pattern did not match' })
    expect(outcome.detail).toContain('stale')
    expect(outcome.detail).toContain('test')
  })

  it('reports non-numeric text where a number was expected as unavailable', () => {
    // The page still renders, but the thing we used to read is now prose.
    const outcome = evaluateExtraction(
      probe({ extract: { kind: 'text', selector: 'body' }, expect: { type: 'minScore', value: 70 } }),
      { kind: 'text', text: 'Trust score unavailable' }
    )
    expect(outcome.status).toBe('unavailable')
    expect(outcome.detail).toContain('where a number was expected')
  })

  it('marks results from an unverified manifest so nobody over-reads them', () => {
    const v = probeVector(probe(), { status: 'pass', detail: '0 (allowed up to 0)' })
    expect(v.detail).toContain('selectors unverified')
  })

  it('drops the caveat once a probe has been verified against the live target', () => {
    const v = probeVector(probe({ lastVerified: '2026-08-13' }), { status: 'pass', detail: 'ok' })
    expect(v.detail).not.toContain('unverified')
  })
})

describe('maxCount expectations', () => {
  it('passes when nothing failed', () => {
    expect(evaluateExtraction(probe(), { kind: 'count', count: 0 }).status).toBe('pass')
  })

  it('fails when the target reported failures', () => {
    const outcome = evaluateExtraction(probe(), { kind: 'count', count: 3 })
    expect(outcome.status).toBe('fail')
    expect(outcome.detail).toContain('3 exceeds')
  })

  it('reads a numeric string extraction as a count', () => {
    const outcome = evaluateExtraction(
      probe({ extract: { kind: 'text', selector: '#lies' } }),
      { kind: 'text', text: '2' }
    )
    expect(outcome.status).toBe('fail')
  })
})

describe('minScore expectations', () => {
  const scored = probe({
    extract: { kind: 'text', selector: 'body' },
    expect: { type: 'minScore', value: 70 }
  })

  it('passes at or above the threshold', () => {
    expect(evaluateExtraction(scored, { kind: 'text', text: '70' }).status).toBe('pass')
    expect(evaluateExtraction(scored, { kind: 'text', text: '95' }).status).toBe('pass')
  })

  it('fails below it', () => {
    const outcome = evaluateExtraction(scored, { kind: 'text', text: '42' })
    expect(outcome.status).toBe('fail')
    expect(outcome.detail).toContain('below the minimum')
  })

  it('keeps the raw reading for auditing a surprising verdict', () => {
    expect(evaluateExtraction(scored, { kind: 'text', text: '42' }).raw).toBe('42')
  })
})

describe('notContains expectations', () => {
  const textual = probe({
    extract: { kind: 'text', selector: 'body' },
    expect: { type: 'notContains', values: ['HeadlessChrome', 'webdriver'] }
  })

  it('fails when a flagged string is present, and names which one', () => {
    const outcome = evaluateExtraction(textual, { kind: 'text', text: 'UA: HeadlessChrome/120' })
    expect(outcome.status).toBe('fail')
    expect(outcome.detail).toContain('HeadlessChrome')
  })

  it('passes when none are', () => {
    expect(evaluateExtraction(textual, { kind: 'text', text: 'UA: Chrome/120' }).status).toBe('pass')
  })

  it('is unavailable rather than wrong when handed a count', () => {
    expect(evaluateExtraction(textual, { kind: 'count', count: 0 }).status).toBe('unavailable')
  })
})

describe('applyPattern', () => {
  it('returns trimmed text when no pattern is configured', () => {
    expect(applyPattern('  hello  ', undefined, undefined)).toEqual({ kind: 'text', text: 'hello' })
  })

  it('extracts the requested capture group', () => {
    const out = applyPattern('trust score: 87%', 'trust\\s*score[^0-9]{0,20}([0-9]{1,3})', 1)
    expect(out).toEqual({ kind: 'text', text: '87' })
  })

  it('is case-insensitive, since these pages restyle their own labels', () => {
    const out = applyPattern('TRUST SCORE 91', 'trust\\s*score[^0-9]{0,20}([0-9]{1,3})', 1)
    expect(out).toEqual({ kind: 'text', text: '91' })
  })

  it('reports a non-matching pattern as missing, not as an empty reading', () => {
    const out = applyPattern('nothing here', 'trust score ([0-9]+)', 1)
    expect(out.kind).toBe('missing')
  })

  it('survives an invalid regex in an operator override', () => {
    const out = applyPattern('anything', '([unclosed', 1)
    expect(out).toEqual({ kind: 'missing', reason: 'invalid pattern /([unclosed/' })
  })
})

describe('manifest loading', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'shadowdesk-probes-'))
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('ships probes out of the box', () => {
    const m = loadManifest()
    expect(m.probes.length).toBeGreaterThan(0)
    expect(m.probes.every((p) => p.url.startsWith('https://'))).toBe(true)
  })

  it('ships every probe unverified — nothing here was confirmed against a live target', () => {
    expect(loadManifest().probes.every((p) => p.lastVerified === null)).toBe(true)
  })

  it('lets an operator repair one rotted selector without restating the manifest', () => {
    writeFileSync(
      join(dir, 'probes.json'),
      JSON.stringify({ probes: [{ id: 'sannysoft', extract: { kind: 'count', selector: '.new-class' } }] })
    )
    const m = loadManifest(dir)
    const patched = m.probes.find((p) => p.id === 'sannysoft')!

    expect((patched.extract as any).selector).toBe('.new-class')
    // Untouched fields survive the merge.
    expect(patched.url).toBe('https://bot.sannysoft.com/')
    expect(m.probes).toHaveLength(loadManifest().probes.length)
  })

  it('accepts a wholly new probe from an override', () => {
    writeFileSync(
      join(dir, 'probes.json'),
      JSON.stringify({
        probes: [{ id: 'custom', name: 'Custom', url: 'https://x.test/', category: 'Browser',
                   severity: 'low', settleMs: 0, timeoutMs: 1000, lastVerified: null,
                   extract: { kind: 'count', selector: '.x' }, expect: { type: 'maxCount', value: 0 } }]
      })
    )
    expect(loadManifest(dir).probes.some((p) => p.id === 'custom')).toBe(true)
  })

  it('falls back to the bundled manifest when an override is malformed', () => {
    writeFileSync(join(dir, 'probes.json'), '{ not json')
    expect(loadManifest(dir).probes).toEqual(loadManifest().probes)
  })

  it('ignores an override with no probes array', () => {
    writeFileSync(join(dir, 'probes.json'), JSON.stringify({ manifestVersion: '9' }))
    expect(loadManifest(dir).probes).toEqual(loadManifest().probes)
  })
})

describe('probeVector', () => {
  it('carries the probe source so it scores as risk, not injection', () => {
    expect(probeVector(probe(), { status: 'pass', detail: 'ok' }).source).toBe('probe')
  })

  it('preserves the manifest severity — a detected lie is fatal', () => {
    const v = probeVector(probe({ severity: 'fatal' }), { status: 'fail', detail: '2 exceeds 0' })
    expect(v.severity).toBe('fatal')
    expect(v.passed).toBe(false)
  })

  it('surfaces the raw reading in the detail for auditing', () => {
    const v = probeVector(probe(), { status: 'fail', detail: '3 exceeds 0', raw: '3' })
    expect(v.detail).toContain('read: 3')
  })
})
