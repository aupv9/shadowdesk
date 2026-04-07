# ShadowDesk — Development Planning

> **Current version:** 0.2.0  
> **Current phase completed:** Phase 12 (all sub-phases 12.A–12.C)  
> **Target:** v1.0.0 Production Release  
> **Market:** SEA — Vietnam, Thailand, Indonesia

---

## Executive Summary

The core platform is feature-complete through Phase 12. The next development cycles focus on:
1. **Phase 13** — Production hardening, performance, onboarding
2. **Phase 14** — Mobile/cloud browser integration
3. **Phase 15** — Marketplace & ecosystem
4. **Phase 16** — AI-assisted automation
5. **v1.0 Release** — Packaging, localization, distribution

---

## Current State Assessment

### Strengths
- 100+ IPC handlers covering all major features
- Clean TypeScript types (655 lines) with zero implicit `any`
- Deterministic fingerprint seeding (same UUID = same fingerprint)
- AES-256-GCM encryption for vault and cloud sync
- Full RPA engine with 22 action types
- Multi-provider captcha solving
- Team collaboration with RBAC + audit log

### Technical Debt / Gaps
| Area | Issue | Priority |
|------|-------|----------|
| FingerprintEditor UI | Live comparison / diff view missing | High |
| Chromium patches (requires-build) | No custom build pipeline | Medium |
| Sync daemon | No real-time visual indicator during sync | Medium |
| Vault UX | Per-step credential picker in automation builder | High |
| Template library | No user-contributed template sharing | Low |
| Error codes | Silent `.catch(() => {})` in non-critical paths | Low |
| Tests | No automated test suite | High |

---

## Phase 13 — Production Hardening (Weeks 55–62)

### 13.A — Test Coverage
**Goal:** Establish baseline test suite before v1.0

**Tasks:**
- [ ] Unit tests for fingerprint scripts (canvas, webgl, audio noise determinism)
- [ ] Unit tests for automation engine (all 22 action types)
- [ ] Unit tests for vault encryption/decryption round-trip
- [ ] Unit tests for cron schedule next-run calculation
- [ ] Integration tests for IPC handler → database round-trips (profiles, proxies, workflows)
- [ ] E2E smoke test: create profile → launch → run detection test → close
- [ ] CI pipeline with Vitest (already in devDependencies)

**Deliverable:** ≥70% coverage on `src/main/` core modules

---

### 13.B — Performance Optimization
**Goal:** Smooth experience with 500+ profiles

**Tasks:**
- [ ] Virtual list rendering in ProfileManager (replace map-over-all with `react-virtual`)
- [ ] Paginate detection test history (currently fetches all rows)
- [ ] Lazy-load StorageInspector (only fetch CDP data on modal open)
- [ ] Profile list search with DB-side LIKE query (not client-side filter)
- [ ] Batch profile export as a streaming ZIP (avoid memory spike)
- [ ] Debounce fingerprint editor changes (500 ms) before re-injecting

**Deliverable:** ProfileManager renders 500 profiles in < 200 ms

---

### 13.C — UX Polish & Onboarding
**Goal:** First-run experience for new users

**Tasks:**
- [ ] Welcome wizard (4 steps): create first profile → pick preset → assign proxy → launch
- [ ] Empty-state illustrations for profiles, proxies, workflows (currently blank)
- [ ] Keyboard shortcuts: `N` new profile, `Space` launch/close, `/` search, `Cmd+,` settings
- [ ] Drag-and-drop profile reordering within group
- [ ] Profile bulk actions: delete, group assign, export (multi-select checkboxes)
- [ ] Tooltip system: hover on every fingerprint vector explains what it does
- [ ] Progress bar for long operations (bulk import, batch detection test)
- [ ] Confirm dialog for destructive actions (delete profile, delete team, account deletion)

---

### 13.D — Fingerprint Editor — Live Preview
**Goal:** Show users their fingerprint before launching

