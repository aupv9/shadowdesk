/**
 * Bulk Import Engine (Phase 1+2)
 *
 * Supports ZIP bundle, CSV, and JSON import formats.
 * Features: dry-run preview, duplicate detection, selective fields,
 * audit logging, batch post-import assignment.
 */

import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import { Database } from '../database'
import { resolveFingerprint } from '../fingerprint/presets'
import { parseCSV, type CSVRow } from './csv-parser'
import { parseJSON, type JSONProfileRow } from './json-parser'
import {
  detectDuplicates,
  generateUniqueName,
  computeFingerprintHash,
  type DuplicateMatch
} from './duplicate-detector'
import type {
  ImportFormat,
  ImportOptions,
  ImportPreviewRow,
  ImportPreviewResult,
  ImportResult,
  SelectiveFields
} from '../../shared/types'

// ── Normalised import row (format-agnostic) ────────────────────────────────

interface NormalisedRow {
  name: string
  preset: string
  notes: string
  proxyId: string | null
  groupId: string | null
  fingerprint: object | null // parsed JSON
  cookies: string | null     // raw JSON string
}

// ── Parse helpers ───────────────────────────────────────────────────────────

function normaliseCSVRows(rows: CSVRow[]): NormalisedRow[] {
  return rows.map((r) => ({
    name: r.name,
    preset: r.preset,
    notes: r.notes,
    proxyId: r.proxy_id,
    groupId: r.group_id,
    fingerprint: r.fingerprint_json ? JSON.parse(r.fingerprint_json) : null,
    cookies: null
  }))
}

function normaliseJSONRows(rows: JSONProfileRow[]): NormalisedRow[] {
  return rows.map((r) => ({
    name: r.name,
    preset: r.preset,
    notes: r.notes,
    proxyId: r.proxy_id,
    groupId: r.group_id,
    fingerprint: r.fingerprint_json ? JSON.parse(r.fingerprint_json) : null,
    cookies: r.cookies_json
  }))
}

function parseZipBundle(buffer: Buffer): { row: NormalisedRow; cookies: string | null } {
  const zip = new AdmZip(buffer)
  const metaEntry = zip.getEntry('profile.json')
  const fpEntry = zip.getEntry('fingerprint.json')
  const ckEntry = zip.getEntry('cookies.json')

  if (!metaEntry || !fpEntry) throw new Error('Invalid bundle: missing profile.json or fingerprint.json')

  const meta = JSON.parse(metaEntry.getData().toString('utf8'))
  const fingerprint = JSON.parse(fpEntry.getData().toString('utf8'))
  const cookies = ckEntry ? ckEntry.getData().toString('utf8') : null

  return {
    row: {
      name: meta.name ?? 'Unnamed',
      preset: fingerprint.preset ?? 'win10-chrome120',
      notes: meta.notes ?? '',
      proxyId: null,
      groupId: null,
      fingerprint
    },
    cookies
  }
}

// ── Known presets (for validation) ──────────────────────────────────────────

const KNOWN_PRESETS = new Set([
  'win10-chrome120', 'win11-chrome121', 'mac-ventura-chrome120', 'mac-sonoma-chrome121',
  'linux-ubuntu-chrome120', 'android-samsung-chrome120', 'android-pixel-chrome121',
  'android-oppo-chrome120', 'ios-iphone14-safari17', 'ios-iphone15-safari17', 'ios-ipad-safari17',
  // Extended presets
  'win11-chrome124', 'mac-sonoma-chrome124', 'linux-ubuntu-chrome124',
  'win11-firefox124', 'mac-sonoma-firefox124', 'linux-ubuntu-firefox124',
  'win11-edge124', 'mac-sonoma-edge124',
  'win11-brave124', 'mac-sonoma-brave124',
  'android-samsung-chrome124', 'android-pixel-chrome124',
  'ios-iphone15-safari174', 'ios-ipad-safari174'
])

// ── Preview (dry-run) ───────────────────────────────────────────────────────

