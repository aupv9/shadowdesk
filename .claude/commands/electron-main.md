Review or implement the requested task using Ghost Browser's Electron main process patterns.

## Stack
- **Runtime**: Electron 31 (Node 20.x internally)
- **Language**: TypeScript, compiled by electron-vite as CJS SSR bundle
- **Database**: sql.js (WASM SQLite) — singleton, async init, sync queries
- **Browser**: puppeteer-core with CDP for Chromium profile management
- **IPC**: Electron ipcMain/ipcRenderer with contextBridge

---

## Main Process Structure

```
src/main/
├── index.ts           ← entry: window + DB init + IPC registration
├── database.ts        ← Database singleton
├── browser-manager.ts ← BrowserManager singleton (Chromium sessions)
├── fingerprint/
│   ├── injector.ts    ← FingerprintInjector.injectAll(page, fp)
│   ├── presets.ts     ← FINGERPRINT_PRESETS + resolveFingerprint()
│   └── scripts/       ← buildXxxScript(config): string functions
└── ipc/handlers.ts    ← all ipcMain.handle() registrations
```

---

## IPC Pattern — Full 3-File Chain

Every new feature needs updates in all three places:

### 1. Main handler (`src/main/ipc/handlers.ts`)
```typescript
ipcMain.handle('profiles:launch', async (_event, id: string) => {
  const profile = db.getProfile(id) as any
  if (!profile) throw new Error(`Profile ${id} not found`)
  await bm.launchProfile(id, JSON.parse(profile.fingerprint), proxy)
  db.updateProfileLastUsed(id)
})
```

### 2. Preload bridge (`src/preload/index.ts`)
```typescript
const api = {
  profiles: {
    launch: (id: string) => ipcRenderer.invoke('profiles:launch', id),
  }
}
contextBridge.exposeInMainWorld('api', api)
```

### 3. Renderer type (`src/renderer/src/env.d.ts`)
```typescript
interface Window {
  api: {
    profiles: {
      launch: (id: string) => Promise<void>
    }
  }
}
```

---

## Database Patterns

```typescript
// ALWAYS use Database.getInstance() — never construct directly
const db = Database.getInstance()

// Queries return plain JS objects (converted from sql.js column arrays)
const profiles = db.getAllProfiles()  // returns any[]

// Parameterized queries use positional ? (not :name like better-sqlite3)
this.run('UPDATE profiles SET name = ? WHERE id = ?', [name, id])

// Every run() auto-saves to disk — no explicit save needed
// But batch multiple operations before returning if possible

// JSON fields must be stringified on write, parsed on read
this.run('INSERT INTO profiles ... VALUES (?)', [JSON.stringify(fingerprint)])
const fp = JSON.parse(row.fingerprint)
```

### Adding a new table
1. Add `CREATE TABLE IF NOT EXISTS` to the `migrate()` method in `database.ts`
2. Add CRUD methods to the `Database` class
3. Register IPC handlers in `handlers.ts`
4. Expose via preload in `preload/index.ts`
5. Add to `env.d.ts` Window interface

---

## BrowserManager Patterns

```typescript
// Always check for existing session before launching
if (this.sessions.has(profileId)) {
  // bring to front instead of launching new
  return
}

// Inject fingerprint on every new page (targetcreated event)
browser.on('targetcreated', async (target) => {
  if (target.type() === 'page') {
    const page = await target.page()
    if (page) await this.injector.injectAll(page, fingerprint)
  }
})

// Clean up sessions on disconnect
browser.on('disconnected', () => this.sessions.delete(profileId))
```

---

## Adding a New Fingerprint Script

1. Create `src/main/fingerprint/scripts/myfeature.ts`:
```typescript
import type { MyConfig } from '../../../shared/types'

export function buildMyFeatureScript(config: MyConfig): string {
  if (!config.enabled) return ''  // return empty string = no injection
  return `
(function() {
  'use strict';
  // override goes here — use IIFE to avoid polluting global scope
  const origMethod = SomeAPI.prototype.method
  SomeAPI.prototype.method = function() {
    // spoof
    return origMethod.apply(this, arguments)
  }
})();
`
}
```

2. Import and call in `src/main/fingerprint/injector.ts`:
```typescript
import { buildMyFeatureScript } from './scripts/myfeature'

// Inside injectAll():
const scripts = [
  // ... existing scripts
  buildMyFeatureScript(fp.myfeature),
].filter(Boolean)
```

3. Add `myfeature` field to `FingerprintConfig` in `src/shared/types.ts`
4. Add to each preset in `presets.ts`

---

## Error Handling in IPC
```typescript
// ipcMain handlers can throw — errors are automatically forwarded to renderer
ipcMain.handle('profiles:launch', async (_event, id) => {
  // throwing here will reject the promise in renderer
  throw new Error('Chrome not found')
})

// Renderer catches it:
try {
  await window.api.profiles.launch(id)
} catch (e: any) {
  alert(e.message)
}
```

---

## Critical: ELECTRON_RUN_AS_NODE
Claude Code sets `ELECTRON_RUN_AS_NODE=1`. Always run via `npm run dev` which uses
`scripts/dev.js` to delete this env var. Never call `electron-vite dev` directly.