**Tasks:**
- [ ] Side-by-side diff view: current vs. baseline fingerprint
- [ ] "Preview UA string" rendered in real time as user edits preset/OS/version fields
- [ ] Screen resolution visualizer (miniature browser outline)
- [ ] Fingerprint score card: show estimated uniqueness rating (1–100) based on deviation from common profiles
- [ ] Copy fingerprint as JSON button
- [ ] "Randomize all noise seeds" button with preview

---

### 13.E — Error Handling & Resilience
**Goal:** No silent failures

**Tasks:**
- [ ] Replace all silent `.catch(() => {})` with structured error events sent to renderer
- [ ] Toast error messages for: proxy test failure, sync push failure, vault lock timeout, captcha provider down
- [ ] Offline mode detection: disable sync/auth actions with clear "You are offline" notice
- [ ] Browser launch failure modal: show exact puppeteer error + troubleshooting link
- [ ] Database migration rollback on failure
- [ ] Sentry integration (opt-in, GDPR-compliant) for crash reporting

---

## Phase 14 — Cloud & Mobile Integration (Weeks 63–72)

### 14.A — Remote Browser Nodes
**Goal:** Launch profiles on remote headless servers (cloud anti-detect)

**Tasks:**
- [ ] `RemoteBrowserNode` type: hostname, port, auth token, capacity
- [ ] Node health check ping (WebSocket keepalive)
- [ ] Profile launch routing: local vs. remote node selection
- [ ] Node load balancing (least-connected strategy)
- [ ] Remote screenshot proxy through local API server
- [ ] Node manager UI in Settings
- [ ] IPC handlers: `nodes.list`, `nodes.add`, `nodes.remove`, `nodes.test`

**Architecture note:** Remote node runs a lightweight `shadowdesk-agent` (Node.js) exposing a WebSocket API that the desktop app connects to via puppeteer `browserWSEndpoint`.

---

### 14.B — Profile Sync v2 — Real-time
**Goal:** Replace manual push/pull with live sync

**Tasks:**
- [ ] WebSocket connection to sync backend
- [ ] Conflict-free replicated data type (CRDT) for profile metadata
- [ ] Per-field last-write-wins for fingerprint config changes
- [ ] Live sync status badge in Header (green dot / spinning / error)
- [ ] Sync queue with retry + exponential backoff
- [ ] Sync diff viewer redesign: side-by-side JSON diff per profile

---

### 14.C — Mobile Profile Companion App (React Native)
**Goal:** Monitor & control profiles from phone

**Tasks:**
- [ ] React Native app (iOS + Android) with Expo
- [ ] Auth via same backend (JWT)
- [ ] Profile list with status (running / idle / error)
- [ ] Remote launch / close profile
- [ ] View latest detection test score
- [ ] Push notifications: schedule completed, sync error, license expiry

---

### 14.D — Browser Extension Helper
**Goal:** One-click cookie capture from any browser

**Tasks:**
- [ ] Chrome/Firefox extension: captures cookies + localStorage from current tab
- [ ] Sends to local API server (port 9222) via `fetch`
- [ ] Creates/updates profile with captured cookies
- [ ] Shows matching ShadowDesk profile if one exists for current domain
- [ ] Extension store publishing (Chrome Web Store, Firefox Add-ons)

---

## Phase 15 — Marketplace & Ecosystem (Weeks 73–80)

### 15.A — Workflow Marketplace
**Goal:** Share and discover automation scripts

**Tasks:**
- [ ] Backend API: publish workflow, browse by category/tag, download count
- [ ] In-app marketplace tab in AutomationBuilder
- [ ] Workflow rating system (1–5 stars)
- [ ] Version control for published workflows
- [ ] Author profile page (username, published count, total downloads)
- [ ] One-click install → workflow imported into local library
- [ ] Revenue share for premium templates (Stripe integration)

---

### 15.B — Fingerprint Preset Community
**Goal:** User-contributed device presets

**Tasks:**
- [ ] Submit real-device fingerprint snapshot (anonymized)
- [ ] Moderation queue for community presets
- [ ] Preset quality score (rarity, detection resistance)
- [ ] Import community preset by ID or URL
- [ ] Preset expiry (auto-retire when browser version becomes outdated)