export function previewImport(
  db: Database,
  rows: NormalisedRow[]
): ImportPreviewResult {
  const previewRows: ImportPreviewRow[] = []

  // Track names we've already seen in this batch (intra-batch duplicates)
  const seenNames = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const errors: string[] = []

    // Validate name
    if (!row.name || row.name.length > 255) {
      errors.push('Name is required and must be <= 255 characters')
    }

    // Validate preset
    if (!KNOWN_PRESETS.has(row.preset)) {
      errors.push(`Unknown preset: "${row.preset}"`)
    }

    // Validate notes length
    if (row.notes && row.notes.length > 2000) {
      errors.push('Notes must be <= 2000 characters')
    }

    // Validate proxy_id FK if provided
    if (row.proxyId) {
      if (!db.findProxyById(row.proxyId)) errors.push(`Proxy "${row.proxyId}" not found`)
    }

    // Validate group_id FK if provided
    if (row.groupId) {
      if (!db.findGroupById(row.groupId)) errors.push(`Group "${row.groupId}" not found`)
    }

    // Check intra-batch duplicate
    const lowerName = row.name.toLowerCase()
    if (seenNames.has(lowerName)) {
      errors.push('Duplicate name within this import batch')
    }
    seenNames.add(lowerName)

    // Check database duplicates
    const dup = detectDuplicates(db, row.name, row.fingerprint)

    let status: 'ready' | 'duplicate' | 'error' = 'ready'
    if (errors.length > 0) status = 'error'
    else if (dup) status = 'duplicate'

    previewRows.push({
      index: i,
      name: row.name,
      preset: row.preset,
      notes: row.notes,
      proxyId: row.proxyId,
      groupId: row.groupId,
      fingerprintProvided: !!row.fingerprint,
      cookiesProvided: !!row.cookies,
      isDuplicate: !!dup,
      duplicateOf: dup ? { id: dup.existingId, name: dup.existingName } : undefined,
      duplicateType: dup?.type,
      errors,
      status
    })
  }

  return {
    totalRows: rows.length,
    validCount: previewRows.filter((r) => r.status === 'ready').length,
    duplicateCount: previewRows.filter((r) => r.status === 'duplicate').length,
    errorCount: previewRows.filter((r) => r.status === 'error').length,
    rows: previewRows
  }
}

// ── Execute import ──────────────────────────────────────────────────────────

export function executeImport(
  db: Database,
  rows: NormalisedRow[],
  options: ImportOptions,
  originalFilename: string | null
): ImportResult {
  const sessionId = uuidv4()
  const profileIds: string[] = []
  const errorRecords: Array<{ name: string; status: string; error: string | null; duplicateOf: string | null; profileId: string | null }> = []
  let successCount = 0
  let errorCount = 0
  let duplicateCount = 0
  let skippedCount = 0

  // Create import session
  db.execSQL(
    `INSERT INTO import_sessions (id, file_count, import_source, original_filename)
     VALUES (?, ?, ?, ?)`,
    [sessionId, rows.length, options.format, originalFilename]
  )

  for (const row of rows) {
    const recordId = uuidv4()

    try {
      // Duplicate detection
      const dup = detectDuplicates(db, row.name, row.fingerprint)
      if (dup) {
        if (options.duplicateResolution === 'skip') {
          duplicateCount++
          db.execSQL(
            `INSERT INTO import_records (id, session_id, profile_name, status, duplicate_of)
             VALUES (?, ?, ?, 'duplicate', ?)`,
            [recordId, sessionId, row.name, dup.existingId]
          )
          errorRecords.push({ name: row.name, status: 'duplicate', error: `Duplicate of "${dup.existingName}"`, duplicateOf: dup.existingId, profileId: null })
          continue
        } else if (options.duplicateResolution === 'rename') {
          row.name = generateUniqueName(db, row.name)
        }
        // 'overwrite' falls through — creates a new profile with same name
      }

      // Resolve fingerprint
      const newId = uuidv4()
      let fingerprint: object
      if (options.selectiveFields.fingerprint && row.fingerprint) {
        fingerprint = row.fingerprint
      } else {
        fingerprint = resolveFingerprint(row.preset, newId)
      }

      const userDataPath = join(app.getPath('userData'), 'profiles', newId)

      const profileName = options.selectiveFields.name ? row.name : `Profile ${newId.slice(0, 8)}`
      const profileNotes = options.selectiveFields.notes ? (row.notes ?? '') : ''
      const proxyId = options.assignProxyId ?? row.proxyId ?? null
      const groupId = options.assignGroupId ?? row.groupId ?? null

      // Create profile
      db.createProfile({
        id: newId,
        name: profileName,
        fingerprint,
        proxy_id: proxyId,
        notes: profileNotes,
        user_data_path: userDataPath
      })

      // Set group if provided
      if (groupId) {
        db.execSQL(`UPDATE profiles SET group_id = ? WHERE id = ?`, [groupId, newId])
      }

      // Store fingerprint hash for future duplicate detection
      const fpHash = computeFingerprintHash(fingerprint)
      db.execSQL(`UPDATE profiles SET fingerprint_hash = ? WHERE id = ?`, [fpHash, newId])

      // Import cookies if enabled and provided
      if (options.selectiveFields.cookies && row.cookies) {
        db.updateCookies(newId, row.cookies)
      }

      profileIds.push(newId)
      successCount++

      db.execSQL(
        `INSERT INTO import_records (id, session_id, profile_id, profile_name, status)
         VALUES (?, ?, ?, ?, 'success')`,
        [recordId, sessionId, newId, profileName]
      )
    } catch (err: any) {
      errorCount++
      db.execSQL(
        `INSERT INTO import_records (id, session_id, profile_name, status, error_message)
         VALUES (?, ?, ?, 'error', ?)`,
        [recordId, sessionId, row.name, err.message ?? 'Unknown error']
      )
      errorRecords.push({ name: row.name, status: 'error', error: err.message ?? 'Unknown error', duplicateOf: null, profileId: null })
    }
  }

  // Update session counts
  db.execSQL(
    `UPDATE import_sessions SET success_count = ?, error_count = ?, duplicate_count = ?, skipped_count = ?
     WHERE id = ?`,
    [successCount, errorCount, duplicateCount, skippedCount, sessionId]
  )

  return {
    sessionId,
    totalFiles: rows.length,
    successCount,
    errorCount,
    duplicateCount,
    skippedCount,
    profileIds,
    errors: errorRecords.map((r) => ({
      id: uuidv4(),
      session_id: sessionId,
      source_file: originalFilename,
      profile_id: r.profileId,
      profile_name: r.name,
      status: r.status as any,
      duplicate_of: r.duplicateOf,
      error_message: r.error,
      created_at: new Date().toISOString()
    }))
  }
}

