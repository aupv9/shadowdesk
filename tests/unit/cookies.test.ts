import { describe, it, expect } from 'vitest'
import { parseNetscapeCookies, toNetscapeFormat } from '../../src/main/utils/cookies'

describe('parseNetscapeCookies', () => {
  it('parses a basic Netscape cookie line', () => {
    const text = '.example.com\tTRUE\t/\tFALSE\t1700000000\tsession\tabc123'
    const result = parseNetscapeCookies(text)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      domain: '.example.com',
      path: '/',
      secure: false,
      name: 'session',
      value: 'abc123',
      httpOnly: false
    })
  })

  it('parses HttpOnly prefix', () => {
    const text = '#HttpOnly_.example.com\tTRUE\t/\tTRUE\t0\tauth\ttoken'
    const result = parseNetscapeCookies(text)
    expect(result[0].httpOnly).toBe(true)
    expect(result[0].domain).toBe('.example.com')
    expect(result[0].secure).toBe(true)
  })

  it('parses expires timestamp', () => {
    const text = '.example.com\tTRUE\t/\tFALSE\t9999999999\tcookie\tvalue'
    const result = parseNetscapeCookies(text)
    expect(result[0].expires).toBe(9999999999)
  })

  it('returns undefined expires for 0', () => {
    const text = '.example.com\tTRUE\t/\tFALSE\t0\tcookie\tvalue'
    const result = parseNetscapeCookies(text)
    expect(result[0].expires).toBeUndefined()
  })

  it('skips comment lines starting with #', () => {
    const text = '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t0\tcookie\tvalue'
    const result = parseNetscapeCookies(text)
    expect(result).toHaveLength(1)
  })

  it('skips lines with not enough fields', () => {
    const text = '.example.com\tTRUE\t/'
    const result = parseNetscapeCookies(text)
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(parseNetscapeCookies('')).toEqual([])
    expect(parseNetscapeCookies('\n\n\n')).toEqual([])
  })

  it('handles multiple cookies', () => {
    const text = [
      '.a.com\tTRUE\t/\tFALSE\t0\tcookie1\tv1',
      '.b.com\tTRUE\t/path\tTRUE\t1234\tcookie2\tv2'
    ].join('\n')
    const result = parseNetscapeCookies(text)
    expect(result).toHaveLength(2)
    expect(result[1].name).toBe('cookie2')
    expect(result[1].path).toBe('/path')
  })

  it('trims trailing whitespace from value', () => {
    const text = '.example.com\tTRUE\t/\tFALSE\t0\tcookie\tvalue   '
    const result = parseNetscapeCookies(text)
    expect(result[0].value).toBe('value')
  })
})

describe('toNetscapeFormat', () => {
  it('produces valid header', () => {
    const output = toNetscapeFormat([])
    expect(output).toContain('# Netscape HTTP Cookie File')
  })

  it('serializes a basic cookie', () => {
    const cookies = [{ domain: '.example.com', httpOnly: false, path: '/', secure: false, expires: 0, name: 'session', value: 'abc' }]
    const output = toNetscapeFormat(cookies)
    expect(output).toContain('.example.com\tTRUE\t/\tFALSE\t0\tsession\tabc')
  })

  it('serializes httpOnly cookie with prefix', () => {
    const cookies = [{ domain: '.example.com', httpOnly: true, path: '/', secure: true, expires: 1234, name: 'auth', value: 'tok' }]
    const output = toNetscapeFormat(cookies)
    expect(output).toContain('#HttpOnly_.example.com\tTRUE\t/\tTRUE\t1234\tauth\ttok')
  })

  it('roundtrips through parse and format', () => {
    const original = [
      { domain: '.example.com', httpOnly: false, path: '/', secure: false, expires: 9999, name: 'c1', value: 'v1' },
      { domain: '.other.com', httpOnly: true, path: '/app', secure: true, expires: undefined, name: 'c2', value: 'v2' }
    ]
    const formatted = toNetscapeFormat(original)
    const parsed = parseNetscapeCookies(formatted)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].name).toBe('c1')
    expect(parsed[1].name).toBe('c2')
    expect(parsed[1].httpOnly).toBe(true)
  })
})