---

### 15.C — Third-party Integrations
**Goal:** Connect with popular tools

**Tasks:**
- [ ] **n8n**: Custom ShadowDesk node for workflow execution
- [ ] **Make (Integromat)**: Webhook trigger for profile events
- [ ] **Zapier**: Trigger zaps on profile launch / test score drop
- [ ] **Google Sheets**: Export detection results / profile lists to sheet
- [ ] **Telegram Bot**: Receive alerts (schedule done, profile flagged, license expiry)
- [ ] Webhook system: configurable outbound webhooks per profile event

---

## Phase 16 — AI-Assisted Automation (Weeks 81–90)

### 16.A — Natural Language Workflow Builder
**Goal:** Describe task in plain text → auto-generate workflow steps

**Tasks:**
- [ ] Integrate Claude API (`claude-sonnet-4-6`) as AI engine
- [ ] System prompt optimized for web automation task generation
- [ ] Parse LLM output into `AutomationStep[]` array
- [ ] "Explain step" button: LLM explains what each step does in plain language
- [ ] "Fix step" button: LLM suggests corrections when step fails
- [ ] Context window: include current page HTML snapshot for more accurate selectors

**Implementation note:** Use `anthropic` SDK via IPC (main process only, API key stored in vault).

---

### 16.B — AI Detection Advisor
**Goal:** LLM-powered fingerprint improvement recommendations

**Tasks:**
- [ ] After detection test, send vector scores to Claude API
- [ ] Receive prioritized fix recommendations ("Your WebGL renderer is rare — switch to `ANGLE (Intel...)` common renderer")
- [ ] One-click apply recommendation
- [ ] Explainability panel: why each vector scored low
- [ ] Comparison with "safe baseline" profile (industry-average fingerprint)

---

### 16.C — Smart Selector Healing
**Goal:** Auto-repair broken automation selectors

**Tasks:**
- [ ] On `waitForSelector` timeout, capture page DOM snapshot
- [ ] Send original selector + DOM snapshot to Claude API
- [ ] LLM suggests updated selector
- [ ] Offer: "Update selector automatically"
- [ ] Store selector history for each step

---

### 16.D — Behavior Pattern Library (AI-generated)
**Goal:** Realistic human behavior profiles

**Tasks:**
- [ ] 10 pre-built behavior archetypes: "Casual Browser", "Speed Typer", "Mobile User", etc.
- [ ] AI generates mouse path curves based on target element position
- [ ] Typing cadence models trained on keystroke dynamics datasets
- [ ] Scroll momentum with realistic deceleration physics
- [ ] Idle micro-movements (slight mouse drift while reading)

---

## v1.0.0 Release (Week 91–96)

### Release Checklist

**Localization**
- [ ] Full i18n system (react-i18next) replacing hard-coded English strings
- [ ] Vietnamese (vi) translation — 100% complete
- [ ] Thai (th) translation — 100% complete
- [ ] Indonesian (id) translation — 100% complete
- [ ] English (en) fallback

**Distribution**
- [ ] Windows installer (NSIS) — signed with EV code signing certificate
- [ ] macOS DMG — signed + notarized with Apple Developer ID
- [ ] Linux AppImage + .deb + .rpm
- [ ] Auto-updater channels: stable / beta / nightly
- [ ] Delta updates (partial download on patch releases)

**Security Audit**
- [ ] Third-party penetration test on API server (port 9222)
- [ ] Vault encryption peer review
- [ ] Cloud sync E2E encryption audit
- [ ] Electron security checklist: contextIsolation ✅, nodeIntegration: false ✅, sandbox ✅
- [ ] Dependency audit (`npm audit` — zero critical vulnerabilities)

**Documentation**
- [ ] User manual (Vietnamese primary, EN/TH/ID)
- [ ] API reference for local REST API (OpenAPI 3.0 spec)
- [ ] Workflow authoring guide with examples
- [ ] Self-hosting guide for sync backend
- [ ] Video tutorials: getting started, building first automation

