# Account Section — Feature Checklist & Continuation Plan

> **Scope**: everything reachable from the **Account** sidebar entry. Covers authentication,
> license / plan, machine activation, and cloud sync. Does **not** cover Team workspace
> (separate sidebar entry — see [docs/team-sync.md](team-sync.md)) or the encrypted
> credential vault (Settings page — see Phase 12.C.3).
>
> **Status legend**: ✅ Done · 🟡 Partial · ⏳ Planned · ⏭️ Skipped

---

## 0. Shipped In This Batch (2026-04-07)

The following items from §3 have been implemented and merged into the working tree.
Inventory rows in §1 are updated accordingly.

| # | Item | Files |
|--:|------|-------|
| ✅ A1 | `markPendingChange()` wired into all profile/cookie write paths | [ipc/handlers.ts](../src/main/ipc/handlers.ts) |
| ✅ A2 | Per-user deterministic salt (sha256 of `pepper\|userId`) + legacy decrypt fallback | [sync.ts:9-31](../src/main/sync.ts#L9-L31), [sync.ts:74-84](../src/main/sync.ts#L74-L84) |
| ✅ A3 | Sync daemon refactored to opt-in: `enableSyncDaemon(password)` / `disableSyncDaemon()`; in-memory password, never persisted | [sync.ts:43-44, 196-256](../src/main/sync.ts#L196-L256), preload `sync.daemonEnabled/enableDaemon/disableDaemon` |
| ✅ B3 | License auto-refresh on focus + every 30 min, throttled to 1/min; manual "Refresh" button next to plan tier | [licenseStore.ts:23-58](../src/renderer/src/stores/licenseStore.ts#L23-L58), [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) |
| ✅ C1 | Sync manifest panel (profile count, last modified, version, integrity prefix) with manual refresh; auto-refreshes after push/pull | [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) |
| ✅ D1 | Change password subsection (current / new / confirm + length & match validation) | [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) |
| ✅ D2 | "Forgot password?" link on Sign In tab → external reset URL | [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) |
| ✅ D3 | Show/hide password eye icon + "Remember my email" checkbox (localStorage) | [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) |
| ✅ F1 | Account page widened to `max-w-5xl` + responsive 2-column grid for License & Sync above 1280 px | [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) |
| ✅ F2 | Loading skeletons for License card (initial fetch) and Sync manifest panel | [Account/index.tsx](../src/renderer/src/components/Account/index.tsx), [syncStore.ts](../src/renderer/src/stores/syncStore.ts) |

**Result**: All Phase A (critical bugs / security), Phase D auth hygiene batch, the
sync-manifest XS win, the license-refresh dead-zone fix, and all of Phase F cosmetics
shipped in one pass. Remaining sequence picks up at **B2** (expiry warning + grace
period).

---

## 1. Inventory of Currently Shipped Features

### 1.1 Authentication

| # | Feature | Where | Status |
|--:|---------|-------|--------|
| 1 | Email + password **sign in** | [Account/index.tsx:144-218](../src/renderer/src/components/Account/index.tsx#L144-L218) → [auth.ts:6-15](../src/main/auth.ts#L6-L15) | ✅ |
| 2 | Email + password **registration** (name, email, password) | same | ✅ |
| 3 | **Sign out** with token cleanup | [auth.ts:28-36](../src/main/auth.ts#L28-L36) | ✅ |
| 4 | **Persisted auth tokens** on disk (`auth-tokens.json` in userData) | [api-client.ts:14-39](../src/main/api-client.ts#L14-L39) | ✅ |
| 5 | **Auto access-token refresh** on expiry + on 401 | [api-client.ts:46-114](../src/main/api-client.ts#L46-L114) | ✅ |
| 6 | **Session restore** on app start (`auth:me`) | [authStore.ts:23-31](../src/renderer/src/stores/authStore.ts#L23-L31) | ✅ |
| 7 | `updatePassword` IPC handler + **Change Password UI** (D1) | [auth.ts:53-58](../src/main/auth.ts#L53-L58) | ✅ |
| 8 | Authenticated user header card (avatar circle, name, email, sign-out) | [Account/index.tsx:220-240](../src/renderer/src/components/Account/index.tsx#L220-L240) | ✅ |
| 9 | Login error banner | [Account/index.tsx:167-172](../src/renderer/src/components/Account/index.tsx#L167-L172) | ✅ |

### 1.2 License & Plan

| # | Feature | Where | Status |
|--:|---------|-------|--------|
|  1 | **Plan tier display** with color (free/starter/professional/enterprise) | [Account/index.tsx:11-16](../src/renderer/src/components/Account/index.tsx#L11-L16) | ✅ |
|  2 | **Profile usage bar** (used / max, percentage, colored above 70/90 %) | [Account/index.tsx:255-270](../src/renderer/src/components/Account/index.tsx#L255-L270) | ✅ |
|  3 | **Plan limits** baked into [PLAN_LIMITS](../src/shared/types.ts#L288-L293) (5 / 50 / 500 / unlimited) | [shared/types.ts:288](../src/shared/types.ts#L288) | ✅ |
|  4 | **License activation** by typed key + `Enter` shortcut | [Account/index.tsx:289-308](../src/renderer/src/components/Account/index.tsx#L289-L308) → [license.ts:28-36](../src/main/license.ts#L28-L36) | ✅ |
|  5 | **Deactivate license from this machine** link | [Account/index.tsx:314-321](../src/renderer/src/components/Account/index.tsx#L314-L321) → [license.ts:50-53](../src/main/license.ts#L50-L53) | ✅ |
|  6 | **Machine fingerprint** (sorted MAC list + CPU model → SHA-256) | [license.ts:10-26](../src/main/license.ts#L10-L26) | ✅ |
|  7 | **Free-plan fallback** when no license is loaded | [license.ts:55-66](../src/main/license.ts#L55-L66) | ✅ |
|  8 | **`checkProfileLimit()`** used by both Profile create + multi-import flows | [license.ts:72-84](../src/main/license.ts#L72-L84) | ✅ |
|  9 | **`checkTeamMemberLimit()`** for team enforcement | [license.ts:86-89](../src/main/license.ts#L86-L89) | ✅ |
| 10 | **Valid-until date** display (paid plans) | [Account/index.tsx:272-287](../src/renderer/src/components/Account/index.tsx#L272-L287) | ✅ |
| 11 | License error toast/banner | [Account/index.tsx:309-311](../src/renderer/src/components/Account/index.tsx#L309-L311) | ✅ |

### 1.3 Cloud Sync

| # | Feature | Where | Status |
|--:|---------|-------|--------|
| 1 | **Encrypted push** of all profiles (AES-256-GCM, scrypt-derived key) | [sync.ts:69-105](../src/main/sync.ts#L69-L105) | ✅ |
| 2 | **Encrypted pull** with SHA-256 integrity check | [sync.ts:107-178](../src/main/sync.ts#L107-L178) | ✅ |
| 3 | **Conflict resolution** — local-wins by `updated_at`/`last_used_at`, logged | [sync.ts:131-167](../src/main/sync.ts#L131-L167) | ✅ |
| 4 | **Background sync daemon** (5-min interval, push-on-pending-changes) | [sync.ts:188-215](../src/main/sync.ts#L188-L215) | ✅ |
| 5 | **`markPendingChange()`** API + counter, wired into all profile/cookie write sites (A1) | [sync.ts](../src/main/sync.ts), [ipc/handlers.ts](../src/main/ipc/handlers.ts) | ✅ |
| 6 | **Status broadcast** to renderer via `sync:status` IPC channel | [sync.ts:50-54](../src/main/sync.ts#L50-L54) | ✅ |
| 7 | **Sync status display** (idle/syncing/error/offline/disabled) with color | [Account/index.tsx:18-24, 348-354](../src/renderer/src/components/Account/index.tsx#L18-L24) | ✅ |
| 8 | **Last-synced timestamp** | [Account/index.tsx:356-363](../src/renderer/src/components/Account/index.tsx#L356-L363) | ✅ |
| 9 | **Pending-changes badge** (now increments because (5) is wired) | [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) | ✅ |
| 10 | **Encryption-password input** + manual Push / Pull buttons | [Account/index.tsx:372-403](../src/renderer/src/components/Account/index.tsx#L372-L403) | ✅ |
| 11 | **Plan gate** — Cloud Sync card hidden behind `cloud_sync_enabled` flag | [Account/index.tsx:332-341](../src/renderer/src/components/Account/index.tsx#L332-L341) | ✅ |
| 12 | **Auth gate** — sync requires sign-in | [Account/index.tsx:342-346](../src/renderer/src/components/Account/index.tsx#L342-L346) | ✅ |
| 13 | **Sync manifest** fetch + display panel (C1) | [syncStore.ts](../src/renderer/src/stores/syncStore.ts), [Account/index.tsx](../src/renderer/src/components/Account/index.tsx) | ✅ |

---

## 2. Gap Analysis — What's Missing or Half-Done

These are real holes uncovered while inventorying the section. Each is sized
S/M/L by effort and tagged with the user value it unblocks.

### Authentication

- [ ] **A1.** **Change password UI** — `auth.updatePassword` IPC handler exists, but no
      form anywhere. Users who suspect a leaked password have no in-app remedy. **S**
- [ ] **A2.** **Forgot password / reset** — no flow. Currently a sign-out is the only
      recourse and there's no link to a web reset page. **S** (link out) / **M** (full flow)
- [ ] **A3.** **Email verification status** — backend almost certainly tracks this; we
      don't surface "verified ✓" / "verify your email" anywhere. **S**
- [ ] **A4.** **Account deletion / GDPR export** — required for SEA-region compliance
      (data localization laws coming online in VN/ID). **M**
- [ ] **A5.** **Show password toggle** on the password fields (eye icon). Tiny UX nit
      but every other login form ships it. **XS**
- [ ] **A6.** **Login rate-limit / lockout messaging** — when the API returns 429 we
      show a generic error instead of "Too many attempts, try again in N seconds." **XS**
- [ ] **A7.** **Remember email** — pre-fill the email field from the last successful
      login (the password is never persisted). **XS**
- [ ] **A8.** **Two-factor authentication (TOTP)** — not in the codebase at all. Account
      with cloud-stored profiles deserves 2FA. **L**

### License & Plan

- [ ] **L1.** **No upgrade CTA** — the free-plan card and limit-reached banner contain
      no "Upgrade" button or pricing-page link. The whole monetization funnel is
      inert from inside the app. **S**
- [ ] **L2.** **Plan comparison table** — the Account page only shows the *current*
      plan. Users have nowhere in-app to compare what they'd get for upgrading. **M**
- [ ] **L3.** **License-expiry warning** — no banner appears when `valid_until` is
      within 7 days. Paid users will silently roll back to free. **S**
- [ ] **L4.** **Grace period** — when an active license expires we drop straight to
      free-plan limits. Better: 7-day soft-grace + clear nag. **M**
- [ ] **L5.** **Multi-machine seat usage** — `machine_id` is computed, the API
      probably returns "X / Y machines used", but we don't show it. Important
      because users hit "license already activated on another machine" errors blind. **S**
- [ ] **L6.** **Manage seats / deactivate other machines** — purely client-side today;
      a user who lost a laptop has no way to free that seat from the app. **M**
- [ ] **L7.** **Usage telemetry on detected fingerprint mismatch** — license cache is
      stale until `fetchLicense()` is manually called. After plan upgrade on the
      website, the app keeps showing old limits until restart. **S** — add a
      "Refresh license" button + auto-refetch hourly.
- [ ] **L8.** **Receipt / invoice download** — paid users want to find their last 12
      invoices for accounting. Right now: nowhere in the app. **M**
- [ ] **L9.** **Trial badge** — the system distinguishes plans but not "Trial Pro"
      from "Paid Pro". Trial expiry surprises hurt churn. **S**

### Cloud Sync

- [ ] **S1.** **`markPendingChange()` is dead code** — it's defined but never called
      from any profile/cookie/settings write site. The "5 pending changes" pill in
      the UI will never appear. This is the **biggest single bug** in the section. **S**
- [ ] **S2.** **No selective sync** — push always sends every profile. Users with 500
      profiles waste bandwidth pushing the inactive ones. **M**
- [ ] **S3.** **No "what will be pushed/pulled" preview** — the manifest IPC exists,
      we fetch it, but there's no UI showing local-vs-remote diff before commit.
      Users sync blind. **M**
- [ ] **S4.** **Sync password is typed every time** — the daemon at [sync.ts:208](../src/main/sync.ts#L208)
      auto-pushes using a password that was *never captured anywhere*. The
      daemon will throw on first run. The password should either be cached
      in OS keychain (Phase 12.C.3 vault provides the primitive) or the
      daemon should be disabled until the user "unlocks sync." **M**
- [ ] **S5.** **No conflict UI** — local-wins is silent. A user whose remote is newer
      will never know their changes were skipped. Add a "N skipped — view conflicts"
      drawer. **M**
- [ ] **S6.** **Push diff** — currently sends the entire profile JSON every push.
      Should send only changed profiles since last sync (delta) once the
      pending-change tracker is wired. **L**
- [ ] **S7.** **Pull doesn't sync extensions, vault entries, schedules, automation**
      — only profiles. Cloud sync is misnamed: it's "profile sync." Either rename
      the UI or extend the daemon. **L**
- [ ] **S8.** **Salt is hard-coded** at [sync.ts:11](../src/main/sync.ts#L11) — `'ghost-browser-sync-salt-v1'`.
      Anyone who steals two users' encrypted blobs can amortize an offline
      attack. Should be a per-user random salt fetched from the API at signup. **M**
      ⚠ **Security finding**, not just a UX gap.
- [ ] **S9.** **No "first-time sync" wizard** — typing a 16+ char encryption password
      blind, with no confirm field, into a tiny input is dangerous. A typo on
      *push* permanently bricks the remote bundle. Need confirm-password
      step + zero-knowledge warning copy. **S**
- [ ] **S10.** **Manifest never displayed** — `syncStore.manifest` is fetched and
      stored but no JSX renders it. We have everything we need to show
      "Last cloud snapshot: 12 profiles, 4.2 MB, 2 hours ago" — and nothing does. **XS**
- [ ] **S11.** **No "restore from cloud" wizard for new device** — first-run on a
      new machine should offer "Pull from cloud" instead of starting empty.
      Currently the user has to discover the Cloud Sync card themselves. **M**
- [ ] **S12.** **Sync history** — successful pushes/pulls aren't logged anywhere
      durable. The `sync_log` table exists in [database.ts](../src/main/database.ts) but isn't queried
      from the renderer. Add a "last 20 syncs" panel. **S**

### Cross-cutting

- [ ] **X1.** **Account page max-width is 2xl (672 px)** but the rest of the app uses
      full width. On a 27" monitor the whole page sits in the left third. **XS**
- [ ] **X2.** **Vietnamese / Thai / Indonesian localization** — Account is the
      most-translated surface in any SaaS app, and we ship en-US only. Phase 14.9
      calls this out for the whole app, but Account should lead. **L**
- [ ] **X3.** **No keyboard navigation between Sign In / Create Account tabs** —
      arrow-key tab nav works in the Profile manager but not here. **XS**
- [ ] **X4.** **No loading skeleton** — first paint shows empty cards until
      `fetchLicense()` resolves. **XS**

---

## 3. Continuation Plan — Recommended Order

Slot order is **value-per-effort first, then dependency**. Each slot has a clear
acceptance criterion so "done" is unambiguous and can be ticked off in §1 inventory.

### Phase A — Critical Bugs & Security (must ship before any new feature work)

These are not new features. They are existing features that are broken or
exposed today. Ship as a single batch.

#### A1 — Wire `markPendingChange()` into write paths · **S**

Today's pending-changes counter is dead. Hook `markPendingChange()` into:
- `db.createProfile`, `db.updateProfile`, `db.deleteProfile`
- `db.updateCookies`, `db.saveProfileVersion`
- proxy CRUD if proxies are part of the synced bundle

**Acceptance**: Create a profile → the Account → Cloud Sync card shows "1 pending
changes" within 100ms. Push → counter resets to 0.

**Fixes gap**: S1 (and unblocks S6).

---

#### A2 — Per-user random salt for sync encryption · **M** · ⚠ security

Replace the hard-coded `SCRYPT_SALT` constant with a per-user salt fetched from
the API on first sign-in (or on first push if migrating). Store the salt in the
local DB so the daemon doesn't have to refetch.

**Acceptance**: Two users with the same password produce different ciphertext for
the same plaintext. Existing encrypted bundles still decrypt (migration path:
keep the old salt as a fallback for one minor version).

**Fixes gap**: S8.

---

#### A3 — Fix the daemon password problem · **M**

`startSyncDaemon()` is called with an `encryptionPassword` argument that no
caller currently passes. As written it will throw at every interval. Two
options, in priority order:

1. **Disable the daemon by default**, only start it after the user clicks
   "Enable background sync" (which captures the password into a session-scoped
   variable that lives only in memory).
2. **Reuse the credential vault** (Phase 12.C.3) to optionally persist the
   sync password under the master password.

Ship option 1 now; option 2 is a follow-up under Phase B.

**Acceptance**: No daemon throws on a fresh install. Background sync only runs
after explicit opt-in.

**Fixes gap**: S4.

---

### Phase B — Monetization Funnel

The Account page currently has zero monetization signal. Free users have nowhere
to upgrade from inside the app, paid users have nowhere to renew. This is the
single highest-leverage product investment in the section.

#### B1 — Plan comparison + upgrade CTA · **M**

Add a `<PlanCardGrid>` below the current License card. Pulls live tiers from
`PLAN_LIMITS`, highlights the current plan, and each row has an
**Upgrade →** button that opens the pricing page in the system browser
(`shell.openExternal`) with the user's email pre-filled as a query param.

**Acceptance**: Free user sees a 4-column comparison and can click into the
checkout flow without leaving the app. The currently-active plan is visually
distinct.

**Fixes gaps**: L1, L2.

---

#### B2 — License-expiry warning + grace period · **S+M**

Two parts shipped together:
1. **(S)** Expiry banner: when `valid_until` is within 7 days, show an amber
   banner at the top of the Account page with "Renew now" CTA.
2. **(M)** Backend grace period: when `valid_until` is in the past but within
   7 days, treat the license as still active locally and show a red "Expired"
   banner. After 7 days, fall back to free-plan limits as today.

**Acceptance**: A license expiring tomorrow shows an amber banner. A license
that expired 3 days ago still allows full feature access but shows a red banner.

**Fixes gaps**: L3, L4.

---

#### B3 — Auto-refresh license + manual refresh button · **S**

After the user upgrades on the website, the in-app cache is stale until restart.
Solution:
- Refetch license every 60 minutes from the daemon.
- Add a small "Refresh" icon button next to the plan tier label.

**Acceptance**: Upgrade on the website → click Refresh → tier updates within 1s.

**Fixes gap**: L7.

---

### Phase C — Sync UX

#### C1 — Display the sync manifest · **XS**

The data is already fetched and stored in `syncStore.manifest` but never
rendered. Add a small "Last cloud snapshot" line under "Status" showing
profile count, byte size, and timestamp.

**Acceptance**: After a successful push, the line updates without a manual
refresh.

**Fixes gap**: S10.

---

#### C2 — First-time sync wizard with confirm-password · **S**

Add a `SyncSetupWizard` modal triggered the first time a user clicks Push or
Pull. Two steps:
1. Confirm the encryption password (typed twice, with strength meter)
2. **Zero-knowledge warning**: "If you forget this password, your cloud data
   is permanently unrecoverable. We can never reset it for you."

After completion, store a flag in localStorage so the wizard isn't shown again.

**Acceptance**: Fresh install → first Push opens the wizard. Subsequent pushes
go straight through.

**Fixes gap**: S9.

---

#### C3 — Sync history panel · **S**

Query the existing `sync_log` table from the renderer and render the last 20
syncs as a collapsible panel with direction (push/pull), profile count, status
badge, and timestamp. Add an IPC `sync:history(limit)` handler.

**Acceptance**: After a push, the new entry appears at the top of the list.

**Fixes gap**: S12.

---

#### C4 — Conflict drawer · **M**

When pull skips local-wins conflicts, surface them. Replace the silent
`console.info` at [sync.ts:167](../src/main/sync.ts#L167) with a structured event
list returned to the renderer. Render as a small drawer ("N profiles skipped —
view") and show diff per profile.

**Acceptance**: Two devices edit the same profile → newer wins on push, older
device sees the conflict drawer on next pull.

**Fixes gap**: S5.

---

#### C5 — Selective sync (per-profile opt-out) · **M**

Add a `sync_excluded` boolean column on `profiles`. Show a checkbox in
ProfileCard's menu: "Exclude from cloud sync." `pushProfiles` filters
`sync_excluded = 1` rows out of the bundle.

**Acceptance**: Mark 3 of 50 profiles as excluded → next push contains 47
profiles per the manifest count.

**Fixes gap**: S2.

---

#### C6 — First-run "Restore from cloud" prompt · **M**

On a fresh install, after sign-in succeeds, if the cloud manifest reports
`profile_count > 0` and the local DB has zero profiles, show a "We found N
profiles in your cloud backup — restore?" modal.

**Acceptance**: Fresh install → sign in → see prompt. Decline → never shown
again.

**Fixes gap**: S11.

---

### Phase D — Auth Hardening

#### D1 — Change password form · **S**

Add a "Change password" subsection in the authenticated state of the Auth card.
Three fields: current, new, confirm. Wire to the existing
`auth:updatePassword` IPC handler. Show success toast.

**Acceptance**: Changing password and re-signing-in with the new one works.

**Fixes gap**: A1.

---

#### D2 — Forgot password link · **S**

Add a "Forgot your password?" link below the Sign In tab's password field that
opens `https://ghostbrowser.app/reset?email={email}` via `shell.openExternal`.

**Acceptance**: Click → browser opens to the reset page with the typed email
prefilled.

**Fixes gap**: A2 (link-out variant).

---

#### D3 — Show password toggle + remember email · **XS each**

Two tiny UX wins:
- Eye icon in the password field that toggles `type="text"` ↔ `type="password"`.
- After successful login, persist `lastLoginEmail` to localStorage and prefill
  the email field on next visit.

**Acceptance**: Toggle works. Re-open the app → email field is pre-filled.

**Fixes gaps**: A5, A7.

---

#### D4 — Email verification badge · **S**

Read `auth.user.email_verified` (assume the backend already returns it; if not,
add a `User.email_verified` field). Show a small ✓ badge next to the email if
verified, or an amber "Verify your email" warning with a "Resend" button if not.

**Acceptance**: Unverified user sees the warning. After clicking Resend, the
button enters a 60s cooldown.

**Fixes gap**: A3.

---

### Phase E — Multi-Device & Compliance

These are larger items that should ship after Phase A–D have de-risked the area.

#### E1 — Multi-machine seat dashboard · **M**

Show "Activated machines: 2 / 3" line under the License card, with a
"Manage devices →" button that opens a modal listing each activation by
machine fingerprint, last-seen, and a "Deactivate" button per row.

**Acceptance**: Activating on a 4th machine when limit is 3 returns a clear
error pointing to this dashboard.

**Fixes gaps**: L5, L6.

---

#### E2 — Two-factor authentication (TOTP) · **L**

QR-code enrollment, backup codes, login challenge after sign-in. Belongs in its
own design doc — out of scope for the first iteration of this plan but reserved
here so it doesn't get lost.

**Fixes gap**: A8.

---

#### E3 — Account deletion / GDPR export · **M**

Add an "Advanced" expandable section at the bottom of the page with:
- **Export my data** — POST to `/auth/me/export` and download the JSON dump
- **Delete account** — destructive action behind a typed-confirmation dialog
  ("type DELETE to confirm"); calls `/auth/me` DELETE; signs the user out

**Acceptance**: Both flows work end-to-end against the API. Deletion clears
local tokens, license cache, and userData (with confirmation).

**Fixes gap**: A4.

---

### Phase F — Cosmetics

Grouped together so they can be one PR.

- **F1.** Widen the Account page from `max-w-2xl` to `max-w-4xl` and use a
  responsive 2-column grid above 1280 px. **XS** — fixes X1.
- **F2.** Loading skeletons for License and Cloud Sync cards while their
  initial fetch is in flight. **XS** — fixes X4.
- **F3.** Arrow-key navigation between Sign In / Create Account tabs. **XS** —
  fixes X3.
- **F4.** Vietnamese strings for the entire Account section as the i18n
  pilot. **L** — fixes X2 partially.

---

## 4. Implementation Order — TL;DR

If implementing top-to-bottom, the recommended sequence is:

1. **A1** (pending-changes wiring) — fixes broken UI
2. **A3** (daemon password) — fixes broken daemon
3. **A2** (random salt) — security fix
4. **C1** (manifest display) — XS, instant value
5. **B3** (license refresh) — S, fixes plan-upgrade dead-zone
6. **B2** (expiry warning + grace) — S+M, protects revenue
7. **B1** (upgrade CTA + comparison) — M, monetization funnel
8. **D1, D2, D3** (change password / forgot / UI nits) — auth hygiene batch
9. **C2** (first-time wizard) — protects user data
10. **C3** (sync history) — S, observability
11. **C5** (selective sync) — M, addresses bandwidth
12. **C6** (restore-from-cloud first-run) — M, onboarding win
13. **C4** (conflict drawer) — M, data integrity UX
14. **D4** (email verification) — needs API support
15. **E1** (machine seat dashboard) — needs API support
16. **F1–F4** (cosmetics) — pull whenever
17. **E3** (deletion / export) — compliance
18. **E2** (2FA) — own design doc

**Total**: 4 critical fixes + 6 monetization/UX wins + 4 auth + 6 cloud sync +
4 compliance/cosmetic = ~24 work items.

---

## 5. Out of Scope (intentionally)

- **Team workspace** — has its own sidebar entry and its own continuation
  surface in [docs/team-sync.md](team-sync.md)
- **Credential vault** — lives in Settings, fully shipped in Phase 12.C.3
- **API server / REST endpoints** for account-related actions — those are
  remote concerns documented in the API server plan
- **Backend changes** — the gaps that require API work (per-user salt,
  email-verified field, multi-machine deactivation, account deletion) are
  flagged with **needs API support** but the API itself is owned by the
  backend team

---

## 6. Working Conventions

- Mark items ✅ in **§1 Inventory** when shipped, and tick the corresponding
  gap item in **§2 Gap Analysis**. Do not duplicate the entry in §3 — that
  section is the planning surface, not the source of truth.
- Each shipped slot updates [docs/feature-checklist.md](feature-checklist.md)
  if it touches something tracked there (e.g. Phase 14.x items).
- File-link format: always use markdown `[name](relative-path)` so VS Code's
  link follower works.
