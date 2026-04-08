import initSqlJs from 'sql.js'
import type { Database as SqlDatabase } from 'sql.js'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export class Database {
  private static instance: Database
  private db!: SqlDatabase
  private dbPath!: string

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database()
    }
    return Database.instance
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

    // Sync history error_message column (Account C3)
    try {
      this.db.exec(`ALTER TABLE sync_log ADD COLUMN error_message TEXT`)
    } catch { /* exists */ }

    // Selective sync — per-profile opt-out (Account C5)
    try {
      this.db.exec(`ALTER TABLE profiles ADD COLUMN sync_excluded INTEGER DEFAULT 0`)
    } catch { /* exists */ }

    // Tier 2 RPA — extended workflow run logging
    try {
      this.db.exec(`ALTER TABLE workflow_runs ADD COLUMN duration_ms INTEGER`)
    } catch { /* exists */ }
    try {
      this.db.exec(`ALTER TABLE workflow_runs ADD COLUMN variables TEXT`)
    } catch { /* exists */ }

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

  // ── Profile CRUD ──────────────────────────────────────────────────────────

  getAllProfiles(): any[] {
    return this.queryAll(`
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
    const profiles = this.queryAll(
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
    return this.queryOne(`
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
    return this.queryAll(`
      SELECT p.*,
             pr.host || ':' || CAST(pr.port AS TEXT) AS proxy_label,
             pr.type AS proxy_type
      FROM profiles p
      LEFT JOIN proxies pr ON p.proxy_id = pr.id
      WHERE p.status != 'archived' AND COALESCE(p.sync_excluded, 0) = 0
      ORDER BY p.created_at DESC
    `)
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

  updateCookies(id: string, cookies: string): void {
    this.run('UPDATE profiles SET cookies = ? WHERE id = ?', [cookies, id])
  }

  getCookies(id: string): string {
    const row = this.queryOne('SELECT cookies FROM profiles WHERE id = ?', [id])
    return row?.cookies ?? '[]'
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

  getAllProxies(): any[] {
    return this.queryAll('SELECT * FROM proxies ORDER BY created_at DESC')
  }

  getProxy(id: string): any {
    return this.queryOne('SELECT * FROM proxies WHERE id = ?', [id])
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
    this.run(
      `INSERT INTO proxies (id, name, type, host, port, username, password, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        proxy.id,
        proxy.name,
        proxy.type,
        proxy.host,
        proxy.port,
        proxy.username ?? null,
        proxy.password ?? null,
        proxy.country ?? null
      ]
    )
  }

  updateProxyHealth(id: string, latency_ms: number, is_healthy: boolean): void {
    this.run(
      `UPDATE proxies SET latency_ms = ?, is_healthy = ?, last_checked_at = datetime('now') WHERE id = ?`,
      [latency_ms, is_healthy ? 1 : 0, id]
    )
  }

  deleteProxy(id: string): void {
    this.run('DELETE FROM proxies WHERE id = ?', [id])
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

  createWorkflow(workflow: { id: string; name: string; description?: string; steps: any[]; variables?: Record<string, string> }): void {
    this.run(
      'INSERT INTO workflows (id, name, description, steps, variables) VALUES (?, ?, ?, ?, ?)',
      [
        workflow.id,
        workflow.name,
        workflow.description ?? '',
        JSON.stringify(workflow.steps),
        workflow.variables ? JSON.stringify(workflow.variables) : null
      ]
    )
  }

  updateWorkflow(
    id: string,
    data: { name?: string; description?: string; steps?: any[]; variables?: Record<string, string> }
  ): void {
    const sets: string[] = []
    const vals: any[] = []
    if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name) }
    if (data.description !== undefined) { sets.push('description = ?'); vals.push(data.description) }
    if (data.steps !== undefined) { sets.push('steps = ?'); vals.push(JSON.stringify(data.steps)) }
    if (data.variables !== undefined) { sets.push('variables = ?'); vals.push(JSON.stringify(data.variables)) }
    if (sets.length === 0) return
    sets.push("updated_at = datetime('now')")
    this.run(`UPDATE workflows SET ${sets.join(', ')} WHERE id = ?`, [...vals, id])
  }

  deleteWorkflow(id: string): void {
    this.run('DELETE FROM workflows WHERE id = ?', [id])
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
    this.run(
      `INSERT INTO workflow_runs
        (id, workflow_id, profile_id, status, step_results, error, started_at, completed_at, duration_ms, variables)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        run.variables ? JSON.stringify(run.variables) : null
      ]
    )
  }

  getWorkflowRuns(workflowId: string, limit = 20): any[] {
    return this.queryAll(
      'SELECT * FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?',
      [workflowId, limit]
    )
  }

  /** Tier 2: Recent runs across ALL workflows for the metrics dashboard. */
  getRecentWorkflowRuns(limit = 100): any[] {
    return this.queryAll(
      `SELECT r.*, w.name AS workflow_name, p.name AS profile_name
       FROM workflow_runs r
       LEFT JOIN workflows w ON w.id = r.workflow_id
       LEFT JOIN profiles  p ON p.id = r.profile_id
       ORDER BY r.started_at DESC
       LIMIT ?`,
      [limit]
    )
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
  }): void {
    this.run(
      `INSERT INTO detection_tests (id, profile_id, profile_name, tested_at, overall_score, vectors, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [result.id, result.profileId, result.profileName, result.testedAt, result.overallScore, JSON.stringify(result.vectors), result.status]
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
      vectors: JSON.parse(r.vectors)
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
    label: string
  }): void {
    this.run(
      `INSERT INTO workflow_versions (id, workflow_id, name, description, steps, variables, label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        version.id,
        version.workflowId,
        version.name,
        version.description,
        JSON.stringify(version.steps),
        version.variables ? JSON.stringify(version.variables) : null,
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
      variables: r.variables ? JSON.parse(r.variables) : {}
    }))
  }

  getWorkflowVersion(versionId: string): any {
    const row = this.queryOne(`SELECT * FROM workflow_versions WHERE id = ?`, [versionId])
    if (!row) return null
    return { ...row, steps: JSON.parse(row.steps), variables: row.variables ? JSON.parse(row.variables) : {} }
  }

  deleteWorkflowVersion(versionId: string): void {
    this.run(`DELETE FROM workflow_versions WHERE id = ?`, [versionId])
  }
}
