/**
 * JSON Parser for bulk profile import.
 *
 * Accepts an array of profile objects:
 * [{ name, preset, notes?, proxy_id?, group_id?, fingerprint?, cookies? }]
 */

export interface JSONProfileRow {
  name: string
  preset: string
  notes: string
  proxy_id: string | null
  group_id: string | null
  fingerprint_json: string | null
  cookies_json: string | null
}

export interface JSONParseResult {
  rows: JSONProfileRow[]
  errors: { index: number; message: string }[]
}

export function parseJSON(text: string): JSONParseResult {
  const errors: { index: number; message: string }[] = []
  let data: any

  try {
    data = JSON.parse(text)
  } catch (e: any) {
    return { rows: [], errors: [{ index: 0, message: `Invalid JSON: ${e.message}` }] }
  }

  if (!Array.isArray(data)) {
    return { rows: [], errors: [{ index: 0, message: 'JSON must be an array of profile objects' }] }
  }

  const rows: JSONProfileRow[] = []

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    if (!item || typeof item !== 'object') {
      errors.push({ index: i, message: `Item ${i}: must be an object` })
      continue
    }

    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const preset = typeof item.preset === 'string' ? item.preset.trim() : ''

    if (!name) {
      errors.push({ index: i, message: `Item ${i}: missing "name" field` })
      continue
    }
    if (!preset) {
      errors.push({ index: i, message: `Item ${i} ("${name}"): missing "preset" field` })
      continue
    }

    const notes = typeof item.notes === 'string' ? item.notes : ''
    const proxyId = typeof item.proxy_id === 'string' ? item.proxy_id || null : null
    const groupId = typeof item.group_id === 'string' ? item.group_id || null : null

    let fpJson: string | null = null
    if (item.fingerprint && typeof item.fingerprint === 'object') {
      fpJson = JSON.stringify(item.fingerprint)
    } else if (typeof item.fingerprint === 'string') {
      try {
        JSON.parse(item.fingerprint)
        fpJson = item.fingerprint
      } catch {
        errors.push({ index: i, message: `Item ${i} ("${name}"): invalid fingerprint JSON` })
        continue
      }
    }

    let cookiesJson: string | null = null
    if (item.cookies) {
      if (Array.isArray(item.cookies)) {
        cookiesJson = JSON.stringify(item.cookies)
      } else if (typeof item.cookies === 'string') {
        try {
          JSON.parse(item.cookies)
          cookiesJson = item.cookies
        } catch {
          errors.push({ index: i, message: `Item ${i} ("${name}"): invalid cookies JSON` })
          continue
        }
      }
    }

    rows.push({ name, preset, notes, proxy_id: proxyId, group_id: groupId, fingerprint_json: fpJson, cookies_json: cookiesJson })
  }

  return { rows, errors }
}
