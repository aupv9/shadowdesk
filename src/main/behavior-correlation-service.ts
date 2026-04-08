/**
 * Phase 21 — Behavior Correlation Service
 *
 * Thin orchestration layer that ties the pure detector in
 * `fingerprint/behavior-correlation.ts` to the Database singleton + IPC layer.
 *
 * Responsibilities:
 *   - Fetch all profiles, parse fingerprint JSON.
 *   - Pull any stored `behavior_samples` rows and merge them into the centroid.
 *   - Run the scan.
 *   - Persist the report (optional) and return it to the caller.
 */

import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'
import {
  buildFingerprint,
  scanCorrelations,
} from './fingerprint/behavior-correlation'
import type {
  BehaviorCorrelationOptions,
  BehaviorCorrelationReport,
  BehaviorSample,
  Profile,
  ProfileBehaviorFingerprint,
} from '../shared/types'

/**
 * Parse a DB row into a Profile (fingerprint JSON -> object). Mirrors the
 * parseProfile helper in the renderer profile store.
 */
function parseProfileRow(row: any): Profile {
  return {
    ...row,
    fingerprint:
      typeof row.fingerprint === 'string'
        ? JSON.parse(row.fingerprint)
        : row.fingerprint,
  }
}

/** Parse a stored behavior_samples row into a BehaviorSample. */
function parseSampleRow(row: any): BehaviorSample | null {
  try {
    return JSON.parse(row.sample_json) as BehaviorSample
  } catch {
    return null
  }
}

/**
 * Run a full behavior correlation scan across the profile pool.
 * Persists the report unless `options.persist === false`.
 */
export function runCorrelationScan(
  options: BehaviorCorrelationOptions = {}
): BehaviorCorrelationReport {
  const db = Database.getInstance()
  const rawProfiles = db.getAllProfiles()

  const filterIds = options.profileIds
    ? new Set(options.profileIds)
    : null

  const profiles: Profile[] = rawProfiles
    .filter((p: any) => !filterIds || filterIds.has(p.id))
    .map(parseProfileRow)

  const fingerprints: ProfileBehaviorFingerprint[] = profiles.map((p) => {
    const sampleRows = db.getBehaviorSamples(p.id, 20)
    const samples = sampleRows
      .map(parseSampleRow)
      .filter((s): s is BehaviorSample => s !== null)
    return buildFingerprint(p, samples)
  })

  const report = scanCorrelations(fingerprints, options)

  if (options.persist !== false) {
    db.addBehaviorCorrelationReport({
      id: uuidv4(),
      threshold: report.threshold,
      profile_count: report.profileCount,
      pairs_evaluated: report.pairsEvaluated,
      high_risk_count: report.highRiskCount,
      medium_risk_count: report.mediumRiskCount,
      report_json: JSON.stringify(report),
    })
  }

  return report
}

/** Persist a raw behavior sample to the DB (used by session-tracker). */
export function recordBehaviorSample(
  profileId: string,
  sample: BehaviorSample,
  sessionId?: string
): void {
  const db = Database.getInstance()
  db.addBehaviorSample({
    id: uuidv4(),
    profile_id: profileId,
    session_id: sessionId ?? null,
    sample_json: JSON.stringify(sample),
  })
}

/** List the most recent stored correlation reports for the history UI. */
export function listCorrelationReports(limit: number = 25) {
  const db = Database.getInstance()
  return db.listBehaviorCorrelationReports(limit).map((r: any) => ({
    id: r.id,
    scannedAt: r.scanned_at,
    threshold: r.threshold,
    profileCount: r.profile_count,
    pairsEvaluated: r.pairs_evaluated,
    highRiskCount: r.high_risk_count,
    mediumRiskCount: r.medium_risk_count,
  }))
}

/** Fetch a stored correlation report and return the full BehaviorCorrelationReport. */
export function getCorrelationReport(id: string): BehaviorCorrelationReport | null {
  const db = Database.getInstance()
  const row = db.getBehaviorCorrelationReport(id)
  if (!row) return null
  try {
    return JSON.parse(row.report_json) as BehaviorCorrelationReport
  } catch {
    return null
  }
}

export function deleteCorrelationReport(id: string): void {
  const db = Database.getInstance()
  db.deleteBehaviorCorrelationReport(id)
}

export function clearBehaviorSamplesForProfile(profileId: string): void {
  const db = Database.getInstance()
  db.clearBehaviorSamples(profileId)
}
