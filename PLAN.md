# Ghost Browser — Development Plan

> Last updated: 2026-04-06
> Current phase: **Phase 2 — Hardening** (COMPLETE)

---

## Status Summary

| Area | Done | Remaining |
|------|------|-----------|
| Electron scaffold + IPC | ✅ | — |
| SQLite (sql.js) | ✅ | — |
| Profile Manager (CRUD + launch) | ✅ | — |
| Fingerprint Engine v2 (13 vectors) | ✅ | Plugins, ClientRects, Speech added |
| Proxy Manager (add/delete/test) | ✅ | Rotation (random, round-robin) added |
| Cookie Management | ✅ | Import/export (Netscape + JSON) |
| Profile Import/Export (zip bundle) | ✅ | — |
| Bulk selection (delete, clone) | ✅ | — |
| Fingerprint Editor UI | ✅ | 19/19 vectors spoofed |
| Settings Page | ✅ | Default preset, language, theme, auto-launch |
| Keyboard Shortcuts | ✅ | Ctrl+N/F/R, Enter to launch |
| Auto-updater | ✅ | electron-updater integrated |

---

## Phase 1 — Complete MVP (Week 1–8 → current focus)

### P0 — Must have before calling it MVP

#### 1. Profile: Clone + Edit
- **Clone**: duplicate a profile with a new UUID + fresh fingerprint seed
- **Edit modal**: update name, proxy assignment, notes; optionally re-roll fingerprint preset
- Files: `ProfileCard.tsx` (add Edit button), new `EditProfileModal.tsx`, `handlers.ts` (`profiles:update` already exists)

#### 2. Cookie Management
- DB column `cookies TEXT` already exists in schema
- **Import**: parse Netscape `cookies.txt` format and JSON array format
- **Export**: serialize current cookie jar to both formats
- IPC: `cookies:import(profileId, text, format)` → write to `cookies` column; `cookies:export(profileId, format)` → read + format
- UI: two buttons on ProfileCard overflow menu — "Import Cookies" / "Export Cookies"
- Note: actual cookie injection into Chromium via puppeteer `page.setCookie()` on launch

#### 3. Proxy Test — actually route through proxy
- Current test calls `ip-api.com` from the main process directly, ignoring the proxy
- Fix: use `puppeteer.launch({ args: ['--proxy-server=...'] })` headlessly to hit `ip-api.com/json`; OR use Node `https` with `tunnel`/`socks-proxy-agent` package
- Simplest approach: `socks-proxy-agent` + Node `fetch` with custom dispatcher (undici)

#### 4. Profile Groups (Folders)
- `profile_groups` table already exists in DB
- Add group CRUD to `database.ts` and IPC handlers
- UI: collapsible group sections in ProfileManager; drag profile to group
- Filter/search scoped to group

#### 5. Fingerprint Editor — make it interactive
- Currently shows vector status table (read-only)
- Add per-vector config panel: toggle noise mode, re-roll seed, pick preset
- Save changes via `profiles:update` IPC → persists to DB

---

### P1 — Ship with MVP (nice to have week 8)

#### 6. Auto-updater
- Add `electron-updater` dependency
- Configure `electron-builder.yml` with GitHub Releases as update server
- Main process: check for updates on startup, notify renderer via IPC
- UI: "Update available" banner in Sidebar footer

#### 7. Settings Page
- New nav section: `settings`
- Options: default fingerprint preset, language (en/vi/th/id), theme (dark only for now), auto-launch last session
- Persisted to `app.getPath('userData')/settings.json`

---

## Phase 2 — Hardening (Weeks 9–14)

### Fingerprint Vectors (3 remaining)

| Vector | File | Notes |
|--------|------|-------|
| ClientRects noise | `scripts/clientrects.ts` | `getBoundingClientRect` + `getClientRects` sub-pixel noise |
| Plugin / MimeType list | `scripts/navigator.ts` | Override `navigator.plugins` with realistic Windows/Mac set |
| Speech Synthesis voices | `scripts/speech.ts` | Filter `speechSynthesis.getVoices()` to OS-appropriate subset |

