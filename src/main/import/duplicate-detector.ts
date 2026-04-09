/**
 * Duplicate detection for bulk import.
 *
 * Detects duplicates by name (case-insensitive) and by fingerprint hash (SHA-256).
 */

import { createHash } from 'crypto'
import { Database } from '../database'

export interface DuplicateMatch {
  type: 'name' | 'fingerprint' | 'both'
  existingId: string
  existingName: string
}

/**
 * Compute SHA-256 hash of a fingerprint config for duplicate detection.
 * Keys are sorted to ensure deterministic output.
 */
export function computeFingerprintHash(fingerprint: object): string {
  const json = JSON.stringify(fingerprint, Object.keys(fingerprint).sort())
  return createHash('sha256').update(json).digest('hex')
}

/**
 * Check if a profile name already exists (case-insensitive).
 */
export function findDuplicateByName(db: Database, name: string): { id: string; name: string } | null {
  return db.findProfileByName(name)
}

/**
 * Check if a fingerprint hash already exists.
 */
export function findDuplicateByFingerprint(db: Database, hash: string): { id: string; name: string } | null {
  return db.findProfileByFingerprintHash(hash)
}

/**
 * Detect all duplicate matches for a given profile name and fingerprint.
 */
export function detectDuplicates(
  db: Database,
  name: string,
  fingerprint: object | null
): DuplicateMatch | null {
  const nameMatch = findDuplicateByName(db, name)

  let fpMatch: { id: string; name: string } | null = null
  if (fingerprint) {
    const hash = computeFingerprintHash(fingerprint)
    fpMatch = findDuplicateByFingerprint(db, hash)
  }

  if (nameMatch && fpMatch && nameMatch.id === fpMatch.id) {
    return { type: 'both', existingId: nameMatch.id, existingName: nameMatch.name }
  }
  if (nameMatch && fpMatch) {
    // Different profiles — name collision takes priority
    return { type: 'both', existingId: nameMatch.id, existingName: nameMatch.name }
  }
  if (nameMatch) {
    return { type: 'name', existingId: nameMatch.id, existingName: nameMatch.name }
  }
  if (fpMatch) {
    return { type: 'fingerprint', existingId: fpMatch.id, existingName: fpMatch.name }
  }

  return null
}

/**
 * Generate a unique name by appending a numeric suffix.
 */
export function generateUniqueName(db: Database, baseName: string): string {
  let candidate = baseName
  let counter = 2
  while (findDuplicateByName(db, candidate)) {
    candidate = `${baseName} (${counter})`
    counter++
  }
  return candidate
}
