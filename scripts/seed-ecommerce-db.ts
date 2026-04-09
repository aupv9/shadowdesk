/**
 * Ghost Browser — E-Commerce Operations DB seeder
 *
 * Reads the JSON fixtures produced by `scripts/generate-ecommerce-testdata.ts`
 * and inserts them DIRECTLY into the Electron app's sql.js database file
 * (`<userData>/ghost-browser.db`).
 *
 * After running this, opening the Electron app with `npm run dev` shows:
 *
 *   - 10 E-Commerce Operations profiles in the Profile Manager
 *   - 6 residential proxies in the Proxy Manager
 *   - ~11 SEA e-commerce workflows in the Automation section (Shopee, Lazada,
 *     TikTok Shop, Tiki, GrabFood, VNPay), each with default variables +
 *     recommended profile IDs pre-wired
 *
 * The user can then click Run on any workflow, pick a profile, and watch the
 * automation engine drive a real Chromium window through the scraping flow.
 *
 * Schema strategy
 * ---------------
 * The seeder uses `CREATE TABLE IF NOT EXISTS` for a MINIMAL subset of the
 * tables we actually insert into (proxies, profiles, profile_groups,
 * workflows). Every column is defined to match the Electron app's migration.
 * When the app opens this DB later, its `migrate()` function runs all the
 * other migrations (audit_log, workflow_runs, detection_tests, warmup_plans,
 * ...) idempotently because they all use `IF NOT EXISTS` / try/catch ALTER.
 *
 * This means the seeder works whether the DB already exists (user has run
 * the app before) or not (fresh install) — in both cases the app starts
 * correctly on next launch.
 *
 * Proxy credential encryption
 * ---------------------------
 * The app encrypts proxy username/password via AES-256-GCM tied to the
 * machine fingerprint (see `src/main/crypto/profile-encryption.ts`). The
 * seeder writes credentials as PLAIN TEXT with `credentials_encryption_version = 0`,
 * which the app treats as legacy unencrypted data and handles gracefully
 * via `safeDecryptProxyCredential()`. This keeps the seeder free of
 * electron / machine-id dependencies.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import initSqlJs, { type Database as SqlDatabase } from 'sql.js'

// ── Path resolution ──────────────────────────────────────────────────────────
// Mirrors Electron's `app.getPath('userData')` which returns:
//   Linux:   $XDG_CONFIG_HOME/<name>  OR  ~/.config/<name>
//   macOS:   ~/Library/Application Support/<name>
//   Windows: %APPDATA%\<name>
// `<name>` is `app.getName()` which defaults to the `name` field in the
// app's package.json.

function resolveUserDataDir(): string {
  const override = process.env.GHOST_BROWSER_USERDATA
  if (override) return override

  // Read the app name from package.json to stay in sync with Electron's default.
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')
  )
  const appName: string = pkg.name ?? 'ghost-browser'

  const platform = process.platform
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName)
  }
  if (platform === 'win32') {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, appName)
  }
  // Linux / others
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
  return path.join(xdg, appName)
}

// ── Minimal schema — idempotent, app-migration-compatible ────────────────────

const SCHEMA_DDL = `
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
  created_at TEXT DEFAULT (datetime('now')),
  credentials_encryption_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS profile_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
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
  rotation_mode TEXT DEFAULT 'none',
  rotation_index INTEGER DEFAULT 0,
  cookies_encryption_version INTEGER DEFAULT 0,
  FOREIGN KEY(proxy_id) REFERENCES proxies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_group  ON profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_proxies_healthy ON proxies(is_healthy);

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]',
  variables TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`

// ── Fixtures IO ──────────────────────────────────────────────────────────────

interface ProxyFixture {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string
  password: string
  country: string
  is_healthy: number
  latency_ms: number
}

interface ProfileFixture {
  id: string
  name: string
  group_id: string | null
  fingerprint: any
  proxy_id: string
  notes: string
  status: string
  rotation_mode: string
  user_data_path: string
}

interface WorkflowFixture {
  id: string
  name: string
  description: string
  steps: any[]
  variables: Record<string, string>
}

interface GroupFixture {
  id: string
  name: string
  color: string
}

function loadFixtures(): {
  proxies: ProxyFixture[]
  profiles: ProfileFixture[]
  workflows: WorkflowFixture[]
  group: GroupFixture
} {
  const dir = path.join(process.cwd(), 'testdata')
  const required = [
    'ecommerce-proxies.json',
    'ecommerce-profiles.json',
    'ecommerce-workflows.json',
    'ecommerce-profile-group.json'
  ]
  for (const f of required) {
    if (!fs.existsSync(path.join(dir, f))) {
      console.error(
        `Fixture not found: ${f}\n\n` +
          'Run the generator first:\n' +
          '  npm run test:ecommerce:seed:generate'
      )
      process.exit(1)
    }
  }
  return {
    proxies: JSON.parse(fs.readFileSync(path.join(dir, 'ecommerce-proxies.json'), 'utf8')),
    profiles: JSON.parse(fs.readFileSync(path.join(dir, 'ecommerce-profiles.json'), 'utf8')),
    workflows: JSON.parse(fs.readFileSync(path.join(dir, 'ecommerce-workflows.json'), 'utf8')),
    group: JSON.parse(fs.readFileSync(path.join(dir, 'ecommerce-profile-group.json'), 'utf8'))
  }
}

// ── Insert helpers ───────────────────────────────────────────────────────────
// All inserts use `INSERT OR REPLACE INTO` (keyed by id) so re-running the
// seeder is idempotent — it updates existing rows in place rather than
// failing on duplicates.

function seedProxies(db: SqlDatabase, proxies: ProxyFixture[]): number {
  let count = 0
  for (const p of proxies) {
    db.run(
      `INSERT OR REPLACE INTO proxies
       (id, name, type, host, port, username, password, country, latency_ms, is_healthy, credentials_encryption_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        p.id,
        p.name,
        p.type,
        p.host,
        p.port,
        p.username,
        p.password,
        p.country,
        p.latency_ms,
        p.is_healthy
      ]
    )
    count++
  }
  return count
}

function seedGroup(db: SqlDatabase, group: GroupFixture): void {
  db.run(
    `INSERT OR REPLACE INTO profile_groups (id, name, color) VALUES (?, ?, ?)`,
    [group.id, group.name, group.color]
  )
}

function seedProfiles(
  db: SqlDatabase,
  profiles: ProfileFixture[],
  userDataDir: string
): number {
  let count = 0
  for (const p of profiles) {
    const userDataPath = path.join(userDataDir, 'profiles', p.id)
    db.run(
      `INSERT OR REPLACE INTO profiles
       (id, name, group_id, fingerprint, proxy_id, notes, status, rotation_mode, user_data_path, cookies, cookies_encryption_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0)`,
      [
        p.id,
        p.name,
        p.group_id,
        JSON.stringify(p.fingerprint),
        p.proxy_id,
        p.notes,
        p.status,
        p.rotation_mode,
        userDataPath
      ]
    )
    count++
  }
  return count
}

function seedWorkflows(db: SqlDatabase, workflows: WorkflowFixture[]): number {
  let count = 0
  for (const w of workflows) {
    db.run(
      `INSERT OR REPLACE INTO workflows (id, name, description, steps, variables)
       VALUES (?, ?, ?, ?, ?)`,
      [
        w.id,
        w.name,
        w.description,
        JSON.stringify(w.steps),
        JSON.stringify(w.variables ?? {})
      ]
    )
    count++
  }
  return count
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Ghost Browser — E-Commerce Operations DB seeder\n')

  const userDataDir = resolveUserDataDir()
  const dbPath = path.join(userDataDir, 'ghost-browser.db')
  console.log(`App userData:  ${userDataDir}`)
  console.log(`Database:      ${dbPath}`)

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true })
    console.log('(created userData directory)')
  }

  const fixtures = loadFixtures()
  console.log(
    `Fixtures:      ${fixtures.proxies.length} proxies / ` +
      `${fixtures.profiles.length} profiles / ` +
      `${fixtures.workflows.length} workflows`
  )
  console.log('')

  const SQL = await initSqlJs()
  let db: SqlDatabase
  const dbExisted = fs.existsSync(dbPath)
  if (dbExisted) {
    console.log('Opening existing database...')
    db = new SQL.Database(fs.readFileSync(dbPath))
  } else {
    console.log('No existing database — creating fresh file...')
    db = new SQL.Database()
  }

  console.log('Running idempotent schema DDL...')
  db.exec(SCHEMA_DDL)

  console.log('Seeding rows...')
  seedGroup(db, fixtures.group)
  const proxyCount = seedProxies(db, fixtures.proxies)
  const profileCount = seedProfiles(db, fixtures.profiles, userDataDir)
  const workflowCount = seedWorkflows(db, fixtures.workflows)

  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
  db.close()

  const existingMsg = dbExisted ? '(updated existing DB)' : '(created new DB)'
  console.log('')
  console.log(`Seeded ${existingMsg}:`)
  console.log(`  proxies    ${proxyCount}`)
  console.log(`  profiles   ${profileCount}`)
  console.log(`  workflows  ${workflowCount}`)
  console.log('')
  console.log('Next step:')
  console.log('  1. Start the app:           npm run dev')
  console.log(`  2. Open "Profiles" tab      — you should see ${profileCount} E-Commerce Ops profiles`)
  console.log(`  3. Open "Proxies" tab       — you should see ${proxyCount} SEA proxies`)
  console.log(`  4. Open "Automation" tab    — you should see ${workflowCount} SEA workflows`)
  console.log('  5. Click Run on any workflow to watch it drive a real Chromium window')
}

main().catch((err) => {
  console.error('Seeder crashed:', err)
  process.exit(1)
})