**Backend / Infrastructure**
- [ ] Production sync backend deployment (auth, sync, license validation)
- [ ] CDN for auto-update artifacts
- [ ] License server with Stripe billing integration
- [ ] Status page (uptime monitoring)
- [ ] GDPR compliance page + privacy policy

---

## Sprint Planning (Immediate — Next 4 Weeks)

### Sprint 1 (Week 1–2): Foundation for Phase 13

| Task | Owner | Est. |
|------|-------|------|
| Set up Vitest config + first unit tests for `vault.ts` | TBD | 2d |
| Set up Vitest config + tests for `automation.ts` (navigate, click, type) | TBD | 2d |
| Virtual list in ProfileManager | TBD | 1d |
| Empty-state UI for profiles / proxies / workflows | TBD | 1d |
| Welcome wizard (4 steps) | TBD | 2d |
| Confirm dialog component (reusable) | TBD | 0.5d |
| Keyboard shortcuts system | TBD | 1d |

### Sprint 2 (Week 3–4): UX & Error Hardening

| Task | Owner | Est. |
|------|-------|------|
| Replace silent catch blocks with structured error events | TBD | 1d |
| Toast errors for sync / proxy / captcha failures | TBD | 1d |
| Fingerprint Editor — live UA preview | TBD | 2d |
| Fingerprint Editor — uniqueness score card | TBD | 1d |
| Bulk profile actions (multi-select + delete/group/export) | TBD | 2d |
| Profile search via DB LIKE query | TBD | 0.5d |
| Offline mode detection banner | TBD | 0.5d |

---

## Architecture Decisions (Next Phases)

### Remote Browser Node Protocol
```
Desktop App ──WebSocket──▶ shadowdesk-agent (headless server)
                              └─ puppeteer-core ──▶ Chromium
```
- Authentication: HMAC-signed token (shared secret)
- Protocol: JSON-RPC over WebSocket
- Commands: `launch`, `close`, `screenshot`, `evaluate`, `injectFingerprint`

### AI Integration (Phase 16)
```
Renderer ──IPC──▶ Main Process ──HTTP──▶ Anthropic API
                   └─ API key from Vault (never exposed to renderer)
```
- Use `claude-sonnet-4-6` for automation generation (balance speed/quality)
- Use `claude-haiku-4-5` for real-time selector suggestions (low latency)
- Rate limiting: max 20 LLM calls per session (shown in UI)

### i18n Architecture
```
src/
├── i18n/
│   ├── index.ts          # i18next init
│   └── locales/
│       ├── en.json
│       ├── vi.json
│       ├── th.json
│       └── id.json
```
- All UI strings extracted to locale files
- Date/number formatting via `Intl` (already spoofed — use real locale in UI)
- Language stored in settings, applied at startup

---

## KPIs for v1.0

| Metric | Target |
|--------|--------|
| Time to first profile launch | < 2 minutes for new user |
| Detection test score (average) | ≥ 85/100 with any preset |
| Profile launch time | < 3 seconds |
| UI frame rate (ProfileManager, 500 profiles) | ≥ 60 fps |
| Crash-free sessions | ≥ 99.5% |
| Test coverage (main process) | ≥ 70% |
| Supported languages | 4 (EN, VI, TH, ID) |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Chromium update breaks fingerprint vectors | High | High | Pin Chromium version; automated regression tests |
| Detection sites update heuristics | High | Medium | Monthly detection test benchmark; community reporting |
| Apple notarization delays macOS build | Medium | Medium | Apply for notarization 2 weeks before release |
| Sync backend downtime | Low | High | Local-first design; all features work offline |
| LLM API rate limits (Phase 16) | Medium | Low | Queue + retry; show usage counter in UI |
| sql.js WASM incompatibility on new Electron | Low | High | Lock Electron version; test on upgrade |

---

*Created: 2026-04-07 | Next review: 2026-04-21*