// ── Public API (called from IPC handlers) ───────────────────────────────────

export function previewCSVImport(db: Database, csvText: string): ImportPreviewResult {
  const { rows, errors } = parseCSV(csvText)
  const normalised = normaliseCSVRows(rows)
  const preview = previewImport(db, normalised)
  // Merge parse errors into preview
  for (const e of errors) {
    preview.rows.push({
      index: e.line - 2, // line 1 = header, so data starts at line 2
      name: `(line ${e.line})`,
      preset: '',
      notes: '',
      proxyId: null,
      groupId: null,
      fingerprintProvided: false,
      cookiesProvided: false,
      isDuplicate: false,
      errors: [e.message],
      status: 'error'
    })
    preview.errorCount++
    preview.totalRows++
  }
  return preview
}

export function previewJSONImport(db: Database, jsonText: string): ImportPreviewResult {
  const { rows, errors } = parseJSON(jsonText)
  const normalised = normaliseJSONRows(rows)
  const preview = previewImport(db, normalised)
  for (const e of errors) {
    preview.rows.push({
      index: e.index,
      name: `(item ${e.index})`,
      preset: '',
      notes: '',
      proxyId: null,
      groupId: null,
      fingerprintProvided: false,
      cookiesProvided: false,
      isDuplicate: false,
      errors: [e.message],
      status: 'error'
    })
    preview.errorCount++
    preview.totalRows++
  }
  return preview
}

export function previewZIPImport(db: Database, zipBuffers: Buffer[]): ImportPreviewResult {
  const allRows: NormalisedRow[] = []
  const parseErrors: { index: number; message: string }[] = []

  for (let i = 0; i < zipBuffers.length; i++) {
    try {
      const { row } = parseZipBundle(zipBuffers[i])
      allRows.push(row)
    } catch (err: any) {
      parseErrors.push({ index: i, message: err.message })
    }
  }

  const preview = previewImport(db, allRows)
  for (const e of parseErrors) {
    preview.rows.push({
      index: e.index,
      name: `(file ${e.index + 1})`,
      preset: '',
      notes: '',
      proxyId: null,
      groupId: null,
      fingerprintProvided: false,
      cookiesProvided: false,
      isDuplicate: false,
      errors: [e.message],
      status: 'error'
    })
    preview.errorCount++
    preview.totalRows++
  }
  return preview
}

export function executeCSVImport(db: Database, csvText: string, options: ImportOptions, filename: string | null): ImportResult {
  const { rows } = parseCSV(csvText)
  return executeImport(db, normaliseCSVRows(rows), options, filename)
}

export function executeJSONImport(db: Database, jsonText: string, options: ImportOptions, filename: string | null): ImportResult {
  const { rows } = parseJSON(jsonText)
  return executeImport(db, normaliseJSONRows(rows), options, filename)
}

export function executeZIPImport(db: Database, zipBuffers: Buffer[], options: ImportOptions, filenames: string[]): ImportResult {
  const allRows: NormalisedRow[] = []

  for (let i = 0; i < zipBuffers.length; i++) {
    try {
      const { row, cookies } = parseZipBundle(zipBuffers[i])
      row.cookies = cookies
      allRows.push(row)
    } catch {
      // Skip invalid ZIPs — they were already flagged in preview
    }
  }

  return executeImport(db, allRows, options, filenames.join(', '))
}
