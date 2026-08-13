import initSqlJs from 'sql.js'
import type { Database as SqlDatabase } from 'sql.js'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import {
  encryptCookies,
  safeDecryptCookies,
  encryptProxyCredential,
  safeDecryptProxyCredential,
  encryptRunVariables,
  safeDecryptRunVariables,
  deriveMasterKey,
} from './crypto/profile-encryption'
import { getMachineId } from './license'
import type { ProfileHealthScore, ProfileHealthFactor } from '../shared/types'

// Phase 4.1: Profile data encryption
// Master key is deterministic per-machine (derived from machine ID + app secret)
// This ensures same key on app restart while tying encryption to hardware.
const APP_ENCRYPTION_SECRET = 'ghost-browser-profile-encryption-v1'

export class Database {
  private static instance: Database
  private db!: SqlDatabase
  private dbPath!: string
  private masterKey: Buffer | null = null

  /**
   * Phase 19.1: In-memory cache for the Run Dashboard metrics queries.
   *
   * `getWorkflowRunMetrics()` and `getActionMetrics()` parse JSON `step_results`
   * for the most recent 100-200 runs on every call. The Metrics tab refetches
   * on workflow filter change, on tab switch, and on manual refresh — and the
   * underlying data only changes when a run finishes.
   *
   * We therefore cache the computed result for `METRICS_CACHE_TTL_MS` and
   * invalidate the entire cache whenever `addWorkflowRun()` writes a new row.
   * This is conservative (any new run busts cache for every workflow filter)
   * but avoids the per-call O(N*M) JSON.parse cost during normal browsing.
   */
  private metricsCache = new Map<string, { value: unknown; expiresAt: number }>()
  private static readonly METRICS_CACHE_TTL_MS = 30_000

  private getCachedMetric<T>(key: string, compute: () => T): T {
    const now = Date.now()
    const hit = this.metricsCache.get(key)
    if (hit && hit.expiresAt > now) {
      return hit.value as T
    }
    const value = compute()
    this.metricsCache.set(key, {
      value,
      expiresAt: now + Database.METRICS_CACHE_TTL_MS,
    })
    return value
  }

