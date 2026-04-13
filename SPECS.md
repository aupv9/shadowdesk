# Ghost Browser — Technical Specifications

> **Project**: Anti-detect browser platform for SEA market (Vietnam, Thailand, Indonesia)  
> **Stack**: Electron 31 + React 18 + TypeScript + electron-vite  
> **Version**: Phase 16 (AI-Assisted Automation)  
> **Last Updated**: 2026-04-13

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Modules](#core-modules)
3. [Database Schema](#database-schema)
4. [API Specifications](#api-specifications)
5. [Security & Encryption](#security--encryption)
6. [Detection Vectors](#detection-vectors)
7. [Automation Engine](#automation-engine)
8. [Performance Requirements](#performance-requirements)
9. [Deployment & Distribution](#deployment--distribution)

---

## System Architecture

### Process Model

```
Electron Main Process (Node.js)
├── App Window (preload.ts context bridge)
├── Browser Manager (puppeteer-core)
└── Background Services
    ├── Sync Daemon (30s tick)
    ├── Schedule Ticker (30s tick)
    ├── Auto-Updater
    └── IPC Handler Registry

React Renderer (Vite dev server / built bundle)
├── UI Components (Layout, Modals, Lists)
├── Zustand Stores (Global state)
├── IPC Bridge (window.api.*)
└── Tailwind CSS (Dark theme)

Local REST API Server
├── Profile CRUD
├── Workflow Runner
├── Browser Control
└── Screenshot/Dev Tools
```

### Communication Layers

| Layer | Mechanism | Direction | Security |
|-------|-----------|-----------|----------|
| Renderer → Main | IPC (preload contextBridge) | Async Promises | Trusted context only |
| Main → Renderer | IPC (ipcMain.handle) | Async Promises | No sensitive data |
| External HTTP | Axios + token auth | Request/Response | HTTPS + JWT refresh |
| Browser Automation | puppeteer-core + CDP | Native protocol | Local socket only |
| Local API Server | Express-like handler | HTTP/JSON | Bearer token optional |

---

## Core Modules

### 1. Profile Management (`src/main/browser-manager.ts`)

**Responsibilities**:
- Launch isolated Chromium instances per profile
- Manage profile user-data directories
- Handle profile lifecycle (create, close, suspend)
- Track active sessions and PID mappings

**Key Methods**:
- `launchProfile(profileId, proxyUrl?, extensionPaths?)`
  - Returns: `{ port: number, pid: number, wsUrl: string }`
  - Errors: `ProfileLaunchError`, `ExtensionError`
- `closeProfile(profileId)` — graceful shutdown with 10s timeout
- `getActiveSessions()` — returns array of `{ profileId, port, launchTime }`
- `suspendProfile(profileId)` — freezes profile process (not implemented in MVP)

**Chromium Flags**:
```bash
--disable-background-networking
--disable-component-extensions-with-background-pages
--disable-component-update
--disable-default-apps
--disable-device-discovery-notifications
--disable-notifications
--disable-office-editing-component-extension
--disable-popup-blocking
--disable-password-manager-reauthentication
--disable-sync
--enable-automation
--no-default-browser-check
```

**User Data Directory Structure**:
```
userData/profiles/
├── <profile-uuid>/
│   ├── Default/
│   │   ├── Cache/
│   │   ├── Code Cache/
│   │   └── ... (Chromium default profile)
│   └── <extension-id>/ (unpacked extensions)
```

### 2. Fingerprint Engine (`src/main/fingerprint/`)

**Injection Pipeline**:

1. **Layer 1 (JS Evaluation)**: `page.evaluateOnNewDocument(combinedScript)`
   - Runs before page script execution
   - Overwrites `navigator`, `screen`, `AudioContext`, etc.

2. **Layer 2 (CDP Override)**: `page.setUserAgent()`, `page.setGeolocation()`, etc.
   - Uses Chrome DevTools Protocol directly
   - Overrides HTTP headers, viewport, timezone

3. **Layer 3 (Advanced Evasion)**: `cdp-evasion.ts`
   - Hides DevTools from detection code
   - Patches `chrome.runtime` stubs
   - Sanitizes stack traces

**Script Modules** (22 total):

| Module | Purpose | Key Technique |
|--------|---------|----------------|
| `navigator.ts` | UA, platform, hardware | Property override |
| `screen.ts` | Resolution, color depth, DPI | Getter trapping |
| `canvas.ts` | 2D fingerprint noise | toDataURL/toBlob poisoning |
| `webgl.ts` | Vendor/renderer override | WebGL2RenderingContext stub |
| `audio.ts` | AudioContext noise | Analyser getByteFrequencyData hook |
| `fonts.ts` | Font whitelist | document.fonts.check whitelist |
| `webrtc.ts` | IP leak prevention | RTCPeerConnection stub |
| `permissions.ts` | Permission spoofing | Permissions.query mock |
| `storage.ts` | Quota defense | StorageEstimate manipulation |
| `network.ts` | Connection type spoofing | NetworkInformation API stub |
| `performance.ts` | Timing sanitization | performance.now() quantization |
| `timing.ts` | Date/RAF clamping | Date.now() + requestAnimationFrame hooks |
| `intl.ts` | Locale normalization | Intl.DateTimeFormat constructor override |
| `useragentdata.ts` | UACH spoofing | navigator.userAgentData mock |
| `webgpu.ts` | API stub | GPU adapter removal |
| `keyboard.ts` | Layout override | Keyboard.getLayoutMap mock |
| `plugins.ts` | Plugin enumeration | navigator.plugins proxy |
| `speech.ts` | Speech API stub | SpeechRecognition prevention |
| `worker.ts` | Worker propagation | Worker constructor hook |
| `iframe.ts` | Cross-iframe sync | postMessage relay |
| `clientrects.ts` | DOM rect noise | getBoundingClientRect noise |
| `native-tostring.ts` | Function.toString override | Hides instrumentation |

**Fingerprint Presets** (11 total):

```typescript
interface FingerprintPreset {
  key: string              // win10-chrome120
  os: 'Windows' | 'macOS' | 'Linux' | 'Android' | 'iOS'
  osVersion: string        // 10, Ventura, 22.04, 13, 17.2
  browser: 'Chrome' | 'Safari'
  browserVersion: string   // 120, 121
  locale: string          // en-US
  timezone: string        // America/New_York
  screen: {
    width: number
    height: number
    colorDepth: 24
    pixelDepth: 24
    dpi: number
  }
  hardware: {
    deviceMemory: number
    hardwareConcurrency: number
    maxTouchPoints: number
  }
  webgl?: { vendor: string; renderer: string }
  mediaDevices?: { audioIn: number; audioOut: number; videoIn: number }
}
```

**Deterministic Noise Generation**:
- Seed = `hash(profile.id + preset.key)`
- Use seed for **all** PRNG calls in same profile
- Result: Same fingerprint across sessions + browser restarts
- Hash function: SHA-256(UUID) → slice(0, 32) as seed source

### 3. Database Layer (`src/main/database.ts`)

**Technology**: sql.js (SQLite in WASM)

**Initialization**:
```typescript
// Async init (WASM load from CDN or bundled)
const db = Database.getInstance()
await db.initialize()

// Then all queries are sync
const profile = db.getProfile(id)
```

**Auto-Save**: Every `db.run()` call triggers `this.save()` to disk at `userData/db.sqlite`

**Transaction Support**:
```typescript
db.exec('BEGIN')
try {
  db.run('INSERT INTO profiles ...')
  db.run('INSERT INTO audit_log ...')
  db.exec('COMMIT')
} catch (e) {
  db.exec('ROLLBACK')
}
```

**Positional Parameters**: Use `?` not `:named`
```typescript
db.run('INSERT INTO profiles (name, user_id) VALUES (?, ?)', [name, userId])
```

### 4. Authentication & Authorization (`src/main/auth.ts`)

**Flow**:

```
1. User registers (email, password)
   → Hash password (scrypt, 16384 iterations)
   → Store in backend

2. User logs in
   → POST /auth/login { email, password }
   ← { accessToken (15m), refreshToken (7d), user }
   → Store tokens in session memory + disk

3. Periodic token refresh
   → POST /auth/refresh { refreshToken }
   ← { accessToken, refreshToken (rotated) }

4. On 401 response
   → Auto-retry with refreshed token
   → Or show "Session expired" error
```

**Token Structure** (JWT):
```typescript
accessToken: {
  iss: 'ghostbrowser.io'
  sub: userId
  exp: now + 15min
  iat: now
  email: user.email
}

refreshToken: {
  iss: 'ghostbrowser.io'
  sub: userId
  exp: now + 7d
  type: 'refresh'
  tokenFamily: uuid  // Detect token reuse attacks
}
```

**Storage**:
- Access token: In-memory (session)
- Refresh token: Secure storage + DB backup
- Logout: Delete from memory + backend revoke

### 5. Cloud Sync (`src/main/sync.ts`)

**Encryption Scheme** (AES-256-GCM):

```
Master Key Derivation:
  masterPassword = user input / stored secret
  salt = random 32 bytes (per user, stored on server)
  key = scrypt(masterPassword, salt, N=2^20, r=8, p=1, dkLen=32)

Per-Profile Encryption:
  iv = random 12 bytes
  tag = computed by GCM
  ciphertext = AES256GCM(key, iv, plaintext, aad=profileId)
  result = { iv (hex), ciphertext (hex), tag (hex) }
```

**Sync Manifest**:
```typescript
interface SyncManifest {
  userId: string
  version: number  // Incremented per push
  profiles: {
    id: string
    checksum: string  // SHA256(JSON.stringify(profile))
    encrypted: boolean
    lastModified: number
    localOnly?: boolean  // opt-out flag
  }[]
  syncedAt: number
}
```

**Conflict Resolution**:
- Local newer (lastModified) → local wins
- Remote newer → remote wins
- Same time → remote wins (server is source of truth)

**Background Sync Daemon** (runs every 30s):
- Check for pending changes
- If pending > 0 and online: `sync.push()`
- Exponential backoff on errors (max 10m)

### 6. Automation Engine (`src/main/automation.ts`)

**Action Types** (28 total):

| Action | Input | Output | Retryable |
|--------|-------|--------|-----------|
| `navigate` | `url` | `{ status, finalUrl }` | Yes |
| `click` | `selector` | `{ ok: boolean }` | Yes |
| `rightClick` | `selector` | `{ ok: boolean }` | Yes |
| `doubleClick` | `selector` | `{ ok: boolean }` | Yes |
| `type` | `selector, text` | `{ typed: number }` | Yes |
| `wait` | `ms` | `{ slept: number }` | No |
| `waitForSelector` | `selector, timeout` | `{ found: boolean }` | Yes |
| `waitForNavigation` | `timeout` | `{ url }` | Yes |
| `scroll` | `selector?, x, y` | `{ scrolled: boolean }` | Yes |
| `hover` | `selector` | `{ ok: boolean }` | Yes |
| `select` | `selector, value` | `{ ok: boolean }` | Yes |
| `keyPress` | `key` | `{ ok: boolean }` | Yes |
| `setAttribute` | `selector, attr, value` | `{ ok: boolean }` | Yes |
| `screenshot` | `filename` | `{ path, size }` | No |
| `extractText` | `selector, transform?` | `{ text }` | Yes |
| `evaluate` | `script, args?` | `{ result: any }` | Yes |
| `httpRequest` | `url, method, headers, body, transform?` | `{ status, body }` | Yes |
| `conditional` | `condition, trueBranch, falseBranch?` | nested execution | N/A |
| `loop` | `count, steps` | executes N times | N/A |
| `solveCaptcha` | `captchaType, provider` | `{ token }` | Yes |
| `injectCaptchaToken` | `selector, token` | `{ ok: boolean }` | Yes |
| `upload` | `selector, filePath` | `{ ok: boolean }` | Yes |
| `download` | `filename, downloadPath` | `{ path, size }` | No |
| `useCredential` | `vaultId, credentialId, action` | `{ injected: boolean }` | Yes |
| `extractJson` | `source, jsonPath, transform?` | `{ value }` | Yes |
| `forEachElement` | `selector, steps` | executes per element | N/A |
| `whileLoop` | `condition, steps, maxIter?` | executes while true | N/A |
| `waitForRequest` | `urlPattern, method?` | `{ url, method, body }` | Yes |
| `waitForResponse` | `urlPattern, statusCode?, transform?` | `{ body, status }` | Yes |

**Transform Pipeline**:

Accepted on: `extractText`, `evaluate`, `httpRequest`, `extractJson`, `waitForResponse`

Operators:
- `trim` — remove whitespace
- `upper` — uppercase
- `lower` — lowercase
- `number` — parse to number
- `length` — get string length
- `jsonPath:$.path.to.field` — JSONPath extraction
- `regex:/pattern/flags` — regex match group 1
- `split:,` — split by delimiter, take index (`:split:,:[1]`)
- `replace:find:with` — string replace (or `replace:re:/pat/:with` for regex)
- `prefix:str` — prepend
- `suffix:str` — append

Example: `"trim|upper|prefix:PREFIX-"` or `["trim", "upper"]`

**Execution Model**:

```typescript
interface WorkflowExecution {
  id: string
  workflowId: string
  profileIds: string[]
  concurrency: number
  status: 'running' | 'paused' | 'completed' | 'error'
  steps: {
    stepId: string
    status: 'pending' | 'running' | 'completed' | 'error'
    retries: number
    lastError?: string
    result?: any
    duration: number
  }[]
  variables: Record<string, any>  // Runtime accumulator
  startedAt: number
  completedAt?: number
}
```

**Variables**:
- User-defined: `{ myVar: 'value' }` → `{myVar}` in steps
- Built-in: `{timestamp}`, `{random}`, `{profileName}`, `{runId}`
- Result capture: Step with `saveTo: 'variableName'` stores result

### 7. Captcha Integration

**Providers**:

| Provider | API Key | Types | Balance API |
|----------|---------|-------|------------|
| 2captcha | `2captcha_key` | reCAPTCHA v2/v3, hCaptcha, image | GET `2captcha.com/api/user` |
| Anticaptcha | `anticaptcha_key` | reCAPTCHA v2/v3, hCaptcha | POST `/api/user/balance` |
| CapMonster | `capmonster_key` | reCAPTCHA v2/v3, hCaptcha | GET `/api/v1/accounts/current` |

**Workflow Integration**:

```typescript
{
  type: 'solveCaptcha',
  captchaType: 'reCAPTCHA_v2',
  provider: 'anticaptcha',
  captchaParams: {
    websiteURL: 'https://example.com',
    websiteKey: '6Le...',
  },
  saveTo: 'captchaToken'
}
```

### 8. License & Plan Limits

**Plans**:

| Plan | Profiles | Max Sessions | Team Members | Cloud Sync | Automation | Detection Tests |
|------|----------|--------------|--------------|-----------|-----------|-----------------|
| Free | 5 | 1 | 1 | No | Basic (5 templates) | 10/month |
| Starter | 50 | 5 | 3 | Yes | Standard (20 actions) | 100/month |
| Professional | 500 | 10 | 10 | Yes | Advanced (all actions) | 1000/month |
| Enterprise | ∞ | ∞ | ∞ | Yes | Custom | ∞ |

**Machine Fingerprint** (for seat binding):
```typescript
// SHA256 hash of:
// - MAC address (primary interface)
// - CPU model + core count
// - Windows ProductId or macOS UUID

// Used to detect license sharing across machines
// Grace period: 7 days post-expiry
```

### 9. Team Features

**Roles & Permissions**:

| Feature | Admin | Editor | Viewer |
|---------|-------|--------|--------|
| Create profiles | ✓ | ✓ | — |
| Delete profiles | ✓ | ✓ (own) | — |
| Share profiles | ✓ | — | — |
| Invite members | ✓ | — | — |
| Remove members | ✓ | — | — |
| View audit log | ✓ | ✓ | ✓ |

**Audit Log** (per action):
```typescript
{
  id: uuid
  teamId: string
  userId: string
  userName: string
  action: 'launch' | 'create' | 'delete' | 'export' | 'sync' | 'invite' | 'remove'
  targetId?: string      // profile, team, member
  targetName?: string
  ipAddress: string
  timestamp: number
}
```

---

## Database Schema

### profiles
```sql
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  group_id TEXT,
  fingerprint TEXT NOT NULL,  -- JSON string
  proxy_id TEXT,
  cookies TEXT,              -- JSON string
  notes TEXT,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  user_data_path TEXT,
  status TEXT DEFAULT 'inactive',
  extensions TEXT,           -- JSON array of extension paths
  warm_up_completed BOOLEAN DEFAULT 0,
  warm_up_list TEXT,         -- JSON array of URLs
  drift_detection BOOLEAN DEFAULT 1,
  last_drift_at INTEGER,
  local_only BOOLEAN DEFAULT 0,  -- opt-out of cloud sync
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### proxies
```sql
CREATE TABLE proxies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,     -- HTTP, HTTPS, SOCKS5
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT,
  country TEXT,
  latency_ms INTEGER,
  is_healthy BOOLEAN DEFAULT 0,
  last_checked_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### workflows
```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  steps TEXT NOT NULL,       -- JSON array
  variables TEXT,            -- JSON object
  template_id TEXT,          -- null if custom
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### workflow_executions
```sql
CREATE TABLE workflow_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  profile_ids TEXT NOT NULL, -- JSON array
  status TEXT DEFAULT 'running',
  steps_result TEXT,         -- JSON object
  variables TEXT,            -- JSON runtime variables
  concurrency INTEGER DEFAULT 1,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
)
```

### profile_versions
```sql
CREATE TABLE profile_versions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL, -- JSON
  label TEXT,
  saved_at INTEGER NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id),
  UNIQUE (profile_id, label)  -- max 20 per profile
)
```

### detection_tests
```sql
CREATE TABLE detection_tests (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  profile_name TEXT,
  tested_at INTEGER NOT NULL,
  overall_score INTEGER,  -- 0-100
  vectors TEXT NOT NULL,  -- JSON array of { vector, status, score }
  status TEXT DEFAULT 'completed',
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
)
```

### audit_log
```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  target_name TEXT,
  ip_address TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### sync_log
```sql
CREATE TABLE sync_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  direction TEXT,        -- push, pull
  profile_count INTEGER,
  status TEXT,          -- success, error
  synced_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### credentials
```sql
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vault_encrypted BOOLEAN DEFAULT 1,
  data_encrypted TEXT,   -- JSON { iv, ciphertext, tag }
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

---

## API Specifications

### REST Endpoints

**Base URL**: Backend: `https://api.ghostbrowser.io/v1`  
Local API: `http://localhost:9222` (Electron app)

**Authentication**: Bearer token in `Authorization: Bearer <accessToken>`

#### Profiles

| Method | Path | Auth | Params | Response |
|--------|------|------|--------|----------|
| GET | `/profiles` | ✓ | limit, offset, groupId? | `{ profiles: [], total }` |
| POST | `/profiles` | ✓ | body: ProfileInput | `{ profile }` |
| GET | `/profiles/:id` | ✓ | — | `{ profile }` |
| PUT | `/profiles/:id` | ✓ | body: ProfileInput | `{ profile }` |
| DELETE | `/profiles/:id` | ✓ | — | `{ ok }` |
| POST | `/profiles/:id/launch` | ✓ | body: { proxyId?, extensions? } | `{ port, wsUrl, pid }` |
| POST | `/profiles/:id/close` | ✓ | — | `{ ok }` |
| GET | `/profiles/active-sessions` | ✓ | — | `{ sessions: [...] }` |

#### Workflows

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/workflows` | ✓ | `{ workflows: [] }` |
| POST | `/workflows` | ✓ | `{ workflow }` |
| POST | `/workflows/:id/run` | ✓ | `{ executionId }` (202 Accepted) |
| GET | `/workflows/:id/runs/last` | ✓ | `{ execution }` |
| GET | `/workflows/:id/runs/export` | ✓ | CSV/JSON stream |

#### Detection Tests

| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | `/profiles/:id/detection-test` | ✓ | `{ testId }` (async, 202) |
| GET | `/detection-tests/:id` | ✓ | `{ test }` |
| GET | `/profiles/:id/detection-tests` | ✓ | `{ tests: [] }` |

#### Captcha

| Method | Path | Auth | Body | Response |
|--------|------|------|------|----------|
| POST | `/captcha/balance` | ✓ | `{ provider }` | `{ balance: number, currency }` |
| POST | `/captcha/solve` | ✓ | `{ provider, type, params }` | `{ taskId: string }` |

---

## Security & Encryption

### Password Storage

```typescript
// Scrypt hashing (16384 iterations, r=8, p=1)
const salt = crypto.randomBytes(32)
const hash = crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })
// Store: { hash, salt } in user record
```

### Credential Vault

```typescript
// Master password-derived key
const masterKey = crypto.scryptSync(
  masterPassword,
  userSalt,
  32,
  { N: 2**20, r: 8, p: 1 }
)

// Per-credential encryption
const iv = crypto.randomBytes(12)
const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv)
const ciphertext = cipher.update(credentialJSON, 'utf8', 'hex') + cipher.final('hex')
const tag = cipher.getAuthTag()

// Vault unlocked state persists for 5 minutes, then locks
```

### CORS & CSP

**Renderer process CSP** (embedded in preload):
```
script-src 'self'
style-src 'self' 'unsafe-inline' (Tailwind)
img-src 'self' data: https:
font-src 'self'
connect-src 'self' https://api.ghostbrowser.io wss://sync.ghostbrowser.io
```

---

## Detection Vectors

### Layer 1: JS Execution (22 vectors)

**Passed**: All 22 vectors spoofed via JS injection

### Layer 2: CDP / DevTools Protocol (12 vectors)

- User-Agent header override
- Viewport + device metrics
- Timezone + locale override
- Geolocation mock
- Media feature override
- Permissions mock
- Feature detection override

### Layer 3: Advanced Evasion (8 vectors)

- `chrome.runtime` stub (hides automation detection)
- Stack trace sanitization (removes `evaluateOnNewDocument` mention)
- WebDriver detection bypass
- Phantom.js detection bypass
- Headless detection bypass
- V8 debugging protocol hiding
- Process.type hiding
- `__proto__` chain inspection bypass

### Layer 4: Chromium Patches (Planned Phase 8)

- C++ source patches for renderer process
- Native MathFPU normalization
- ProtoChain inspection hiding
- TrustTokens API override
- MediaCapabilities normalization

**Total: 45+ vectors per profile**

---

## Automation Engine

### Execution Flow

```
1. User triggers workflow execution
2. For each profile in profileIds:
   a. Launch profile (if not running)
   b. Connect to CDP port
   c. For each step:
      i. Resolve variables: {myVar} → value
      ii. Execute action
      iii. Capture result
      iv. On error: retry (if retryable && retries < max)
      v. Save variables if saveTo specified
   d. Close profile (if not persistent)
3. Stream execution progress to UI
4. Store execution history in DB
```

### Retry Logic

- Retryable actions: navigate, click, type, wait*, extract*, http*, solve*, inject*
- Non-retryable: wait (fixed delay), screenshot, download
- Retry config: `maxRetries?: number` (default 3), `delayMs?: number` (default 1000ms)
- Backoff: linear (1s, 2s, 3s, ...)

### Variable Interpolation

```typescript
// In step text: "Hello {myVar} and {timestamp}"
// myVar = 'World', timestamp = 1680000000
// Result: "Hello World and 1680000000"

// Supported in: click selector, type text, navigate URL, httpRequest body/headers
```

---

## Performance Requirements

### Target Metrics

| Metric | Target | Current |
|--------|--------|---------|
| App startup time | < 3s | ~2s (depends on DB size) |
| Profile launch | < 5s | ~3-4s (Chromium start) |
| Fingerprint injection | < 500ms | ~50ms |
| Single step execution | < 2s (network dependent) | ~1-2s |
| 10-profile batch workflow | < 30s (serial) | ~25s |
| DB query (indexed) | < 10ms | ~1-5ms |
| Sync push (100 profiles) | < 10s | ~8s (network dependent) |

### Memory Targets

- Idle app: < 150MB
- Per launched profile: + 200-300MB (Chromium footprint)
- Max concurrent profiles: 5 (default), configurable
- DB (1000 profiles): ~50MB

### Database Size Limits

- sql.js max: ~50MB file size recommended
- Cleanup strategy: Archive old execution history, delete old sync logs (>30 days)

---

## Deployment & Distribution

### Build Artifacts

```bash
npm run build         # Compile TS + React

npm run dist:win      # Windows NSIS installer (.exe)
npm run dist:mac      # macOS DMG (.dmg)
npm run dist:linux    # Linux AppImage (.AppImage)
```

### Code Signing

**Windows**: Sign .exe with code signing certificate  
**macOS**: Notarize .dmg with Apple ID  
**Linux**: AppImage is unsigned (auto-update checks signature)

### Auto-Update

- Electron app fetches update manifest from `https://releases.ghostbrowser.io/latest.json`
- If newer version found: download, verify hash, prompt user
- User approves → download installer + restart
- If closed without approval: prompt again next session

### Environment Variables

```bash
# Backend API
VITE_API_URL=https://api.ghostbrowser.io/v1

# Sync server WebSocket
VITE_SYNC_WS_URL=wss://sync.ghostbrowser.io

# Local API server port
LOCAL_API_PORT=9222

# Chromium binary path (auto-detect if not set)
CHROMIUM_BIN=/path/to/chromium

# Log level
LOG_LEVEL=info
```

---

*Generated: 2026-04-13*  
*Phase 16 (AI-Assisted Automation)*
