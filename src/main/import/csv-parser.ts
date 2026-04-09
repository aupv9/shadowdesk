/**
 * CSV Parser for bulk profile import.
 *
 * Supports full format: name,preset,notes,proxy_id,group_id,fingerprint_json
 * All fields after `name` and `preset` are optional.
 */

export interface CSVRow {
  name: string
  preset: string
  notes: string
  proxy_id: string | null
  group_id: string | null
  fingerprint_json: string | null
}

const REQUIRED_HEADERS = ['name', 'preset']
const KNOWN_HEADERS = ['name', 'preset', 'notes', 'proxy_id', 'group_id', 'fingerprint_json']

/** Parse a single CSV line respecting quoted fields */
function parseLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

export interface CSVParseResult {
  rows: CSVRow[]
  errors: { line: number; message: string }[]
  headers: string[]
}

export function parseCSV(text: string): CSVParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const errors: { line: number; message: string }[] = []

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: 'CSV file is empty' }], headers: [] }
  }

  // Parse header row
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().trim())

  // Validate required headers
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) {
      errors.push({ line: 1, message: `Missing required header: "${req}"` })
    }
  }

  // Warn about unknown headers
  for (const h of headers) {
    if (!KNOWN_HEADERS.includes(h)) {
      errors.push({ line: 1, message: `Unknown header "${h}" will be ignored` })
    }
  }

  if (errors.some((e) => e.message.startsWith('Missing required'))) {
    return { rows: [], errors, headers }
  }

  const nameIdx = headers.indexOf('name')
  const presetIdx = headers.indexOf('preset')
  const notesIdx = headers.indexOf('notes')
  const proxyIdx = headers.indexOf('proxy_id')
  const groupIdx = headers.indexOf('group_id')
  const fpIdx = headers.indexOf('fingerprint_json')

  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1
    const fields = parseLine(lines[i])

    const name = fields[nameIdx]?.trim() ?? ''
    const preset = fields[presetIdx]?.trim() ?? ''

    if (!name) {
      errors.push({ line: lineNum, message: 'Missing profile name' })
      continue
    }
    if (!preset) {
      errors.push({ line: lineNum, message: `Profile "${name}": missing preset` })
      continue
    }

    const notes = notesIdx >= 0 ? (fields[notesIdx]?.trim() ?? '') : ''
    const proxyId = proxyIdx >= 0 ? normalizeNull(fields[proxyIdx]) : null
    const groupId = groupIdx >= 0 ? normalizeNull(fields[groupIdx]) : null
    const fpJson = fpIdx >= 0 ? normalizeNull(fields[fpIdx]) : null

    // Validate fingerprint JSON if provided
    if (fpJson) {
      try {
        JSON.parse(fpJson)
      } catch {
        errors.push({ line: lineNum, message: `Profile "${name}": invalid fingerprint_json` })
        continue
      }
    }

    rows.push({ name, preset, notes, proxy_id: proxyId, group_id: groupId, fingerprint_json: fpJson })
  }

  return { rows, errors, headers }
}

function normalizeNull(val: string | undefined): string | null {
  if (!val) return null
  const trimmed = val.trim()
  if (trimmed === '' || trimmed.toLowerCase() === 'null') return null
  return trimmed
}