  private invalidateMetricsCache(): void {
    this.metricsCache.clear()
  }

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database()
    }
    return Database.instance
  }

  /**
   * Phase 4.1: Lazy master key derivation.
   * Derived from machine ID + app secret for deterministic per-device key.
   * Cached in memory after first access.
   */
  private getMasterKey(): Buffer {
    if (!this.masterKey) {
      try {
        const machineId = getMachineId()
        this.masterKey = deriveMasterKey(APP_ENCRYPTION_SECRET, machineId)
      } catch (error) {
        // Fallback: use app secret alone if machine ID unavailable
        console.warn('[Database] Machine ID unavailable, using fallback encryption key')
        this.masterKey = deriveMasterKey(APP_ENCRYPTION_SECRET)
      }
    }
    return this.masterKey
  }

  async initialize(): Promise<void> {
    const SQL = await initSqlJs()
    this.dbPath = join(app.getPath('userData'), 'ghost-browser.db')

    if (existsSync(this.dbPath)) {
      const fileBuffer = readFileSync(this.dbPath)
      this.db = new SQL.Database(fileBuffer)
    } else {
      this.db = new SQL.Database()
    }

    this.migrate()
    this.save()
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private save(): void {
    const data = this.db.export()
    writeFileSync(this.dbPath, Buffer.from(data))
  }

  private toObjects(cols: string[], values: any[][]): any[] {
    return values.map((row) => {
      const obj: Record<string, any> = {}
      cols.forEach((col, i) => (obj[col] = row[i]))
      return obj
    })
  }

  private queryAll(sql: string, params: any[] = []): any[] {
    const results = this.db.exec(sql, params)
    if (results.length === 0) return []
    return this.toObjects(results[0].columns, results[0].values as any[][])
  }

  private queryOne(sql: string, params: any[] = []): any {
    return this.queryAll(sql, params)[0] ?? null
  }

  private run(sql: string, params: any[] = []): void {
    this.db.run(sql, params)
    this.save()
  }

  private exec(sql: string): void {
    this.db.exec(sql)
    this.save()
  }

  // ── Schema migration ───────────────────────────────────────────────────────

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proxies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'http',
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT,
        password TEXT,
        country TEXT,
        latency_ms INTEGER,
        is_healthy INTEGER DEFAULT 0,
        last_checked_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        group_id TEXT,
        fingerprint TEXT NOT NULL DEFAULT '{}',
        proxy_id TEXT,
        cookies TEXT DEFAULT '[]',
        notes TEXT DEFAULT '',
        last_used_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        user_data_path TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        FOREIGN KEY(proxy_id) REFERENCES proxies(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS profile_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
      CREATE INDEX IF NOT EXISTS idx_profiles_group  ON profiles(group_id);
      CREATE INDEX IF NOT EXISTS idx_proxies_healthy ON proxies(is_healthy);
    `)

    // Migration: add rotation columns to profiles if not present
    try { this.db.exec(`ALTER TABLE profiles ADD COLUMN rotation_mode TEXT DEFAULT 'none'`) } catch { /* already exists */ }
    try { this.db.exec(`ALTER TABLE profiles ADD COLUMN rotation_index INTEGER DEFAULT 0`) } catch { /* already exists */ }

    // Phase 3 migration: sync tracking + audit log
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        profile_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'success',
        synced_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_name TEXT,
        action TEXT NOT NULL,
        target_id TEXT,
        target_name TEXT,
        timestamp TEXT DEFAULT (datetime('now')),
        ip_address TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_log(user_id);
    `)

    // Phase 4 migration: automation workflows
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        steps TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        step_results TEXT DEFAULT '[]',
        error TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_profile  ON workflow_runs(profile_id);
    `)

    // Phase 5 migration: detection test results
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS detection_tests (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        profile_name TEXT NOT NULL,
        tested_at TEXT DEFAULT (datetime('now')),
        overall_score INTEGER NOT NULL DEFAULT 0,
        vectors TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_detection_tests_profile ON detection_tests(profile_id);
      CREATE INDEX IF NOT EXISTS idx_detection_tests_date    ON detection_tests(tested_at);
    `)

    // Phase 6 migration: profile version history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profile_versions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT 'Snapshot',
        saved_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_profile_versions_profile ON profile_versions(profile_id);
      CREATE INDEX IF NOT EXISTS idx_profile_versions_date    ON profile_versions(saved_at);
    `)

    // Phase 10.2 — workflow schedules (cron-driven)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_schedules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'Schedule',
        workflow_id TEXT NOT NULL,
        profile_ids TEXT NOT NULL DEFAULT '[]',
        cron TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_schedules_workflow ON workflow_schedules(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON workflow_schedules(enabled);
    `)

    // Phase 10.3 — per-profile extension paths
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profile_extensions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_extensions_profile ON profile_extensions(profile_id);
    `)

    // Phase 11.3 — fingerprint drift tracking
    try {
      this.db.exec(`ALTER TABLE profiles ADD COLUMN drift_enabled INTEGER DEFAULT 0`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE profiles ADD COLUMN last_drift_at TEXT`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE profiles ADD COLUMN warmed_up INTEGER DEFAULT 0`)
    } catch { /* exists */ }

    // Variables column for workflows (Phase 11.1 — added previously, ensure exists)
    try {
      this.db.exec(`ALTER TABLE workflows ADD COLUMN variables TEXT`)
    } catch { /* exists */ }

    // Phase 1 Typed Variables: JSON array of VariableDefinition objects.
    // Each definition declares a variable name, type, optional default, and description.
    try {
      this.db.exec(`ALTER TABLE workflows ADD COLUMN variable_definitions TEXT`)
    } catch { /* exists */ }

    // Phase 1 Typed Variables: variable definitions for workflow versions
    try {
      this.db.exec(`ALTER TABLE workflow_versions ADD COLUMN variable_definitions TEXT`)
    } catch { /* exists */ }

    // Phase 2: Circuit breaker config for workflows (JSON of CircuitBreakerConfig)
    try {
      this.db.exec(`ALTER TABLE workflows ADD COLUMN circuit_breaker TEXT`)
    } catch { /* exists */ }

    // Phase 3: AI recovery config for workflows (JSON of AiRecoveryConfig)
    try {
      this.db.exec(`ALTER TABLE workflows ADD COLUMN ai_recovery TEXT`)
    } catch { /* exists */ }

    // Sync history error_message column (Account C3)
    try {
      this.db.exec(`ALTER TABLE sync_log ADD COLUMN error_message TEXT`)
    } catch { /* exists */ }

    // Selective sync — per-profile opt-out (Account C5)
    try {
      this.db.exec(`ALTER TABLE profiles ADD COLUMN sync_excluded INTEGER DEFAULT 0`)
    } catch { /* exists */ }

    // Phase 4.1: Encryption version tracking for cookies and proxy credentials
    // 0 = plain-text (legacy), 1 = AES-256-GCM encrypted
    try {
      this.db.exec(`ALTER TABLE profiles ADD COLUMN cookies_encryption_version INTEGER DEFAULT 0`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE proxies ADD COLUMN credentials_encryption_version INTEGER DEFAULT 0`)
    } catch { /* exists */ }

    // Tier 2 RPA — extended workflow run logging
    try {
      this.db.exec(`ALTER TABLE workflow_runs ADD COLUMN duration_ms INTEGER`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE workflow_runs ADD COLUMN variables TEXT`)
    } catch { /* exists */ }

    // Phase 19.1 (Run Dashboard improvements): Encryption flag for run variables.
    // 0 = plain-text (legacy), 1 = AES-256-GCM encrypted via encryptRunVariables().
    try {
      this.db.exec(`ALTER TABLE workflow_runs ADD COLUMN variables_encryption_version INTEGER DEFAULT 0`)
    } catch { /* exists */ }

    // Phase 19.1 (Run Dashboard improvements): Performance indexes for the
    // metrics dashboard. The Run Dashboard's Metrics + History tabs run
    // ORDER BY started_at DESC and filter by status — without these indexes
    // every query forces a full table scan once workflow_runs grows large.
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON workflow_runs(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_status  ON workflow_runs(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_wf_started
        ON workflow_runs(workflow_id, started_at DESC);
    `)

    // Coherence rule R6 compares the browser's timezone against where the
    // proxy actually geolocates. testProxy already resolves the exit IP through
    // ip-api; these columns give it somewhere to persist the answer.
    try {
      this.db.exec(`ALTER TABLE proxies ADD COLUMN last_ip TEXT`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE proxies ADD COLUMN timezone TEXT`)
    } catch { /* exists */ }

    // Detection validation — split the single misleading score into injection
    // integrity vs detection risk, and record the proxy, since network-dependent
    // verdicts belong to a (profile × proxy) pair rather than to the profile.
    // Legacy rows keep a null risk_score and render as "layer 0 only".
    try {
      this.db.exec(`ALTER TABLE detection_tests ADD COLUMN injection_score INTEGER`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE detection_tests ADD COLUMN risk_score INTEGER`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE detection_tests ADD COLUMN proxy_id TEXT`)
    } catch { /* exists */ }

    // Rendered-output hashes, so coherence rules R11/R12 have a baseline.
    // CLAUDE.md asserts one profile renders identically across sessions and
    // that seeds are per-profile; nothing verified either, and
    // collision-detector.ts compares stored config rather than what actually
    // gets painted. Two profiles can hold different configs and still produce
    // the same canvas.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fingerprint_hashes (
        profile_id  TEXT PRIMARY KEY,
        canvas      TEXT NOT NULL DEFAULT '',
        webgl       TEXT NOT NULL DEFAULT '',
        audio       TEXT NOT NULL DEFAULT '',
        recorded_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
    `)

    // Tier 3 RPA — workflow versioning (mirrors profile_versions pattern)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_versions (
        id          TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        name        TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        steps       TEXT NOT NULL DEFAULT '[]',
        variables   TEXT,
        label       TEXT NOT NULL DEFAULT '',
        saved_at    TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_wf_versions_workflow ON workflow_versions(workflow_id);
    `)

    // Phase 17 — recording sessions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS recording_sessions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        stopped_at TEXT,
        events TEXT NOT NULL DEFAULT '[]',
        page_title TEXT,
        start_url TEXT,
        capture_screenshots INTEGER DEFAULT 0,
        capture_network INTEGER DEFAULT 0,
        status TEXT DEFAULT 'recording'
      );
      CREATE INDEX IF NOT EXISTS idx_recording_sessions_profile ON recording_sessions(profile_id);
      CREATE INDEX IF NOT EXISTS idx_recording_sessions_status ON recording_sessions(status);
    `)

    // Phase 12.C.3 — encrypted credential vault
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        profile_id TEXT,
        label TEXT NOT NULL,
        username_enc TEXT NOT NULL,
        password_enc TEXT NOT NULL,
        fields_enc TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_credentials_profile ON credentials(profile_id);

      CREATE TABLE IF NOT EXISTS vault_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    // Smart Warm-Up Engine — 7-day organic ramp plans + per-day sessions.
    //
    // `warmup_plans` holds one row per profile that is being warmed up.
    // `warmup_sessions` holds one row per day executed, capturing the
    // stage, visited URLs, synthesized interactions, and a derived
    // engagement score. Both cascade on profile delete.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS warmup_plans (
        id                     TEXT PRIMARY KEY,
        profile_id             TEXT NOT NULL,
        region                 TEXT NOT NULL DEFAULT 'global',
        target_platforms       TEXT NOT NULL DEFAULT '[]',
        total_days             INTEGER NOT NULL DEFAULT 7,
        current_day            INTEGER NOT NULL DEFAULT 0,
        status                 TEXT NOT NULL DEFAULT 'pending',
        fake_account_age_days  INTEGER NOT NULL DEFAULT 0,
        notes                  TEXT DEFAULT '',
        created_at             TEXT DEFAULT (datetime('now')),
        started_at             TEXT,
        completed_at           TEXT,
        last_session_at        TEXT,
        next_run_at            TEXT,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_warmup_plans_profile ON warmup_plans(profile_id);
      CREATE INDEX IF NOT EXISTS idx_warmup_plans_status  ON warmup_plans(status);

      CREATE TABLE IF NOT EXISTS warmup_sessions (
        id               TEXT PRIMARY KEY,
        plan_id          TEXT NOT NULL,
        profile_id       TEXT NOT NULL,
        day              INTEGER NOT NULL,
        stage            TEXT NOT NULL,
        visited          TEXT NOT NULL DEFAULT '[]',
        interactions     TEXT NOT NULL DEFAULT '[]',
        engagement_score INTEGER NOT NULL DEFAULT 0,
        duration_ms      INTEGER NOT NULL DEFAULT 0,
        success          INTEGER NOT NULL DEFAULT 0,
        error            TEXT,
        started_at       TEXT NOT NULL,
        completed_at     TEXT,
        FOREIGN KEY(plan_id) REFERENCES warmup_plans(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_warmup_sessions_plan    ON warmup_sessions(plan_id);
      CREATE INDEX IF NOT EXISTS idx_warmup_sessions_profile ON warmup_sessions(profile_id);
    `)

    // Phase 20 — Proxy Provider Marketplace (UI label: "Phase 17")
    // Stores user-configured residential proxy provider accounts. Credentials
    // (username/password/api key/zone) are encrypted with the same master key
    // used for the existing proxies + cookies tables.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS proxy_provider_accounts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        port INTEGER NOT NULL,
        default_pool TEXT NOT NULL DEFAULT 'residential',
        default_session TEXT NOT NULL DEFAULT 'rotating',
        username_enc TEXT,
        password_enc TEXT,
        api_key_enc TEXT,
        zone_enc TEXT,
        status TEXT NOT NULL DEFAULT 'unverified',
        last_tested_at TEXT,
        last_error TEXT,
        usage_json TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_proxy_provider_accounts_type ON proxy_provider_accounts(type);
    `)

    // Phase 21 — Behavior Correlation Detector
    //
    // Two tables:
    //   behavior_samples — raw typing/mouse/scroll sample rows collected from
    //                      live sessions (P3 session-tracker integration).
    //   behavior_correlation_reports — persisted scan results shown in the
    //                      Behavior Correlation dashboard so users can review
    //                      historical alerts and track trends over time.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS behavior_samples (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        session_id TEXT,
        recorded_at TEXT DEFAULT (datetime('now')),
        sample_json TEXT NOT NULL,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_behavior_samples_profile ON behavior_samples(profile_id);
      CREATE INDEX IF NOT EXISTS idx_behavior_samples_recorded ON behavior_samples(recorded_at);

      CREATE TABLE IF NOT EXISTS behavior_correlation_reports (
        id TEXT PRIMARY KEY,
        scanned_at TEXT DEFAULT (datetime('now')),
        threshold REAL NOT NULL DEFAULT 0.85,
        profile_count INTEGER NOT NULL DEFAULT 0,
        pairs_evaluated INTEGER NOT NULL DEFAULT 0,
        high_risk_count INTEGER NOT NULL DEFAULT 0,
        medium_risk_count INTEGER NOT NULL DEFAULT 0,
        report_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_behavior_correlation_scanned
        ON behavior_correlation_reports(scanned_at);
    `)

    // Phase 1+2 — Bulk Import Enhancement: import sessions, records, fingerprint hash
    try {
      this.db.exec(`ALTER TABLE profiles ADD COLUMN fingerprint_hash TEXT`)
    } catch { /* exists */ }
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_profiles_fingerprint_hash ON profiles(fingerprint_hash)`)

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS import_sessions (
        id TEXT PRIMARY KEY,
        timestamp TEXT DEFAULT (datetime('now')),
        file_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        duplicate_count INTEGER DEFAULT 0,
        skipped_count INTEGER DEFAULT 0,
        import_source TEXT,
        original_filename TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_import_sessions_timestamp ON import_sessions(timestamp);

      CREATE TABLE IF NOT EXISTS import_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        source_file TEXT,
        profile_id TEXT,
        profile_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'success',
        duplicate_of TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(session_id) REFERENCES import_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_import_records_session ON import_records(session_id);
      CREATE INDEX IF NOT EXISTS idx_import_records_status ON import_records(status);
    `)

    // Phase P3: Behavior session tracking (session-to-session drift)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS behavior_sessions (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        mouse_velocity_avg REAL,
        mouse_acceleration_variance REAL,
        mouse_direction_changes INTEGER,
        typing_wpm REAL,
        typing_variance REAL,
        typing_pause_frequency REAL,
        scroll_speed_avg REAL,
        scroll_pause_count INTEGER,
        scroll_direction_changes INTEGER,
        bot_consistency_score REAL,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_behavior_sessions_profile ON behavior_sessions(profile_id);
      CREATE INDEX IF NOT EXISTS idx_behavior_sessions_timestamp ON behavior_sessions(timestamp);
    `)

    // Phase 17 — Mobile Workflow Engine: workflows, execution logs, gesture templates
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mobile_workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        steps TEXT NOT NULL DEFAULT '[]',
        device_config TEXT NOT NULL DEFAULT '{}',
        behavior_pattern TEXT,
        is_template INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_mobile_workflows_template ON mobile_workflows(is_template);

      CREATE TABLE IF NOT EXISTS mobile_execution_logs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        profile_id TEXT NOT NULL,
        device_name TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT,
        duration_ms INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'running',
        error_message TEXT,
        step_results TEXT DEFAULT '[]',
        metrics TEXT DEFAULT '{}',
        sensor_state TEXT,
        FOREIGN KEY(workflow_id) REFERENCES mobile_workflows(id) ON DELETE CASCADE,
        FOREIGN KEY(profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_mobile_exec_workflow ON mobile_execution_logs(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_mobile_exec_profile ON mobile_execution_logs(profile_id);
      CREATE INDEX IF NOT EXISTS idx_mobile_exec_status  ON mobile_execution_logs(status);

      CREATE TABLE IF NOT EXISTS gesture_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        gesture_type TEXT NOT NULL,
        description TEXT DEFAULT '',
        config TEXT NOT NULL DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_gesture_templates_type ON gesture_templates(gesture_type);
    `)

    // Backfill fingerprint_hash for existing profiles that don't have one
    try {
      const rows = this.queryAll(`SELECT id, fingerprint FROM profiles WHERE fingerprint_hash IS NULL AND status = 'active'`)
      for (const row of rows) {
        try {
          const fp = typeof row.fingerprint === 'string' ? JSON.parse(row.fingerprint as string) : row.fingerprint
          const { createHash } = require('crypto')
          const json = JSON.stringify(fp, Object.keys(fp).sort())
          const hash = createHash('sha256').update(json).digest('hex')
          this.run(`UPDATE profiles SET fingerprint_hash = ? WHERE id = ?`, [hash, row.id as string])
        } catch { /* skip malformed fingerprint */ }
      }
    } catch { /* table may not exist yet on first run */ }
  }

  // ── Behavior Correlation Detector (Phase 21) ─────────────────────────────

  /** Insert a raw behavior sample captured from a live session. */
  addBehaviorSample(s: {
    id: string
    profile_id: string
    session_id?: string | null
    sample_json: string
  }): void {
    this.run(
      `INSERT INTO behavior_samples (id, profile_id, session_id, sample_json)
       VALUES (?, ?, ?, ?)`,
      [s.id, s.profile_id, s.session_id ?? null, s.sample_json]
    )
  }

  /**
   * Return the most recent behavior samples for a single profile, newest
   * first. Used by the correlation detector to build the profile centroid.
   */
  getBehaviorSamples(profileId: string, limit: number = 20): any[] {
    return this.queryAll(
      `SELECT * FROM behavior_samples
       WHERE profile_id = ?
       ORDER BY recorded_at DESC
       LIMIT ?`,
      [profileId, limit]
    )
  }

  /** Clear all samples for a profile — used when the user rotates behaviour. */
  clearBehaviorSamples(profileId: string): void {
    this.run('DELETE FROM behavior_samples WHERE profile_id = ?', [profileId])
  }

  /** Persist a correlation scan report so the UI can show history. */
  addBehaviorCorrelationReport(r: {
    id: string
    threshold: number
    profile_count: number
    pairs_evaluated: number
    high_risk_count: number
    medium_risk_count: number
    report_json: string
  }): void {
    this.run(
      `INSERT INTO behavior_correlation_reports
         (id, threshold, profile_count, pairs_evaluated,
          high_risk_count, medium_risk_count, report_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.threshold,
        r.profile_count,
        r.pairs_evaluated,
        r.high_risk_count,
        r.medium_risk_count,
        r.report_json,
      ]
    )
  }

  /** List the most recent N correlation reports for the history view. */
  listBehaviorCorrelationReports(limit: number = 25): any[] {
    return this.queryAll(
      `SELECT id, scanned_at, threshold, profile_count, pairs_evaluated,
              high_risk_count, medium_risk_count
       FROM behavior_correlation_reports
       ORDER BY scanned_at DESC
       LIMIT ?`,
      [limit]
    )
  }

  /** Fetch the full persisted JSON of a single correlation report. */
  getBehaviorCorrelationReport(id: string): any {
    return this.queryOne(
      `SELECT * FROM behavior_correlation_reports WHERE id = ?`,
      [id]
    )
  }

  /** Delete a stored correlation report. */
  deleteBehaviorCorrelationReport(id: string): void {
    this.run('DELETE FROM behavior_correlation_reports WHERE id = ?', [id])
  }

  // ── Vault meta (Phase 12.C.3) ────────────────────────────────────────────

  getVaultMeta(key: string): string | null {
    const row = this.queryOne('SELECT value FROM vault_meta WHERE key = ?', [key])
    return row ? row.value : null
  }

  setVaultMeta(key: string, value: string): void {
    this.run(
      `INSERT INTO vault_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    )
  }

  // ── Credentials (Phase 12.C.3) ───────────────────────────────────────────

  getAllCredentials(profileId?: string): any[] {
    if (profileId) {
      return this.queryAll(
        'SELECT * FROM credentials WHERE profile_id = ? ORDER BY label ASC',
        [profileId]
      )
    }
    return this.queryAll('SELECT * FROM credentials ORDER BY label ASC')
  }

  getCredential(id: string): any {
    return this.queryOne('SELECT * FROM credentials WHERE id = ?', [id])
  }

  createCredential(c: {
    id: string
    profile_id: string | null
    label: string
    username_enc: string
    password_enc: string
    fields_enc: string | null
  }): void {
    this.run(
      `INSERT INTO credentials (id, profile_id, label, username_enc, password_enc, fields_enc)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.profile_id, c.label, c.username_enc, c.password_enc, c.fields_enc]
    )
  }

  updateCredential(
    id: string,
    data: Partial<{
      label: string
      username_enc: string
      password_enc: string
      fields_enc: string | null
      profile_id: string | null
    }>
  ): void {
    const sets: string[] = []
    const vals: any[] = []
    if (data.label !== undefined)        { sets.push('label = ?');        vals.push(data.label) }
    if (data.username_enc !== undefined) { sets.push('username_enc = ?'); vals.push(data.username_enc) }
    if (data.password_enc !== undefined) { sets.push('password_enc = ?'); vals.push(data.password_enc) }
    if (data.fields_enc !== undefined)   { sets.push('fields_enc = ?');   vals.push(data.fields_enc) }
    if (data.profile_id !== undefined)   { sets.push('profile_id = ?');   vals.push(data.profile_id) }
    if (sets.length === 0) return
    sets.push("updated_at = datetime('now')")
    vals.push(id)
    this.run(`UPDATE credentials SET ${sets.join(', ')} WHERE id = ?`, vals)
  }

  deleteCredential(id: string): void {
    this.run('DELETE FROM credentials WHERE id = ?', [id])
  }

  // ── Workflow Schedules (Phase 10.2) ──────────────────────────────────────

  getAllSchedules(): any[] {
    return this.queryAll(
      'SELECT * FROM workflow_schedules ORDER BY created_at DESC'
    )
  }

  getSchedule(id: string): any {
    return this.queryOne('SELECT * FROM workflow_schedules WHERE id = ?', [id])
  }

  createSchedule(s: {
    id: string
    name: string
    workflow_id: string
    profile_ids: string[]
    cron: string
    enabled: boolean
    next_run_at: string | null
  }): void {
    this.run(
      `INSERT INTO workflow_schedules (id, name, workflow_id, profile_ids, cron, enabled, next_run_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.name, s.workflow_id, JSON.stringify(s.profile_ids), s.cron, s.enabled ? 1 : 0, s.next_run_at]
    )
  }

  updateSchedule(id: string, data: Partial<{ name: string; cron: string; enabled: boolean; profile_ids: string[]; next_run_at: string | null }>): void {
    const sets: string[] = []
    const vals: any[] = []
    if (data.name !== undefined)        { sets.push('name = ?');        vals.push(data.name) }
    if (data.cron !== undefined)        { sets.push('cron = ?');        vals.push(data.cron) }
    if (data.enabled !== undefined)     { sets.push('enabled = ?');     vals.push(data.enabled ? 1 : 0) }
    if (data.profile_ids !== undefined) { sets.push('profile_ids = ?'); vals.push(JSON.stringify(data.profile_ids)) }
    if (data.next_run_at !== undefined) { sets.push('next_run_at = ?'); vals.push(data.next_run_at) }
    if (sets.length === 0) return
    this.run(`UPDATE workflow_schedules SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
  }

  markScheduleRun(id: string, when: string): void {
    this.run('UPDATE workflow_schedules SET last_run_at = ? WHERE id = ?', [when, id])
  }

  deleteSchedule(id: string): void {
    this.run('DELETE FROM workflow_schedules WHERE id = ?', [id])
  }

  // ── Profile Extensions (Phase 10.3) ──────────────────────────────────────

  getProfileExtensions(profileId: string): any[] {
    return this.queryAll(
      'SELECT * FROM profile_extensions WHERE profile_id = ? ORDER BY created_at ASC',
      [profileId]
    )
  }

  addProfileExtension(ext: { id: string; profile_id: string; name: string; path: string; enabled: boolean }): void {
    this.run(
      'INSERT INTO profile_extensions (id, profile_id, name, path, enabled) VALUES (?, ?, ?, ?, ?)',
      [ext.id, ext.profile_id, ext.name, ext.path, ext.enabled ? 1 : 0]
    )
  }

  setExtensionEnabled(id: string, enabled: boolean): void {
    this.run('UPDATE profile_extensions SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id])
  }

  removeProfileExtension(id: string): void {
    this.run('DELETE FROM profile_extensions WHERE id = ?', [id])
  }

  // ── Profile drift / warm-up flags (Phase 11.2 / 11.3) ───────────────────

  setProfileDriftEnabled(id: string, enabled: boolean): void {
    this.run('UPDATE profiles SET drift_enabled = ? WHERE id = ?', [enabled ? 1 : 0, id])
  }

  setProfileLastDrift(id: string, when: string): void {
    this.run('UPDATE profiles SET last_drift_at = ? WHERE id = ?', [when, id])
  }

  setProfileWarmedUp(id: string, warmed: boolean): void {
    this.run('UPDATE profiles SET warmed_up = ? WHERE id = ?', [warmed ? 1 : 0, id])
  }

  /**
   * Smart Warm-Up Engine — backdate a profile's `created_at` so it appears
   * the profile has been around for `days` days longer than it actually has.
   * Returns the new ISO timestamp that was written.
   */
  backdateProfileCreatedAt(id: string, days: number): string {
    const safeDays = Math.max(0, Math.floor(days))
    const ms = Date.now() - safeDays * 24 * 60 * 60 * 1000
    const iso = new Date(ms).toISOString().replace('T', ' ').replace(/\..+/, '')
    this.run('UPDATE profiles SET created_at = ? WHERE id = ?', [iso, id])
    return iso
  }

  // ── Smart Warm-Up Engine (plans + sessions) ──────────────────────────────

  /** Insert a new warm-up plan row. All fields from the interface are required. */
  createWarmupPlan(plan: {
    id: string
    profile_id: string
    region: string
    target_platforms: string[]
    total_days: number
    fake_account_age_days: number
    notes?: string
  }): void {
    this.run(
      `INSERT INTO warmup_plans
         (id, profile_id, region, target_platforms, total_days, current_day,
          status, fake_account_age_days, notes, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, ?, datetime('now'))`,
      [
        plan.id,
        plan.profile_id,
        plan.region,
        JSON.stringify(plan.target_platforms ?? []),
        plan.total_days,
        plan.fake_account_age_days,
        plan.notes ?? ''
      ]
    )
  }

  getWarmupPlan(id: string): any {
    const row = this.queryOne('SELECT * FROM warmup_plans WHERE id = ?', [id])
    return this.parseWarmupPlanRow(row)
  }

  getWarmupPlanByProfile(profileId: string): any {
    const row = this.queryOne(
      'SELECT * FROM warmup_plans WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1',
      [profileId]
    )
    return this.parseWarmupPlanRow(row)
  }

  getAllWarmupPlans(): any[] {
    const rows = this.queryAll(`
      SELECT wp.*, p.name AS profile_name
      FROM warmup_plans wp
      LEFT JOIN profiles p ON p.id = wp.profile_id
      ORDER BY wp.created_at DESC
    `)
    return rows.map((r) => this.parseWarmupPlanRow(r)).filter((r) => r !== null)
  }

  updateWarmupPlan(
    id: string,
    patch: Partial<{
      current_day: number
      status: string
      started_at: string | null
      completed_at: string | null
      last_session_at: string | null
      next_run_at: string | null
      notes: string
    }>
  ): void {
    const fields: string[] = []
    const params: any[] = []
    for (const [key, value] of Object.entries(patch)) {
      fields.push(`${key} = ?`)
      params.push(value)
    }
    if (fields.length === 0) return
    params.push(id)
    this.run(`UPDATE warmup_plans SET ${fields.join(', ')} WHERE id = ?`, params)
  }

  deleteWarmupPlan(id: string): void {
    // Sessions cascade on plan delete via FK.
    this.run('DELETE FROM warmup_plans WHERE id = ?', [id])
  }

  /** Parse JSON fields + normalize types on a warmup_plans row. */
  private parseWarmupPlanRow(row: any): any {
    if (!row) return null
    let targetPlatforms: string[] = []
    try {
      targetPlatforms = JSON.parse(row.target_platforms || '[]')
    } catch { /* ignore */ }
    return {
      id: row.id,
      profile_id: row.profile_id,
      profile_name: row.profile_name,
      region: row.region,
      target_platforms: targetPlatforms,
      total_days: row.total_days,
      current_day: row.current_day,
      status: row.status,
      fake_account_age_days: row.fake_account_age_days,
      notes: row.notes ?? '',
      created_at: row.created_at,
      started_at: row.started_at ?? null,
      completed_at: row.completed_at ?? null,
      last_session_at: row.last_session_at ?? null,
      next_run_at: row.next_run_at ?? null
    }
  }

  addWarmupSession(s: {
    id: string
    plan_id: string
    profile_id: string
    day: number
    stage: string
    visited: string[]
    interactions: any[]
    engagement_score: number
    duration_ms: number
    success: boolean
    error?: string | null
    started_at: string
    completed_at: string | null
  }): void {
    this.run(
      `INSERT INTO warmup_sessions
         (id, plan_id, profile_id, day, stage, visited, interactions,
          engagement_score, duration_ms, success, error, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.plan_id,
        s.profile_id,
        s.day,
        s.stage,
        JSON.stringify(s.visited),
        JSON.stringify(s.interactions),
        s.engagement_score,
        s.duration_ms,
        s.success ? 1 : 0,
        s.error ?? null,
        s.started_at,
        s.completed_at
      ]
    )
  }

  getWarmupSessionsByPlan(planId: string): any[] {
    const rows = this.queryAll(
      'SELECT * FROM warmup_sessions WHERE plan_id = ? ORDER BY day ASC, started_at ASC',
      [planId]
    )
    return rows.map((r) => this.parseWarmupSessionRow(r))
  }

  private parseWarmupSessionRow(row: any): any {
    if (!row) return null
    let visited: string[] = []
    let interactions: any[] = []
    try { visited = JSON.parse(row.visited || '[]') } catch { /* ignore */ }
    try { interactions = JSON.parse(row.interactions || '[]') } catch { /* ignore */ }
    return {
      id: row.id,
      plan_id: row.plan_id,
      profile_id: row.profile_id,
      day: row.day,
      stage: row.stage,
      visited,
      interactions,
      engagement_score: row.engagement_score,
      duration_ms: row.duration_ms,
      success: !!row.success,
      error: row.error ?? undefined,
      started_at: row.started_at,
      completed_at: row.completed_at ?? null
    }
  }

  // ── Profile CRUD ──────────────────────────────────────────────────────────

  /**
   * Phase 4.1: Row-level helper that transparently decrypts sensitive fields.
   * Applied in all profile read methods so consumers always see plaintext data.
   */
  private decryptProfileRow(row: any): any {
    if (!row) return row
    if (row.cookies !== undefined) {
      row.cookies = this.decryptCookiesField(
        row.cookies,
        row.cookies_encryption_version,
        row.id,
      )
    }
    return row
  }

  getAllProfiles(): any[] {
    const rows = this.queryAll(`
      SELECT p.*,
             pr.host || ':' || CAST(pr.port AS TEXT) AS proxy_label,
             pr.type AS proxy_type,
             pg.name  AS group_name,
             pg.color AS group_color
      FROM profiles p
      LEFT JOIN proxies pr ON p.proxy_id = pr.id
      LEFT JOIN profile_groups pg ON p.group_id = pg.id
      WHERE p.status != 'archived'
      ORDER BY p.created_at DESC
    `)
    return rows.map((row) => this.decryptProfileRow(row))
  }

  /**
   * Phase 2.1: Paginated profile listing with filtering
   * @param limit - Number of profiles per page (default 50, max 100)
   * @param offset - Pagination offset (0-based)
   * @param filters - Optional filters: { groupId?: string, status?: 'active'|'archived' }
   * @returns { profiles, total, hasMore }
   */
  getProfilesPaginated(
    limit: number = 50,
    offset: number = 0,
    filters?: { groupId?: string; status?: 'active' | 'archived' }
  ): { profiles: any[]; total: number; hasMore: boolean } {
    // Normalize limit (min 1, max 100)
    const normalizedLimit = Math.max(1, Math.min(limit, 100))
    const normalizedOffset = Math.max(0, offset)

    // Build WHERE clause
    const whereConditions = []
    const params: any[] = []

    if (filters?.status) {
      whereConditions.push(`p.status = ?`)
      params.push(filters.status)
    } else {
      whereConditions.push(`p.status != 'archived'`)
    }

    if (filters?.groupId) {
      whereConditions.push(`p.group_id = ?`)
      params.push(filters.groupId)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Count total
    const countResult = this.queryOne(`SELECT COUNT(*) as count FROM profiles p ${whereClause}`, params)
    const total = countResult?.count ?? 0

    // Fetch paginated results
    const rows = this.queryAll(
      `
      SELECT p.*,
             pr.host || ':' || CAST(pr.port AS TEXT) AS proxy_label,
             pr.type AS proxy_type,
             pg.name  AS group_name,
             pg.color AS group_color
      FROM profiles p
      LEFT JOIN proxies pr ON p.proxy_id = pr.id
      LEFT JOIN profile_groups pg ON p.group_id = pg.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `,
      [...params, normalizedLimit, normalizedOffset]
    )

    const profiles = rows.map((row) => this.decryptProfileRow(row))
    const hasMore = normalizedOffset + normalizedLimit < total

    return { profiles, total, hasMore }
  }

  /**
   * Count total profiles (optionally filtered)
   */
  countProfiles(filters?: { groupId?: string; status?: 'active' | 'archived' }): number {
    const whereConditions = []
    const params: any[] = []

    if (filters?.status) {
      whereConditions.push(`status = ?`)
      params.push(filters.status)
    } else {
      whereConditions.push(`status != 'archived'`)
    }

    if (filters?.groupId) {
      whereConditions.push(`group_id = ?`)
      params.push(filters.groupId)
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const result = this.queryOne(`SELECT COUNT(*) as count FROM profiles p ${whereClause}`, params)
    return result?.count ?? 0
  }

  getProfile(id: string): any {
    const row = this.queryOne(`
      SELECT p.*,
             pr.host || ':' || CAST(pr.port AS TEXT) AS proxy_label,
             pr.type AS proxy_type,
             pg.name  AS group_name,
             pg.color AS group_color
      FROM profiles p
      LEFT JOIN proxies pr ON p.proxy_id = pr.id
      LEFT JOIN profile_groups pg ON p.group_id = pg.id
      WHERE p.id = ?
    `, [id])
    return this.decryptProfileRow(row)
  }

  createProfile(profile: {
    id: string
    name: string
    fingerprint: object
    proxy_id?: string | null
    notes?: string
    user_data_path: string
  }): void {
    this.run(
      `INSERT INTO profiles (id, name, fingerprint, proxy_id, notes, user_data_path)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        profile.name,
        JSON.stringify(profile.fingerprint),
        profile.proxy_id ?? null,
        profile.notes ?? '',
        profile.user_data_path
      ]
    )
  }

  private static readonly PROFILE_UPDATABLE = new Set([
    'name', 'group_id', 'fingerprint', 'proxy_id', 'cookies', 'notes',
    'last_used_at', 'user_data_path', 'status', 'rotation_mode', 'rotation_index',
    'sync_excluded'
  ])

  updateProfile(id: string, data: Record<string, any>): void {
    const entries = Object.entries(data).filter(([k]) => Database.PROFILE_UPDATABLE.has(k))
    if (entries.length === 0) return
    const sets = entries.map(([k]) => `${k} = ?`).join(', ')
    const vals = entries.map(([k, v]) => (k === 'fingerprint' ? JSON.stringify(v) : v))
    this.run(`UPDATE profiles SET ${sets} WHERE id = ?`, [...vals, id])
  }

  deleteProfile(id: string): void {
    this.run(`UPDATE profiles SET status = 'archived' WHERE id = ?`, [id])
  }

  /**
   * Phase 2.2: Bulk delete profiles (soft delete)
   * @param ids - Array of profile IDs to delete (max 1000)
   * @returns Number of profiles deleted
   */
  bulkDeleteProfiles(ids: string[]): number {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) {
      throw new Error(`Bulk delete requires 1-1000 profile IDs, got ${ids.length}`)
    }

    const placeholders = ids.map(() => '?').join(',')
    this.run(
      `UPDATE profiles SET status = 'archived' WHERE id IN (${placeholders})`,
      ids
    )

    return ids.length
  }

  /**
   * Phase 4.3: Restore archived profiles (undo bulk-delete)
   * Flips status from 'archived' back to 'active'.
   * Only works if cleanup worker hasn't removed directories yet.
   * @param ids - Array of profile IDs to restore (max 1000)
   * @returns Number of profiles restored
   */
  bulkRestoreProfiles(ids: string[]): number {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) {
      throw new Error(`Bulk restore requires 1-1000 profile IDs, got ${ids.length}`)
    }

    const placeholders = ids.map(() => '?').join(',')
    this.run(
      `UPDATE profiles SET status = 'active' WHERE id IN (${placeholders}) AND status = 'archived'`,
      ids
    )

    return ids.length
  }

  /**
   * Phase 2.2: Bulk assign proxy to profiles
   * @param profileIds - Array of profile IDs (max 1000)
   * @param proxyId - Proxy ID to assign (or null to unassign)
   * @returns Number of profiles updated
   */
  bulkUpdateProxyId(profileIds: string[], proxyId: string | null): number {
    if (!Array.isArray(profileIds) || profileIds.length === 0 || profileIds.length > 1000) {
      throw new Error(`Bulk update requires 1-1000 profile IDs, got ${profileIds.length}`)
    }

    const placeholders = profileIds.map(() => '?').join(',')
    this.run(
      `UPDATE profiles SET proxy_id = ? WHERE id IN (${placeholders})`,
      [proxyId ?? null, ...profileIds]
    )

    return profileIds.length
  }

  /**
   * Phase 2.2: Bulk assign group to profiles
   * @param profileIds - Array of profile IDs (max 1000)
   * @param groupId - Group ID to assign (or null to unassign)
   * @returns Number of profiles updated
   */
  bulkUpdateGroupId(profileIds: string[], groupId: string | null): number {
    if (!Array.isArray(profileIds) || profileIds.length === 0 || profileIds.length > 1000) {
      throw new Error(`Bulk update requires 1-1000 profile IDs, got ${profileIds.length}`)
    }

    const placeholders = profileIds.map(() => '?').join(',')
    this.run(
      `UPDATE profiles SET group_id = ? WHERE id IN (${placeholders})`,
      [groupId ?? null, ...profileIds]
    )

    return profileIds.length
  }

  updateProfileLastUsed(id: string): void {
    this.run(`UPDATE profiles SET last_used_at = datetime('now') WHERE id = ?`, [id])
  }

  // ── Selective sync (Account C5) ─────────────────────────────────────────
  setSyncExcluded(id: string, excluded: boolean): void {
    this.run('UPDATE profiles SET sync_excluded = ? WHERE id = ?', [excluded ? 1 : 0, id])
  }

  getSyncableProfiles(): any[] {
    const rows = this.queryAll(`
      SELECT p.*,
             pr.host || ':' || CAST(pr.port AS TEXT) AS proxy_label,
             pr.type AS proxy_type
      FROM profiles p
      LEFT JOIN proxies pr ON p.proxy_id = pr.id
      WHERE p.status != 'archived' AND COALESCE(p.sync_excluded, 0) = 0
      ORDER BY p.created_at DESC
    `)
    return rows.map((row) => this.decryptProfileRow(row))
  }

  cloneProfile(params: {
    id: string
    sourceId: string
    name: string
    fingerprint: object
    user_data_path: string
  }): void {
    const source = this.queryOne('SELECT * FROM profiles WHERE id = ?', [params.sourceId])
    if (!source) throw new Error(`Profile ${params.sourceId} not found`)
    this.run(
      `INSERT INTO profiles (id, name, group_id, fingerprint, proxy_id, notes, user_data_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.name,
        source.group_id ?? null,
        JSON.stringify(params.fingerprint),
        source.proxy_id ?? null,
        source.notes ?? '',
        params.user_data_path
      ]
    )
  }

  /**
   * Phase 4.1: Update cookies with transparent encryption.
   * Stored format: AES-256-GCM encrypted base64 string.
   * On write, always encrypts and sets encryption_version = 1.
   */
  updateCookies(id: string, cookies: string): void {
    try {
      const encrypted = encryptCookies(cookies, this.getMasterKey(), id)
      this.run(
        'UPDATE profiles SET cookies = ?, cookies_encryption_version = 1 WHERE id = ?',
        [encrypted, id],
      )
    } catch (error) {
      console.error(`[Database] Failed to encrypt cookies for profile ${id}:`, error)
      // Fallback to plain-text if encryption unavailable (don't fail the write)
      this.run('UPDATE profiles SET cookies = ?, cookies_encryption_version = 0 WHERE id = ?', [
        cookies,
        id,
      ])
    }
  }

  /**
   * Phase 4.1: Get cookies with transparent decryption.
   * Handles both encrypted (version 1) and legacy plain-text (version 0) formats.
   * Returns JSON array string ready for JSON.parse().
   */
  getCookies(id: string): string {
    const row = this.queryOne(
      'SELECT cookies, cookies_encryption_version FROM profiles WHERE id = ?',
      [id],
    )
    if (!row) return '[]'
    return this.decryptCookiesField(row.cookies, row.cookies_encryption_version, id)
  }

  /**
   * Phase 4.1: Internal helper to decrypt a cookies field based on version flag.
   * Backward compatible with legacy plain-text data.
   */
  private decryptCookiesField(
    cookies: string | null | undefined,
    version: number | null | undefined,
    profileId: string,
  ): string {
    if (!cookies) return '[]'

    // Version 0 or null = legacy plain-text
    if (!version || version === 0) return cookies

    // Version 1 = encrypted
    return safeDecryptCookies(cookies, this.getMasterKey(), profileId) || '[]'
  }

  // ── Group CRUD ─────────────────────────────────────────────────────────────

  getAllGroups(): any[] {
    return this.queryAll('SELECT * FROM profile_groups ORDER BY name ASC')
  }

  createGroup(group: { id: string; name: string; color?: string }): void {
    this.run(
      'INSERT INTO profile_groups (id, name, color) VALUES (?, ?, ?)',
      [group.id, group.name, group.color ?? '#6366f1']
    )
  }

  deleteGroup(id: string): void {
    this.run('UPDATE profiles SET group_id = NULL WHERE group_id = ?', [id])
    this.run('DELETE FROM profile_groups WHERE id = ?', [id])
  }

  updateProfileGroup(profileId: string, groupId: string | null): void {
    this.run('UPDATE profiles SET group_id = ? WHERE id = ?', [groupId ?? null, profileId])
  }

  // ── Proxy CRUD ────────────────────────────────────────────────────────────

  /**
   * Phase 4.1: Row-level helper that decrypts proxy credentials.
   * Backward compatible with version 0 (plain-text) and version 1 (encrypted).
   */
  private decryptProxyRow(row: any): any {
    if (!row) return row
    const version = row.credentials_encryption_version ?? 0
    if (version === 1) {
      if (row.username) {
        row.username = safeDecryptProxyCredential(
          row.username,
          this.getMasterKey(),
          row.id,
          'username',
        )
      }
      if (row.password) {
        row.password = safeDecryptProxyCredential(
          row.password,
          this.getMasterKey(),
          row.id,
          'password',
        )
      }
    }
    return row
  }

  getAllProxies(): any[] {
    const rows = this.queryAll('SELECT * FROM proxies ORDER BY created_at DESC')
    return rows.map((row) => this.decryptProxyRow(row))
  }

  getProxy(id: string): any {
    const row = this.queryOne('SELECT * FROM proxies WHERE id = ?', [id])
    return this.decryptProxyRow(row)
  }

  /** Return a random healthy proxy, or any proxy if none are healthy. */
  getRandomProxy(): any {
    return (
      this.queryOne('SELECT * FROM proxies WHERE is_healthy = 1 ORDER BY RANDOM() LIMIT 1') ??
      this.queryOne('SELECT * FROM proxies ORDER BY RANDOM() LIMIT 1')
    )
  }

  /** Return the next proxy in round-robin order after the given id. */
  getNextProxy(currentId: string): any {
    const all = this.getAllProxies()
    if (all.length === 0) return null
    const idx = all.findIndex((p: any) => p.id === currentId)
    return all[(idx + 1) % all.length]
  }

  updateProfileProxy(profileId: string, proxyId: string | null): void {
    this.run('UPDATE profiles SET proxy_id = ? WHERE id = ?', [proxyId, profileId])
  }

  /**
   * Phase 4.1: Create proxy with transparent credential encryption.
   * Username/password are encrypted using AES-256-GCM before storage.
   * credentials_encryption_version = 1 indicates encrypted format.
   */
  createProxy(proxy: {
    id: string
    name: string
    type: string
    host: string
    port: number
    username?: string
    password?: string
    country?: string
  }): void {
    let encUsername: string | null = null
    let encPassword: string | null = null
    let encVersion = 0

    try {
      if (proxy.username) {
        encUsername = encryptProxyCredential(
          proxy.username,
          this.getMasterKey(),
          proxy.id,
          'username',
        )
      }
      if (proxy.password) {
        encPassword = encryptProxyCredential(
          proxy.password,
          this.getMasterKey(),
          proxy.id,
          'password',
        )
      }
      encVersion = 1
    } catch (error) {
      console.error(`[Database] Failed to encrypt proxy credentials for ${proxy.id}:`, error)
      // Fallback to plain-text on encryption failure
      encUsername = proxy.username ?? null
      encPassword = proxy.password ?? null
      encVersion = 0
    }

    this.run(
      `INSERT INTO proxies (id, name, type, host, port, username, password, country, credentials_encryption_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        proxy.id,
        proxy.name,
        proxy.type,
        proxy.host,
        proxy.port,
        encUsername,
        encPassword,
        proxy.country ?? null,
        encVersion,
      ],
    )
  }

  updateProxyHealth(
    id: string,
    latency_ms: number,
    is_healthy: boolean,
    geo?: { ip?: string; timezone?: string }
  ): void {
    this.run(
      `UPDATE proxies SET latency_ms = ?, is_healthy = ?, last_checked_at = datetime('now'),
         last_ip = COALESCE(?, last_ip), timezone = COALESCE(?, timezone)
       WHERE id = ?`,
      [latency_ms, is_healthy ? 1 : 0, geo?.ip ?? null, geo?.timezone ?? null, id]
    )
  }

  deleteProxy(id: string): void {
    this.run('DELETE FROM proxies WHERE id = ?', [id])
  }

  /**
   * Partially update a proxy. Credentials are re-encrypted if supplied. Any
   * field not present in the patch object is left untouched. Updating
   * host / port / type / username / password also clears the cached health
   * status so the user knows the result is stale until a new test runs.
   */
  updateProxy(id: string, patch: {
    name?: string
    type?: string
    host?: string
    port?: number
    username?: string | null
    password?: string | null
    country?: string | null
  }): void {
    const current = this.getProxy(id)
    if (!current) throw new Error(`Proxy ${id} not found`)

    const next = {
      name: patch.name ?? current.name,
      type: patch.type ?? current.type,
      host: patch.host ?? current.host,
      port: patch.port ?? current.port,
      username:
        patch.username === undefined ? current.username ?? null : patch.username,
      password:
        patch.password === undefined ? current.password ?? null : patch.password,
      country: patch.country === undefined ? current.country ?? null : patch.country,
    }

    let encUsername: string | null = null
    let encPassword: string | null = null
    let encVersion = 0
    try {
      if (next.username) {
        encUsername = encryptProxyCredential(
          next.username,
          this.getMasterKey(),
          id,
          'username',
        )
      }
      if (next.password) {
        encPassword = encryptProxyCredential(
          next.password,
          this.getMasterKey(),
          id,
          'password',
        )
      }
      encVersion = 1
    } catch (error) {
      console.error(`[Database] Failed to encrypt proxy credentials for ${id}:`, error)
      encUsername = next.username ?? null
      encPassword = next.password ?? null
      encVersion = 0
    }

    // Invalidate cached health when any connection-affecting field changes.
    const healthChanged =
      patch.type !== undefined ||
      patch.host !== undefined ||
      patch.port !== undefined ||
      patch.username !== undefined ||
      patch.password !== undefined

    if (healthChanged) {
      this.run(
        `UPDATE proxies
         SET name = ?, type = ?, host = ?, port = ?, username = ?, password = ?,
             country = ?, credentials_encryption_version = ?,
             is_healthy = 0, latency_ms = NULL, last_checked_at = NULL
         WHERE id = ?`,
        [
          next.name,
          next.type,
          next.host,
          next.port,
          encUsername,
          encPassword,
          next.country,
          encVersion,
          id,
        ],
      )
    } else {
      this.run(
        `UPDATE proxies
         SET name = ?, type = ?, host = ?, port = ?, username = ?, password = ?,
             country = ?, credentials_encryption_version = ?
         WHERE id = ?`,
        [
          next.name,
          next.type,
          next.host,
          next.port,
          encUsername,
          encPassword,
          next.country,
          encVersion,
          id,
        ],
      )
    }
  }

  // ── Phase 20 — Proxy Provider Marketplace ─────────────────────────────────
  // Stored credentials use the same AES-256-GCM scheme as the proxies table.
  // Each field is salted with a unique tag (e.g. `provider:username:<id>`)
  // so a leak of one field can't be replayed for another.

  private encryptProviderField(value: string, accountId: string, field: string): string {
    const { createCipheriv, createHash, randomBytes } = require('crypto')
    const masterKey = this.getMasterKey()
    const salt = `provider:${field}:${accountId}`
    const key = createHash('sha256').update(Buffer.concat([masterKey, Buffer.from(salt)])).digest()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
  }

  private decryptProviderField(blob: string, accountId: string, field: string): string {
    const { createDecipheriv, createHash } = require('crypto')
    const masterKey = this.getMasterKey()
    const salt = `provider:${field}:${accountId}`
    const key = createHash('sha256').update(Buffer.concat([masterKey, Buffer.from(salt)])).digest()
    const buf = Buffer.from(blob, 'base64')
    const iv = buf.subarray(0, 12)
    const authTag = buf.subarray(12, 28)
    const ciphertext = buf.subarray(28)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  }

  getAllProxyProviders(): any[] {
    return this.queryAll(
      `SELECT * FROM proxy_provider_accounts ORDER BY created_at DESC`
    )
  }

  getProxyProvider(id: string): any {
    return this.queryOne('SELECT * FROM proxy_provider_accounts WHERE id = ?', [id])
  }

  /**
   * Returns plaintext credentials for the given account. The decryption keys
   * are derived from the machine-bound master key, so credentials cannot be
   * recovered by simply copying the SQLite file off the device.
   */
  getProxyProviderCredentials(id: string): {
    username: string
    password: string
    apiKey?: string
    zone?: string
  } | null {
    const row = this.getProxyProvider(id)
    if (!row) return null
    try {
      const username = row.username_enc ? this.decryptProviderField(row.username_enc, id, 'username') : ''
      const password = row.password_enc ? this.decryptProviderField(row.password_enc, id, 'password') : ''
      const apiKey = row.api_key_enc ? this.decryptProviderField(row.api_key_enc, id, 'apiKey') : undefined
      const zone = row.zone_enc ? this.decryptProviderField(row.zone_enc, id, 'zone') : undefined
      return { username, password, apiKey, zone }
    } catch (err) {
      console.error(`[Database] Failed to decrypt provider credentials for ${id}:`, err)
      return null
    }
  }

  createProxyProvider(
    account: {
      id: string
      type: string
      label: string
      endpoint: string
      port: number
      defaultPool: string
      defaultSession: string
      status: string
    },
    credentials: { username: string; password: string; apiKey?: string; zone?: string },
  ): void {
    const usernameEnc = credentials.username
      ? this.encryptProviderField(credentials.username, account.id, 'username')
      : null
    const passwordEnc = credentials.password
      ? this.encryptProviderField(credentials.password, account.id, 'password')
      : null
    const apiKeyEnc = credentials.apiKey
      ? this.encryptProviderField(credentials.apiKey, account.id, 'apiKey')
      : null
    const zoneEnc = credentials.zone
      ? this.encryptProviderField(credentials.zone, account.id, 'zone')
      : null

    this.run(
      `INSERT INTO proxy_provider_accounts
        (id, type, label, endpoint, port, default_pool, default_session,
         username_enc, password_enc, api_key_enc, zone_enc, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.id,
        account.type,
        account.label,
        account.endpoint,
        account.port,
        account.defaultPool,
        account.defaultSession,
        usernameEnc,
        passwordEnc,
        apiKeyEnc,
        zoneEnc,
        account.status,
      ],
    )
  }

  updateProxyProvider(
    id: string,
    patch: Partial<{
      label: string
      endpoint: string
      port: number
      defaultPool: string
      defaultSession: string
      credentials: { username?: string; password?: string; apiKey?: string; zone?: string }
    }>,
  ): void {
    const sets: string[] = []
    const params: any[] = []

    if (patch.label !== undefined)         { sets.push('label = ?');           params.push(patch.label) }
    if (patch.endpoint !== undefined)      { sets.push('endpoint = ?');        params.push(patch.endpoint) }
    if (patch.port !== undefined)          { sets.push('port = ?');            params.push(patch.port) }
    if (patch.defaultPool !== undefined)   { sets.push('default_pool = ?');    params.push(patch.defaultPool) }
    if (patch.defaultSession !== undefined){ sets.push('default_session = ?'); params.push(patch.defaultSession) }

    if (patch.credentials) {
      if (patch.credentials.username !== undefined) {
        sets.push('username_enc = ?')
        params.push(patch.credentials.username
          ? this.encryptProviderField(patch.credentials.username, id, 'username')
          : null)
      }
      if (patch.credentials.password !== undefined) {
        sets.push('password_enc = ?')
        params.push(patch.credentials.password
          ? this.encryptProviderField(patch.credentials.password, id, 'password')
          : null)
      }
      if (patch.credentials.apiKey !== undefined) {
        sets.push('api_key_enc = ?')
        params.push(patch.credentials.apiKey
          ? this.encryptProviderField(patch.credentials.apiKey, id, 'apiKey')
          : null)
      }
      if (patch.credentials.zone !== undefined) {
        sets.push('zone_enc = ?')
        params.push(patch.credentials.zone
          ? this.encryptProviderField(patch.credentials.zone, id, 'zone')
          : null)
      }
    }

    if (sets.length === 0) return

    sets.push("updated_at = datetime('now')")
    params.push(id)
    this.run(
      `UPDATE proxy_provider_accounts SET ${sets.join(', ')} WHERE id = ?`,
      params,
    )
  }

  updateProxyProviderStatus(
    id: string,
    update: { status: string; lastError: string | null; lastTestedAt: string },
  ): void {
    this.run(
      `UPDATE proxy_provider_accounts
       SET status = ?, last_error = ?, last_tested_at = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [update.status, update.lastError, update.lastTestedAt, id],
    )
  }

  updateProxyProviderUsage(id: string, usage: any): void {
    this.run(
      `UPDATE proxy_provider_accounts
       SET usage_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [JSON.stringify(usage), id],
    )
  }

  deleteProxyProvider(id: string): void {
    this.run('DELETE FROM proxy_provider_accounts WHERE id = ?', [id])
  }

  // ── Audit Log ──────────────────────────────────────────────────────────────

  addAuditEntry(entry: {
    id: string
    user_id?: string
    user_name?: string
    action: string
    target_id?: string
    target_name?: string
  }): void {
    this.run(
      `INSERT INTO audit_log (id, user_id, user_name, action, target_id, target_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.user_id ?? null,
        entry.user_name ?? null,
        entry.action,
        entry.target_id ?? null,
        entry.target_name ?? null
      ]
    )
  }

  getAuditLog(limit = 50, offset = 0): any[] {
    return this.queryAll(
      'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [limit, offset]
    )
  }

  // ── Sync Log ───────────────────────────────────────────────────────────────

  addSyncEntry(entry: {
    id: string
    direction: string
    profile_count: number
    status: string
    error_message?: string | null
  }): void {
    this.run(
      'INSERT INTO sync_log (id, direction, profile_count, status, error_message) VALUES (?, ?, ?, ?, ?)',
      [entry.id, entry.direction, entry.profile_count, entry.status, entry.error_message ?? null]
    )
  }

  getSyncLog(limit = 20): any[] {
    return this.queryAll('SELECT * FROM sync_log ORDER BY synced_at DESC LIMIT ?', [limit])
  }

  // ── Workflow CRUD ─────────────────────────────────────────────────────────

  getAllWorkflows(): any[] {
    return this.queryAll('SELECT * FROM workflows ORDER BY updated_at DESC')
  }

  getWorkflow(id: string): any {
    return this.queryOne('SELECT * FROM workflows WHERE id = ?', [id])
  }

  createWorkflow(workflow: { id: string; name: string; description?: string; steps: any[]; variables?: Record<string, string>; variableDefinitions?: import('../shared/types').VariableDefinition[]; circuitBreaker?: import('../shared/types').CircuitBreakerConfig; aiRecovery?: import('../shared/types').AiRecoveryConfig }): void {
    this.run(
      'INSERT INTO workflows (id, name, description, steps, variables, variable_definitions, circuit_breaker, ai_recovery) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        workflow.id,
        workflow.name,
        workflow.description ?? '',
        JSON.stringify(workflow.steps),
        workflow.variables ? JSON.stringify(workflow.variables) : null,
        workflow.variableDefinitions ? JSON.stringify(workflow.variableDefinitions) : null,
        workflow.circuitBreaker ? JSON.stringify(workflow.circuitBreaker) : null,
        workflow.aiRecovery ? JSON.stringify(workflow.aiRecovery) : null
      ]
    )
  }

  updateWorkflow(
    id: string,
    data: { name?: string; description?: string; steps?: any[]; variables?: Record<string, string>; variableDefinitions?: import('../shared/types').VariableDefinition[]; circuitBreaker?: import('../shared/types').CircuitBreakerConfig | null; aiRecovery?: import('../shared/types').AiRecoveryConfig | null }
  ): void {
    const sets: string[] = []
    const vals: any[] = []
    if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description) }
    if (data.steps !== undefined) { sets.push('steps = ?'); vals.push(JSON.stringify(data.steps)) }
    if (data.variables !== undefined) { sets.push('variables = ?'); vals.push(JSON.stringify(data.variables)) }
    if (data.variableDefinitions !== undefined) { sets.push('variable_definitions = ?'); vals.push(JSON.stringify(data.variableDefinitions)) }
    if (data.circuitBreaker !== undefined) { sets.push('circuit_breaker = ?'); vals.push(data.circuitBreaker ? JSON.stringify(data.circuitBreaker) : null) }
    if (data.aiRecovery !== undefined) { sets.push('ai_recovery = ?'); vals.push(data.aiRecovery ? JSON.stringify(data.aiRecovery) : null) }
    if (sets.length === 0) return
    sets.push("updated_at = datetime('now')")
    this.run(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
  }

  deleteWorkflow(id: string): void {
    this.run('DELETE FROM workflows WHERE id = ?', [id])
    // Phase 19.1: ON DELETE CASCADE removes workflow_runs rows; bust the
    // metrics cache so the dashboard reflects the deletion immediately.
    this.invalidateMetricsCache()
  }

  // ── Workflow Run Log ──────────────────────────────────────────────────────

  addWorkflowRun(run: {
    id: string
    workflow_id: string
    profile_id: string
    status: string
    step_results: any[]
    error?: string
    started_at?: string
    completed_at: string
    duration_ms?: number
    variables?: Record<string, string>
  }): void {
    // Phase 19.1: Encrypt variables at rest. Run variables frequently contain
    // secrets (API keys, passwords interpolated via {cred.password}). On
    // encryption failure we fall back to plaintext + version 0 so the run is
    // still recorded — observability beats silent data loss.
    let variablesField: string | null = null
    let variablesVersion = 0
    if (run.variables) {
      const json = JSON.stringify(run.variables)
      try {
        variablesField = encryptRunVariables(json, this.getMasterKey(), run.id)
        variablesVersion = 1
      } catch (error) {
        console.error(`[Database] Failed to encrypt variables for run ${run.id}:`, error)
        variablesField = json
        variablesVersion = 0
      }
    }

    this.run(
      `INSERT INTO workflow_runs
        (id, workflow_id, profile_id, status, step_results, error, started_at, completed_at, duration_ms, variables, variables_encryption_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.workflow_id,
        run.profile_id,
        run.status,
        JSON.stringify(run.step_results),
        run.error ?? null,
        run.started_at ?? new Date().toISOString(),
        run.completed_at,
        run.duration_ms ?? null,
        variablesField,
        variablesVersion,
      ]
    )
    // Phase 19.1: New run invalidates the cached metrics aggregations.
    this.invalidateMetricsCache()
  }

  /**
   * Phase 19.1: Decrypt the variables column for a run row, returning a JSON
   * string ready for `JSON.parse()`. Backward compatible with legacy plain
   * text rows where `variables_encryption_version` is 0/null.
   */
  private decryptRunVariablesField(
    variables: string | null | undefined,
    version: number | null | undefined,
    runId: string,
  ): string | null {
    if (!variables) return null
    if (!version || version === 0) return variables
    return safeDecryptRunVariables(variables, this.getMasterKey(), runId)
  }

  /**
   * Phase 19.1: Walk a list of raw workflow_runs rows and replace the
   * encrypted `variables` field with the decrypted JSON string in-place.
   * Used by every code path that returns rows to the renderer or to exports.
   */
  private hydrateRunVariables<T extends { id: string; variables?: any; variables_encryption_version?: number | null }>(
    rows: T[],
  ): T[] {
    for (const row of rows) {
      row.variables = this.decryptRunVariablesField(
        row.variables ?? null,
        row.variables_encryption_version ?? 0,
        row.id,
      )
    }
    return rows
  }

  getWorkflowRuns(workflowId: string, limit = 20): any[] {
    const rows = this.queryAll(
      'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
      [workflowId, limit]
    )
    return this.hydrateRunVariables(rows)
  }

  /** Tier 2: Recent runs across ALL workflows for the metrics dashboard. */
  getRecentWorkflowRuns(limit = 100): any[] {
    const rows = this.queryAll(
      `SELECT r.*, w.name AS workflow_name, p.name AS profile_name
       FROM workflow_runs r
       LEFT JOIN workflows w ON w.id = r.workflow_id
       LEFT JOIN profiles  p ON p.id = r.profile_id
       ORDER BY r.started_at DESC
       LIMIT ?`,
      [limit]
    )
    return this.hydrateRunVariables(rows)
  }

  /** Tier 2: Aggregated stats for the metrics dashboard. Optionally scoped
   *  to a single workflow id. */
  getWorkflowRunMetrics(workflowId?: string): {
    total: number
    completed: number
    failed: number
    stopped: number
    avgDurationMs: number
    successRate: number
    last7Days: { date: string; total: number; failed: number }[]
    actionErrors: { action: string; count: number }[]
  } {
    return this.getCachedMetric(`runMetrics:${workflowId ?? '*'}`, () =>
      this.computeWorkflowRunMetrics(workflowId),
    )
  }

  /** Phase 19.1: Pure compute path for `getWorkflowRunMetrics()`. Wrapped by
   *  the cache layer above; safe to call directly when fresh data is required. */
  private computeWorkflowRunMetrics(workflowId?: string): {
    total: number
    completed: number
    failed: number
    stopped: number
    avgDurationMs: number
    successRate: number
    last7Days: { date: string; total: number; failed: number }[]
    actionErrors: { action: string; count: number }[]
  } {
    const where = workflowId ? 'WHERE workflow_id = ?' : ''
    const wfParams = workflowId ? [workflowId] : []

    const totals = this.queryOne(
      `SELECT
         COUNT(*)                                              AS total,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status = 'failed'    THEN 1 ELSE 0 END) AS failed,
         SUM(CASE WHEN status = 'stopped'   THEN 1 ELSE 0 END) AS stopped,
         AVG(duration_ms)                                      AS avg_duration
       FROM workflow_runs ${where}`,
      wfParams
    ) ?? { total: 0, completed: 0, failed: 0, stopped: 0, avg_duration: 0 }

    const total = Number(totals.total ?? 0)
    const completed = Number(totals.completed ?? 0)
    const failed = Number(totals.failed ?? 0)
    const stopped = Number(totals.stopped ?? 0)
    const avgDurationMs = Math.round(Number(totals.avg_duration ?? 0))
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // 7-day time series (UTC dates)
    const series = this.queryAll(
      `SELECT
         substr(started_at, 1, 10) AS day,
         COUNT(*)                  AS total,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM workflow_runs
       ${where ? where + ' AND ' : 'WHERE '} started_at >= datetime('now', '-7 days')
       GROUP BY day
       ORDER BY day ASC`,
      wfParams
    )

    // Action-level error breakdown — extract from JSON step_results.
    // sql.js has no JSON1 functions guaranteed, so do this in JS.
    const last200 = this.queryAll(
      `SELECT step_results FROM workflow_runs ${where} ORDER BY started_at DESC LIMIT 200`,
      wfParams
    )
    const actionErrorMap = new Map<string, number>()
    for (const row of last200) {
      try {
        const steps = JSON.parse(row.step_results || '[]')
        for (const s of steps) {
          if (s && s.success === false && s.action) {
            actionErrorMap.set(s.action, (actionErrorMap.get(s.action) ?? 0) + 1)
          }
        }
      } catch { /* malformed row, skip */ }
    }
    const actionErrors = Array.from(actionErrorMap.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      total,
      completed,
      failed,
      stopped,
      avgDurationMs,
      successRate,
      last7Days: series.map((r: any) => ({
        date: r.day,
        total: Number(r.total),
        failed: Number(r.failed)
      })),
      actionErrors
    }
  }

  /** Tier 5: detailed per-action metrics. Returns slowest/fastest/avg per action. */
  getActionMetrics(workflowId?: string, limit = 100): {
    action: string
    count: number
    avg_ms: number
    min_ms: number
    max_ms: number
    failure_rate: number
  }[] {
    return this.getCachedMetric(
      `actionMetrics:${workflowId ?? '*'}:${limit}`,
      () => this.computeActionMetrics(workflowId, limit),
    )
  }

  /** Phase 19.1: Pure compute path for `getActionMetrics()`. */
  private computeActionMetrics(workflowId?: string, limit = 100): {
    action: string
    count: number
    avg_ms: number
    min_ms: number
    max_ms: number
    failure_rate: number
  }[] {
    const where = workflowId ? 'WHERE workflow_id = ?' : ''
    const params = workflowId ? [workflowId] : []

    // SQL can't easily parse JSON arrays, so we compute this in JS
    const last = this.queryAll(
      `SELECT step_results FROM workflow_runs ${where} ORDER BY started_at DESC LIMIT ?`,
      [...params, limit]
    )

    const metrics = new Map<string, { count: number; times: number[]; failures: number }>()
    for (const row of last) {
      try {
        const steps = JSON.parse(row.step_results || '[]')
        for (const s of steps) {
          if (!s || !s.action) continue
          const key = s.action
          if (!metrics.has(key)) metrics.set(key, { count: 0, times: [], failures: 0 })
          const m = metrics.get(key)!
          m.count++
          if (s.duration_ms) m.times.push(s.duration_ms)
          if (!s.success) m.failures++
        }
      } catch { /* skip malformed */ }
    }

    return Array.from(metrics.entries()).map(([action, m]) => ({
      action,
      count: m.count,
      avg_ms: m.times.length > 0 ? Math.round(m.times.reduce((a, b) => a + b, 0) / m.times.length) : 0,
      min_ms: m.times.length > 0 ? Math.min(...m.times) : 0,
      max_ms: m.times.length > 0 ? Math.max(...m.times) : 0,
      failure_rate: Math.round((m.failures / m.count) * 100)
    }))
  }

  // ── Detection Tests ───────────────────────────────────────────────────────

  saveDetectionTestResult(result: {
    id: string
    profileId: string
    profileName: string
    testedAt: string
    overallScore: number
    vectors: any[]
    status: string
    injectionScore?: number
    riskScore?: number
    proxyId?: string | null
  }): void {
    this.run(
      `INSERT INTO detection_tests
         (id, profile_id, profile_name, tested_at, overall_score, vectors, status,
          injection_score, risk_score, proxy_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id, result.profileId, result.profileName, result.testedAt,
        result.overallScore, JSON.stringify(result.vectors), result.status,
        result.injectionScore ?? result.overallScore,
        result.riskScore ?? null,
        result.proxyId ?? null
      ]
    )
  }

  /** Last recorded rendered-output hashes for a profile (R11 baseline). */
  getFingerprintHashes(profileId: string): { canvas: string; webgl: string; audio: string; recorded_at: string } | null {
    return this.queryOne('SELECT * FROM fingerprint_hashes WHERE profile_id = ?', [profileId]) ?? null
  }

  /** Every other profile's hashes, for the R12 uniqueness check. */
  getOtherFingerprintHashes(profileId: string): Array<{ profile_id: string; canvas: string; webgl: string; audio: string }> {
    return this.queryAll('SELECT * FROM fingerprint_hashes WHERE profile_id != ?', [profileId])
  }

  saveFingerprintHashes(profileId: string, h: { canvas: string; webgl: string; audio: string }): void {
    this.run(
      `INSERT INTO fingerprint_hashes (profile_id, canvas, webgl, audio, recorded_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(profile_id) DO UPDATE SET
         canvas = excluded.canvas, webgl = excluded.webgl,
         audio = excluded.audio, recorded_at = excluded.recorded_at`,
      [profileId, h.canvas, h.webgl, h.audio, new Date().toISOString()]
    )
  }

  getDetectionTestResults(profileId?: string): any[] {
    // Map snake_case DB columns → camelCase to match the renderer's
    // DetectionTestResult shape. Without this, fields like `testedAt`,
    // `profileId`, `profileName`, `overallScore` are undefined and crash
    // anything that touches them (e.g. HealthTrendChart's `r.testedAt.slice(...)`).
    const mapRow = (r: any) => ({
      id: r.id,
      profileId: r.profile_id,
      profileName: r.profile_name,
      testedAt: r.tested_at,
      overallScore: r.overall_score,
      status: r.status,
      vectors: JSON.parse(r.vectors),
      // Null on rows written before the split — the dashboard renders those as
      // injection-only rather than as a zero risk score.
      injectionScore: r.injection_score ?? r.overall_score,
      riskScore: r.risk_score ?? undefined,
      proxyId: r.proxy_id ?? null
    })
    if (profileId) {
      return this.queryAll(
        'SELECT * FROM detection_tests WHERE profile_id = ? ORDER BY tested_at DESC LIMIT 50',
        [profileId]
      ).map(mapRow)
    }
    return this.queryAll(
      'SELECT * FROM detection_tests ORDER BY tested_at DESC LIMIT 100'
    ).map(mapRow)
  }

  getDetectionTestSummary(): { totalTests: number; averageScore: number; lastTestedAt: string | null } {
    const stats = this.queryOne(`
      SELECT COUNT(*) as total, AVG(overall_score) as avg_score, MAX(tested_at) as last_tested
      FROM detection_tests
    `)
    return {
      totalTests: stats?.total ?? 0,
      averageScore: Math.round(stats?.avg_score ?? 0),
      lastTestedAt: stats?.last_tested ?? null
    }
  }

  deleteDetectionTestResult(id: string): void {
    this.run('DELETE FROM detection_tests WHERE id = ?', [id])
  }

  deleteAllDetectionTestResults(profileId?: string): void {
    if (profileId) {
      this.run('DELETE FROM detection_tests WHERE profile_id = ?', [profileId])
    } else {
      this.run('DELETE FROM detection_tests', [])
    }
  }

  // ── Profile Versions (Phase 6) ─────────────────────────────────────────────

  saveProfileVersion(version: {
    id: string
    profileId: string
    fingerprint: object
    label: string
  }): void {
    this.run(
      `INSERT INTO profile_versions (id, profile_id, fingerprint, label)
       VALUES (?, ?, ?, ?)`,
      [version.id, version.profileId, JSON.stringify(version.fingerprint), version.label]
    )
    // Keep only last 20 versions per profile to avoid unbounded growth
    this.run(
      `DELETE FROM profile_versions
       WHERE profile_id = ?
         AND id NOT IN (
           SELECT id FROM profile_versions
           WHERE profile_id = ?
           ORDER BY saved_at DESC
           LIMIT 20
         )`,
      [version.profileId, version.profileId]
    )
  }

  getProfileVersions(profileId: string): any[] {
    return this.queryAll(
      `SELECT * FROM profile_versions WHERE profile_id = ? ORDER BY saved_at DESC LIMIT 20`,
      [profileId]
    ).map(r => ({ ...r, fingerprint: JSON.parse(r.fingerprint) }))
  }

  getProfileVersion(versionId: string): any {
    const row = this.queryOne(`SELECT * FROM profile_versions WHERE id = ?`, [versionId])
    if (!row) return null
    return { ...row, fingerprint: JSON.parse(row.fingerprint) }
  }

  deleteProfileVersion(versionId: string): void {
    this.run(`DELETE FROM profile_versions WHERE id = ?`, [versionId])
  }

  // ── Recording Sessions (Phase 17) ────────────────────────────────────────

  createRecordingSession(session: {
    id: string
    profileId: string
    startedAt: string
    startUrl?: string
    captureScreenshots: boolean
    captureNetwork: boolean
  }): void {
    this.run(
      `INSERT INTO recording_sessions (id, profile_id, started_at, start_url, capture_screenshots, capture_network, events, status)
       VALUES (?, ?, ?, ?, ?, ?, '[]', 'recording')`,
      [
        session.id,
        session.profileId,
        session.startedAt,
        session.startUrl ?? null,
        session.captureScreenshots ? 1 : 0,
        session.captureNetwork ? 1 : 0
      ]
    )
  }

  updateRecordingSession(id: string, patch: {
    events?: any[]
    stoppedAt?: string
    pageTitle?: string
    status?: string
  }): void {
    const fields: string[] = []
    const values: any[] = []
    if (patch.events !== undefined) { fields.push('events = ?'); values.push(JSON.stringify(patch.events)) }
    if (patch.stoppedAt !== undefined) { fields.push('stopped_at = ?'); values.push(patch.stoppedAt) }
    if (patch.pageTitle !== undefined) { fields.push('page_title = ?'); values.push(patch.pageTitle) }
    if (patch.status !== undefined) { fields.push('status = ?'); values.push(patch.status) }
    if (fields.length === 0) return
    values.push(id)
    this.run(`UPDATE recording_sessions SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  getRecordingSession(id: string): any {
    const row = this.queryOne('SELECT * FROM recording_sessions WHERE id = ?', [id])
    if (!row) return null
    return {
      id: row.id,
      profileId: row.profile_id,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
      pageTitle: row.page_title,
      startUrl: row.start_url,
      events: JSON.parse(row.events || '[]'),
      captureScreenshots: !!row.capture_screenshots,
      captureNetwork: !!row.capture_network,
      status: row.status,
    }
  }

  listRecordingSessions(profileId?: string): any[] {
    const rows = profileId
      ? this.queryAll(
          'SELECT id, profile_id, started_at, stopped_at, page_title, start_url, capture_screenshots, capture_network, status FROM recording_sessions WHERE profile_id = ? ORDER BY started_at DESC',
          [profileId]
        )
      : this.queryAll(
          'SELECT id, profile_id, started_at, stopped_at, page_title, start_url, capture_screenshots, capture_network, status FROM recording_sessions ORDER BY started_at DESC'
        )
    return rows.map((r) => ({
      ...r,
      captureScreenshots: !!r.capture_screenshots,
      captureNetwork: !!r.capture_network,
    }))
  }

  deleteRecordingSession(id: string): void {
    this.run('DELETE FROM recording_sessions WHERE id = ?', [id])
  }

  // ── Workflow Versions (Tier 3) ────────────────────────────────────────────

  saveWorkflowVersion(version: {
    id: string
    workflowId: string
    name: string
    description: string
    steps: any[]
    variables?: Record<string, string>
    variableDefinitions?: import('../shared/types').VariableDefinition[]
    label: string
  }): void {
    this.run(
      `INSERT INTO workflow_versions (id, workflow_id, name, description, steps, variables, variable_definitions, label)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.workflowId,
        version.name,
        version.description,
        JSON.stringify(version.steps),
        version.variables ? JSON.stringify(version.variables) : null,
        version.variableDefinitions ? JSON.stringify(version.variableDefinitions) : null,
        version.label
      ]
    )
    // Keep only last 20 versions per workflow (same policy as profile_versions)
    this.run(
      `DELETE FROM workflow_versions
       WHERE workflow_id = ?
         AND id NOT IN (
           SELECT id FROM workflow_versions
           WHERE workflow_id = ?
           ORDER BY saved_at DESC
           LIMIT 20
         )`,
      [version.workflowId, version.workflowId]
    )
  }

  getWorkflowVersions(workflowId: string): any[] {
    return this.queryAll(
      `SELECT * FROM workflow_versions WHERE workflow_id = ? ORDER BY saved_at DESC LIMIT 20`,
      [workflowId]
    ).map((r) => ({
      ...r,
      steps: JSON.parse(r.steps),
      variables: r.variables ? JSON.parse(r.variables) : {},
      variableDefinitions: r.variable_definitions ? JSON.parse(r.variable_definitions) : undefined
    }))
  }

  getWorkflowVersion(versionId: string): any {
    const row = this.queryOne(`SELECT * FROM workflow_versions WHERE id = ?`, [versionId])
    if (!row) return null
    return { ...row, steps: JSON.parse(row.steps), variables: row.variables ? JSON.parse(row.variables) : {}, variableDefinitions: row.variable_definitions ? JSON.parse(row.variable_definitions) : undefined }
  }

  deleteWorkflowVersion(versionId: string): void {
    this.run(`DELETE FROM workflow_versions WHERE id = ?`, [versionId])
  }

  // ── Import Sessions & Records (Phase 1+2) ──────────────────────────────────

  // ── Bulk Import Helpers (Phase 1+2) ────────────────────────────────────────

  /** Execute a parameterised SQL statement (INSERT/UPDATE/DELETE). Public for import module. */
  execSQL(sql: string, params: any[] = []): void {
    this.run(sql, params)
  }

  findProfileByName(name: string): { id: string; name: string } | null {
    const row = this.queryOne(
      `SELECT id, name FROM profiles WHERE LOWER(name) = LOWER(?) AND status = 'active'`,
      [name]
    )
    return row ? { id: row.id as string, name: row.name as string } : null
  }

  findProfileByFingerprintHash(hash: string): { id: string; name: string } | null {
    const row = this.queryOne(
      `SELECT id, name FROM profiles WHERE fingerprint_hash = ? AND status = 'active'`,
      [hash]
    )
    return row ? { id: row.id as string, name: row.name as string } : null
  }

  findProxyById(id: string): boolean {
    return !!this.queryOne(`SELECT id FROM proxies WHERE id = ?`, [id])
  }

  findGroupById(id: string): boolean {
    return !!this.queryOne(`SELECT id FROM profile_groups WHERE id = ?`, [id])
  }

  getImportSessions(limit = 50, offset = 0): any[] {
    return this.queryAll(
      `SELECT * FROM import_sessions ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    )
  }

  getImportSession(id: string): any {
    return this.queryOne(`SELECT * FROM import_sessions WHERE id = ?`, [id])
  }

  getImportRecords(sessionId: string): any[] {
    return this.queryAll(
      `SELECT * FROM import_records WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId]
    )
  }

  deleteImportSession(id: string): void {
    this.run(`DELETE FROM import_records WHERE session_id = ?`, [id])
    this.run(`DELETE FROM import_sessions WHERE id = ?`, [id])
  }

  getImportStats(): { totalSessions: number; totalImported: number; totalErrors: number } {
    const stats = this.queryOne(`
      SELECT
        COUNT(DISTINCT s.id) as totalSessions,
        COALESCE(SUM(s.success_count), 0) as totalImported,
        COALESCE(SUM(s.error_count), 0) as totalErrors
      FROM import_sessions s
    `)
    return {
      totalSessions: (stats?.totalSessions as number) ?? 0,
      totalImported: (stats?.totalImported as number) ?? 0,
      totalErrors: (stats?.totalErrors as number) ?? 0
    }
  }

  // ── Behavior Session Tracking (P3: Session-to-Session Drift) ──────────

  /** Insert a behavior session metrics row. */
  saveBehaviorSession(metrics: {
    id: string
    profile_id: string
    session_id: string
    timestamp: string
    mouse_velocity_avg: number
    mouse_acceleration_variance: number
    mouse_direction_changes: number
    typing_wpm: number
    typing_variance: number
    typing_pause_frequency: number
    scroll_speed_avg: number
    scroll_pause_count: number
    scroll_direction_changes: number
    bot_consistency_score: number
  }): void {
    this.run(
      `INSERT INTO behavior_sessions (id, profile_id, session_id, timestamp,
        mouse_velocity_avg, mouse_acceleration_variance, mouse_direction_changes,
        typing_wpm, typing_variance, typing_pause_frequency,
        scroll_speed_avg, scroll_pause_count, scroll_direction_changes,
        bot_consistency_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        metrics.id,
        metrics.profile_id,
        metrics.session_id,
        metrics.timestamp,
        metrics.mouse_velocity_avg,
        metrics.mouse_acceleration_variance,
        metrics.mouse_direction_changes,
        metrics.typing_wpm,
        metrics.typing_variance,
        metrics.typing_pause_frequency,
        metrics.scroll_speed_avg,
        metrics.scroll_pause_count,
        metrics.scroll_direction_changes,
        metrics.bot_consistency_score,
      ]
    )
  }

  /** Retrieve the most recent behavior sessions for a profile. */
  getBehaviorSessions(profileId: string, limit: number = 10): any[] {
    return this.queryAll(
      `SELECT * FROM behavior_sessions
       WHERE profile_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      [profileId, limit]
    )
  }

  /** Calculate a composite health score for a profile. */
  getProfileHealthScore(profileId: string): ProfileHealthScore | null {
    // Get profile basics
    const profile = this.queryOne(
      'SELECT id, last_used_at, created_at FROM profiles WHERE id = ?',
      [profileId]
    )
    if (!profile) return null

    // Latest detection test score
    const detectionRow = this.queryOne(
      'SELECT overall_score FROM detection_tests WHERE profile_id = ? ORDER BY tested_at DESC LIMIT 1',
      [profileId]
    )
    const detectionScore: number = detectionRow ? detectionRow.overall_score : 50

    // Latest behavior session bot_consistency_score (table may not exist)
    let behaviorScore = 70
    try {
      const behaviorRow = this.queryOne(
        'SELECT bot_consistency_score FROM behavior_sessions WHERE profile_id = ? ORDER BY timestamp DESC LIMIT 1',
        [profileId]
      )
      if (behaviorRow) {
        behaviorScore = 100 - behaviorRow.bot_consistency_score
      }
    } catch {
      // behavior_sessions table may not exist yet — use default
    }

    // Freshness score based on days since last_used_at
    let freshnessScore = 50
    if (profile.last_used_at) {
      const lastUsed = new Date(profile.last_used_at).getTime()
      const now = Date.now()
      const daysSinceUse = (now - lastUsed) / (1000 * 60 * 60 * 24)
      if (daysSinceUse <= 0) {
        freshnessScore = 100
      } else if (daysSinceUse >= 30) {
        freshnessScore = 20
      } else {
        // Linear interpolation: 0 days → 100, 30 days → 20
        freshnessScore = Math.round(100 - (daysSinceUse / 30) * 80)
      }
    }

    // Weighted average: detection 40%, behavior 35%, freshness 25%
    const overallScore = Math.round(
      detectionScore * 0.4 + behaviorScore * 0.35 + freshnessScore * 0.25
    )

    // Risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical'
    if (overallScore >= 80) {
      riskLevel = 'low'
    } else if (overallScore >= 60) {
      riskLevel = 'medium'
    } else if (overallScore >= 40) {
      riskLevel = 'high'
    } else {
      riskLevel = 'critical'
    }

    const factors: ProfileHealthFactor[] = [
      {
        name: 'Detection Test',
        score: detectionScore,
        weight: 0.4,
        detail: detectionRow
          ? `Latest detection test score: ${detectionScore}`
          : 'No detection tests run — using default score of 50',
      },
      {
        name: 'Behavior Consistency',
        score: behaviorScore,
        weight: 0.35,
        detail: behaviorScore !== 70
          ? `Bot consistency inverse: ${behaviorScore}`
          : 'No behavior sessions recorded — using default score of 70',
      },
      {
        name: 'Profile Freshness',
        score: freshnessScore,
        weight: 0.25,
        detail: profile.last_used_at
          ? `Last used: ${profile.last_used_at}`
          : 'Profile has never been used',
      },
    ]

    return {
      profileId,
      overallScore,
      detectionScore,
      behaviorScore,
      freshnessScore,
      riskLevel,
      factors,
      calculatedAt: new Date().toISOString(),
    }
  }

  // ── Phase 17: Mobile Workflows ──────────────────────────────────────────────

  createMobileWorkflow(w: {
    id: string
    name: string
    description?: string
    steps: any[]
    deviceConfig: any
    behaviorPattern?: string
    isTemplate?: boolean
  }): void {
    this.run(
      `INSERT INTO mobile_workflows (id, name, description, steps, device_config, behavior_pattern, is_template)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        w.id,
        w.name,
        w.description ?? '',
        JSON.stringify(w.steps),
        JSON.stringify(w.deviceConfig),
        w.behaviorPattern ?? null,
        w.isTemplate ? 1 : 0
      ]
    )
  }

  updateMobileWorkflow(id: string, updates: Record<string, any>): void {
    const fields: string[] = []
    const values: any[] = []
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
    if (updates.steps !== undefined) { fields.push('steps = ?'); values.push(JSON.stringify(updates.steps)) }
    if (updates.deviceConfig !== undefined) { fields.push('device_config = ?'); values.push(JSON.stringify(updates.deviceConfig)) }
    if (updates.behaviorPattern !== undefined) { fields.push('behavior_pattern = ?'); values.push(updates.behaviorPattern) }
    if (fields.length === 0) return
    fields.push("updated_at = datetime('now')")
    values.push(id)
    this.run(`UPDATE mobile_workflows SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  getMobileWorkflow(id: string): any {
    const row = this.queryOne('SELECT * FROM mobile_workflows WHERE id = ?', [id])
    if (!row) return null
    return this.parseMobileWorkflowRow(row)
  }

  getAllMobileWorkflows(): any[] {
    return this.queryAll('SELECT * FROM mobile_workflows ORDER BY updated_at DESC')
      .map((r) => this.parseMobileWorkflowRow(r))
  }

  deleteMobileWorkflow(id: string): void {
    this.run('DELETE FROM mobile_workflows WHERE id = ?', [id])
  }

  private parseMobileWorkflowRow(row: any): any {
    return {
      ...row,
      steps: JSON.parse(row.steps || '[]'),
      deviceConfig: JSON.parse(row.device_config || '{}'),
      isTemplate: row.is_template === 1
    }
  }

  // ── Phase 17: Mobile Execution Logs ─────────────────────────────────────────

  addMobileExecutionLog(log: {
    id: string
    workflow_id: string
    profile_id: string
    device_name?: string
    status?: string
  }): void {
    this.run(
      `INSERT INTO mobile_execution_logs (id, workflow_id, profile_id, device_name, status)
       VALUES (?, ?, ?, ?, ?)`,
      [log.id, log.workflow_id, log.profile_id, log.device_name ?? '', log.status ?? 'running']
    )
  }

  updateMobileExecutionLog(id: string, updates: {
    status?: string
    error_message?: string
    step_results?: any[]
    metrics?: any
    sensor_state?: any
    duration_ms?: number
  }): void {
    const fields: string[] = []
    const values: any[] = []
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
    if (updates.error_message !== undefined) { fields.push('error_message = ?'); values.push(updates.error_message) }
    if (updates.step_results !== undefined) { fields.push('step_results = ?'); values.push(JSON.stringify(updates.step_results)) }
    if (updates.metrics !== undefined) { fields.push('metrics = ?'); values.push(JSON.stringify(updates.metrics)) }
    if (updates.sensor_state !== undefined) { fields.push('sensor_state = ?'); values.push(JSON.stringify(updates.sensor_state)) }
    if (updates.duration_ms !== undefined) { fields.push('duration_ms = ?'); values.push(updates.duration_ms) }
    if (updates.status === 'success' || updates.status === 'failed' || updates.status === 'timeout') {
      fields.push("ended_at = datetime('now')")
    }
    if (fields.length === 0) return
    values.push(id)
    this.run(`UPDATE mobile_execution_logs SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  getMobileExecutionLogs(workflowId?: string, limit: number = 50): any[] {
    if (workflowId) {
      return this.queryAll(
        'SELECT * FROM mobile_execution_logs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
        [workflowId, limit]
      )
    }
    return this.queryAll(
      'SELECT * FROM mobile_execution_logs ORDER BY started_at DESC LIMIT ?',
      [limit]
    )
  }

  getMobileExecutionLog(id: string): any {
    return this.queryOne('SELECT * FROM mobile_execution_logs WHERE id = ?', [id])
  }

  deleteMobileExecutionLog(id: string): void {
    this.run('DELETE FROM mobile_execution_logs WHERE id = ?', [id])
  }

  // ── Phase 17: Gesture Templates ─────────────────────────────────────────────

  createGestureTemplate(t: {
    id: string
    name: string
    gesture_type: string
    description?: string
    config: any
  }): void {
    this.run(
      `INSERT INTO gesture_templates (id, name, gesture_type, description, config) VALUES (?, ?, ?, ?, ?)`,
      [t.id, t.name, t.gesture_type, t.description ?? '', JSON.stringify(t.config)]
    )
  }

  getAllGestureTemplates(): any[] {
    return this.queryAll('SELECT * FROM gesture_templates ORDER BY created_at DESC')
      .map((r) => ({ ...r, config: JSON.parse(r.config || '{}') }))
  }

  deleteGestureTemplate(id: string): void {
    this.run('DELETE FROM gesture_templates WHERE id = ?', [id])
  }
}
