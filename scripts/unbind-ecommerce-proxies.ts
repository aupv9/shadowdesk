/**
 * Ghost Browser — unbind demo proxies from E-Commerce Ops profiles
 *
 * Quick-fix utility for the "ERR_TIMEOUT at shopee.vn" case: the seeded
 * E-Commerce Operations profiles are bound to demo proxies whose hosts
 * (`103.x.y.z`) don't actually exist. When Chromium tries to tunnel through
 * them, every outbound request times out.
 *
 * This script opens the app's ghost-browser.db directly and sets
 * `proxy_id = NULL` on every profile belonging to the "E-Commerce
 * Operations" group (identified via `profile_groups.name`). Proxies are
 * left in the Proxy Manager so users can still see the seeded rows and
 * edit them with real credentials later — only the profile bindings are
 * cleared.
 *
 * Faster than re-running the full seeder, and doesn't touch the workflow
 * rows (so any edits the user made in the app's Automation UI are safe).
 *
 * Usage:
 *   npm run test:ecommerce:unbind-proxies
 *   # or directly:
 *   npx tsx scripts/unbind-ecommerce-proxies.ts
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import initSqlJs from 'sql.js'

function resolveUserDataDir(): string {
  const override = process.env.GHOST_BROWSER_USERDATA
  if (override) return override
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
  const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config')
  return path.join(xdg, appName)
}

async function main(): Promise<void> {
  console.log('Ghost Browser — unbind E-Commerce Ops profile proxies\n')

  const userDataDir = resolveUserDataDir()
  const dbPath = path.join(userDataDir, 'ghost-browser.db')

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`)
    console.error('')
    console.error('Run the seeder first:')
    console.error('  npm run test:ecommerce:seed')
    process.exit(1)
  }

  const SQL = await initSqlJs()
  const db = new SQL.Database(fs.readFileSync(dbPath))

  // Find the E-Commerce Operations group id. If it's missing we fall back
  // to matching the profile name prefix instead — that way the script still
  // works against older seed runs that predate the group column.
  const groupRes = db.exec(
    `SELECT id FROM profile_groups WHERE name = 'E-Commerce Operations' LIMIT 1`
  )
  const groupId = groupRes[0]?.values[0]?.[0] as string | undefined

  let selectSql: string
  let params: any[]
  if (groupId) {
    selectSql = `SELECT id, name, proxy_id FROM profiles WHERE group_id = ?`
    params = [groupId]
  } else {
    selectSql = `
      SELECT id, name, proxy_id FROM profiles
      WHERE name LIKE 'Shopee %' OR name LIKE 'Lazada %'
         OR name LIKE 'TikTok Shop %' OR name LIKE 'Tiki %'
         OR name LIKE 'GrabFood %'
    `
    params = []
  }

  const selected = db.exec(selectSql, params)
  const rows = (selected[0]?.values ?? []) as Array<[string, string, string | null]>

  if (rows.length === 0) {
    console.log('No E-Commerce Operations profiles found — nothing to do.')
    db.close()
    return
  }

  console.log(`Found ${rows.length} profiles:`)
  for (const [, name, proxyId] of rows) {
    const badge = proxyId ? `proxy_id=${proxyId.slice(0, 8)}…` : 'no proxy (already unbound)'
    console.log(`  - ${name}  [${badge}]`)
  }
  console.log('')

  const bound = rows.filter(([, , proxyId]) => proxyId !== null)
  if (bound.length === 0) {
    console.log('All profiles already have proxy_id = NULL. No changes made.')
    db.close()
    return
  }

  console.log(`Unbinding ${bound.length} profile(s)...`)
  for (const [id] of bound) {
    db.run(`UPDATE profiles SET proxy_id = NULL WHERE id = ?`, [id])
  }

  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
  db.close()

  console.log('')
  console.log(`Unbound ${bound.length} E-Commerce Ops profile(s) from their proxies.`)
  console.log('Proxies themselves are still in the Proxy Manager — edit them with real')
  console.log('credentials any time and re-attach via the profile editor.')
  console.log('')
  console.log('Now restart the app:')
  console.log('  npm run dev')
  console.log('Then launch a profile → Chromium will connect direct, no ERR_TIMEOUT.')
}

main().catch((err) => {
  console.error('Failed to unbind proxies:', err)
  process.exit(1)
})