Step-by-step guide in `.claude/commands/fingerprint.md`.

### Proxy Rotation
- Add `rotation_mode: 'none' | 'round-robin' | 'random' | 'sticky'` column to proxies table
- `BrowserManager.pickProxy(profileId)` → selects next proxy based on mode
- UI: rotation mode selector in ProxyManager

### Profile Export / Import Bundle
- Export: ZIP containing `profile.json` (fingerprint + meta) + `cookies.json` + optionally the user-data-dir snapshot
- Import: unzip, create new profile UUID, restore cookies
- Use `archiver` / `yauzl` npm packages

### Bulk Profile Operations
- Checkbox selection mode in ProfileManager grid
- Bulk: Delete, Clone, Assign Proxy, Export

### Keyboard Shortcuts
- `Ctrl+N` → New Profile
- `Ctrl+F` → Focus search
- `Ctrl+R` → Refresh profiles
- `Enter` on selected card → Launch
- Implement via `useEffect` + `keydown` listener in App.tsx

---

## Phase 3 — Monetization + Team (Weeks 15–22)

### Go Backend API
- New repo `ghost-browser-api` (Go + Fiber)
- Endpoints: `/auth`, `/licenses`, `/team`, `/profiles/sync`
- PostgreSQL for user/team data; Cloudflare R2 for encrypted profile bundles

### Licensing
- Stripe integration (Checkout + Webhooks)
- License key tied to machine fingerprint (hash of MAC + CPU ID)
- Plan limits enforced in both Electron main and API
- UI: "Upgrade" prompt when free tier limit hit (5 profiles)

### Team Features
- Workspace: invite by email, RBAC (admin / editor / viewer)
- Shared profile pool: owner assigns read/write per member
- Activity audit log: `who launched what profile at what time`

### Cloud Sync
- E2E encrypted profile backup (AES-256-GCM, key derived from user password)
- Background sync daemon in main process
- Conflict resolution: last-write-wins with version vector

---

## Phase 4 — Advanced (Weeks 23+)

### Custom Chromium Build
- Fork Chromium, patch Canvas `toDataURL`, WebGL `readPixels`, AudioContext at C++ level
- Undetectable by JS introspection (no prototype override traces)
- CI: GitHub Actions self-hosted runner for 6–8 hour Chromium compile

### Automation API
- REST + WebSocket server embedded in Electron main process (local only, port 9222-style)
- Endpoints: `POST /profiles/:id/launch`, `POST /profiles/:id/cookies`, `GET /profiles/:id/screenshot`
- Puppeteer/Playwright compatibility: expose existing CDP endpoint per profile

### Mobile Fingerprint Profiles
- Android Chrome UA + touch events, accelerometer, gyroscope spoofing
- `maxTouchPoints: 5`, `deviceMemory: 4`, portrait screen ratios
- New preset group: `android-chrome-*`

### RPA Builder
- Visual workflow editor (node-based)
- Actions: navigate, click, type, wait, extract, screenshot
- Condition/loop nodes
- Export as Puppeteer script

---

## Immediate Next Steps (this session)

Phase 2 is complete. Next milestone: **Phase 3 — Monetization + Team**

1. **Go Backend API** — `ghost-browser-api` repo (Go + Fiber)
2. **Stripe licensing** — Checkout + Webhooks integration
3. **Team workspaces** — invite, RBAC, shared profiles
4. **Cloud sync** — E2E encrypted profile backup

---

## Detection Testing Checklist (run after each fingerprint change)

- [ ] https://abrahamjuliot.github.io/creepjs/ — target >85% trust score
- [ ] https://browserleaks.com/ — verify each vector panel
- [ ] https://pixelscan.net/ — overall consistency score

Target scores:
- Month 3: >85% undetectability
- Month 6: >92%
- Month 12: >97%
