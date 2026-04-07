# PatchManager Navigation — Feature Checklist & Implementation Plan

Generated: 2026-04-07

---

## Status Legend
- ✅ Done — fully implemented
- ⚠️ Partial — types/backend only, UI missing (or vice versa)
- 🔨 In Progress — currently being built
- ⬜ Planned — scoped and ready
- 💡 Backlog — identified, not yet scoped

---

## Current State Summary

| Layer | Component | Status |
|-------|-----------|--------|
| Type definitions (`shared/types.ts`) | ChromiumPatch, ChromiumPatchStatus | ✅ |
| Patch catalog (`chromium-patches.ts`) | 35 patches (22 active, 13 requires build) | ✅ |
| IPC handlers | `patches:status`, `patches:list`, `patches:getByCategory` | ✅ |
| Preload API | `window.api.patches.*` | ✅ |
| UI component | `PatchManager/index.tsx` — read-only dashboard | ✅ |
| App navigation | Sidebar + App.tsx router | ✅ |
| Fingerprint integration | PatchManager → injector.ts pipeline | ❌ |
| Per-profile patch config | DB persistence + profile-level overrides | ❌ |
| Toggle/control system | Enable/disable patches from UI | ❌ |

---

## Phase P1 — Interactive Patch Controls (UI + IPC)

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| P1-1 | Toggle switch per patch row (enable/disable) | ⬜ Planned | P0 | Read-only currently; needs controlled state |
| P1-2 | `patches:toggle` IPC handler in handlers.ts | ⬜ Planned | P0 | Backend to flip `active` flag on a patch |
| P1-3 | Persist enabled/disabled state to database | ⬜ Planned | P0 | New table `patch_overrides(patch_id, active)` |
| P1-4 | Load saved state on app start via `patches:status` | ⬜ Planned | P0 | Merge DB overrides with catalog defaults |
| P1-5 | Optimistic UI update on toggle with error rollback | ⬜ Planned | P1 | Don't wait for IPC round-trip for responsiveness |
| P1-6 | Disable toggle for `requires-build` patches (lock UI) | ⬜ Planned | P1 | Show tooltip: "Requires custom Chromium build" |
| P1-7 | "Reset to defaults" button (restore catalog defaults) | ⬜ Planned | P2 | Global reset action |

---

## Phase P2 — Search & Filter Enhancements

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| P2-1 | Full-text search box across patch name + description | ⬜ Planned | P0 | Client-side filter; no IPC needed |
| P2-2 | Level filter (JS Shim / CDP Override / Requires Build) | ⬜ Planned | P0 | Complement the existing category filter |
| P2-3 | Status filter (Active / Inactive / All) | ⬜ Planned | P1 | Quick view of disabled patches |
| P2-4 | Impact filter (Low / Medium / High) | ⬜ Planned | P2 | Sort/filter by protection importance |
| P2-5 | Combined filter URL/state persistence (survives re-render) | ⬜ Planned | P2 | Store in Zustand or local component state |
| P2-6 | "Show only active" quick toggle chip | ⬜ Planned | P2 | One-click shortcut for common filter |

---

## Phase P3 — Per-Profile Patch Configuration

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| P3-1 | Extend `FingerprintConfig` with `disabledPatches?: string[]` | ⬜ Planned | P0 | In `shared/types.ts` |
| P3-2 | `patches:updateForProfile` IPC handler | ⬜ Planned | P0 | Saves per-profile patch overrides |
| P3-3 | `profile_patches` table in DB schema | ⬜ Planned | P0 | `(profile_id, patch_id, active)` |
| P3-4 | Profile-context patch view in PatchManager | ⬜ Planned | P1 | Show selected profile's active patches |
| P3-5 | Profile dropdown selector inside PatchManager | ⬜ Planned | P1 | Switch profile context without leaving the view |
| P3-6 | "Apply to all profiles" bulk action | ⬜ Planned | P2 | Promote global config to all profiles |
| P3-7 | Patch config shown in profile card/detail view | ⬜ Planned | P2 | Quick summary badge on ProfileManager cards |

---

## Phase P4 — Fingerprint Engine Integration

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| P4-1 | Read `disabledPatches` in `injector.ts` and skip scripts | ⬜ Planned | P0 | Core wiring: PatchManager → actual injection |
| P4-2 | Map patch IDs to script builder functions | ⬜ Planned | P0 | e.g., `'canvas-noise'` → `buildCanvasScript()` |
| P4-3 | Skip CDP override patches when disabled per profile | ⬜ Planned | P1 | Also skip CDP calls in `cdp-evasion.ts` |
| P4-4 | Log which patches were applied per browser launch | ⬜ Planned | P1 | Useful for debugging detection failures |
| P4-5 | Patch application result in detection test output | ⬜ Planned | P2 | Show active patches alongside detection score |
| P4-6 | Patch snapshot saved with profile version | ⬜ Planned | P2 | Extend `profile_versions` table with patch config |

---

## Phase P5 — Patch Detail & Documentation UX

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| P5-1 | Expand technical note inline (already exists, keep) | ✅ Done | — | Collapsible row expansion |
| P5-2 | Impact level color-coded badge (Low=green, Med=amber, High=red) | ⬜ Planned | P0 | Currently text-only; needs color coding |
| P5-3 | Patch detail slide-over / modal | ⬜ Planned | P1 | Full description, links, implementation notes |
| P5-4 | "What does this protect against?" explanation per patch | ⬜ Planned | P1 | Human-friendly threat summary |
| P5-5 | Link to relevant detection test vector from patch row | ⬜ Planned | P2 | e.g., `canvas-noise` → detection vector #6 |
| P5-6 | Patch changelog / version history panel | ⬜ Planned | P3 | Track when patches were added or updated |
| P5-7 | Copy patch ID / technical note to clipboard | ⬜ Planned | P3 | For developer debugging |

---

## Phase P6 — Conflict Detection & Validation

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| P6-1 | Define conflict rules between patch IDs | ⬜ Planned | P1 | e.g., two noise methods on same API |
| P6-2 | Warning banner when conflicting patches both enabled | ⬜ Planned | P1 | Inline alert inside PatchManager |
| P6-3 | Dependency declaration (patch A requires patch B) | ⬜ Planned | P2 | Disable B if A is disabled, with warning |
| P6-4 | "Recommended preset" bundles (Stealth / Balanced / Minimal) | ⬜ Planned | P2 | One-click patch group activation |
| P6-5 | Validate patch config on profile launch | ⬜ Planned | P2 | Warn if risky combination before browser opens |

---

## Phase P7 — Metrics & Monitoring

| # | Feature | Status | Priority | Notes |
|---|---------|--------|----------|-------|
| P7-1 | Coverage % bar in summary (already exists) | ✅ Done | — | Shows active/total ratio |
| P7-2 | Per-category coverage breakdown chart | ⬜ Planned | P1 | Radar or bar chart by category |
| P7-3 | Patch effectiveness score tied to detection results | ⬜ Planned | P2 | Cross-reference detection test scores |
| P7-4 | Audit log entry on patch toggle (who, when, which patch) | ⬜ Planned | P2 | Extend existing `audit_log` table |
| P7-5 | Patch health check — verify script still active post-launch | ⬜ Planned | P3 | Re-evaluate in-page after injection |
| P7-6 | "Patches applied" count shown in profile card | ⬜ Planned | P3 | Quick visibility into profile protection level |

---

## Implementation Order (Recommended)

```
Phase P1 (P0-P1 items) → Phase P4 (P0 items) → Phase P2 (P0 items)
         ↓
Phase P3 (P0-P1 items) → Phase P5 (P0-P1 items)
         ↓
Phase P6 (P1-P2 items) → Phase P7 (P1-P2 items)
```

**Rationale:** Interactive controls (P1) + actual injection wiring (P4) unlock the core value. Search/filter (P2) and per-profile config (P3) follow. Conflict detection (P6) and metrics (P7) are polish.

---

## Database Changes Required

```sql
-- New table: global patch overrides (replaces catalog defaults)
CREATE TABLE IF NOT EXISTS patch_overrides (
  patch_id   TEXT PRIMARY KEY,
  active     INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: per-profile patch overrides
CREATE TABLE IF NOT EXISTS profile_patches (
  profile_id TEXT NOT NULL,
  patch_id   TEXT NOT NULL,
  active     INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (profile_id, patch_id)
);
```

---

## New IPC Channels Required

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `patches:toggle` | renderer → main | `{ patchId, active }` | Toggle global patch active state |
| `patches:reset` | renderer → main | — | Reset all to catalog defaults |
| `patches:updateForProfile` | renderer → main | `{ profileId, patchId, active }` | Per-profile patch override |
| `patches:getForProfile` | renderer → main | `profileId` | Get profile's effective patch list |

---

## Files to Modify / Create

| File | Change |
|------|--------|
| `src/shared/types.ts` | Add `disabledPatches` to `FingerprintConfig` |
| `src/main/fingerprint/chromium-patches.ts` | Add `togglePatch()`, `resetAll()`, `getPatchesForProfile()` |
| `src/main/database.ts` | Add `patch_overrides` and `profile_patches` tables |
| `src/main/ipc/handlers.ts` | Register `patches:toggle`, `patches:reset`, `patches:updateForProfile`, `patches:getForProfile` |
| `src/preload/index.ts` | Expose new IPC channels via `window.api.patches` |
| `src/main/fingerprint/injector.ts` | Read `disabledPatches` to skip injection steps |
| `src/renderer/src/components/PatchManager/index.tsx` | Add toggle switches, search box, level filter, impact color, profile selector |
| `src/renderer/src/stores/` | New `patchStore.ts` (Zustand) — patch state + toggle actions |

---

## Patch ID → Script Builder Mapping (for injector.ts integration)

| Patch ID | Script Builder | File |
|----------|---------------|------|
| `nav-webdriver` | navigator webdriver removal | `navigator.ts` |
| `nav-plugins` | `buildPluginsScript()` | `plugins.ts` |
| `canvas-noise` | `buildCanvasScript()` | `canvas.ts` |
| `webgl-vendor` | `buildWebGLScript()` | `webgl.ts` |
| `audio-noise` | `buildAudioScript()` | `audio.ts` |
| `webrtc-leak` | `buildWebRTCScript()` | `webrtc.ts` |
| `font-whitelist` | `buildFontsScript()` | `fonts.ts` |
| `clientrects-noise` | `buildClientRectsScript()` | `clientrects.ts` |
| `storage-quota` | `buildStorageScript()` | `storage.ts` |
| `network-info` | `buildNetworkScript()` | `network.ts` |
| `behavior-sim` | behavior simulation | `behavior.ts` (Phase 6) |
| `timing-quantize` | `buildPerformanceScript()` | `performance.ts` |
| `uach-spoof` | UACH navigator.userAgentData | `navigator.ts` |
| `webgpu-stub` | WebGPU adapter stub | injector CDP |
| `cdp-ua-override` | CDP Emulation.setUserAgentOverride | `injector.ts` |
| `cdp-timezone` | CDP Emulation.setTimezoneOverride | `injector.ts` |
| `cdp-chrome-runtime` | chrome.runtime stubs | `cdp-evasion.ts` |
| `cdp-error-stack` | Error.stack sanitization | `cdp-evasion.ts` |
| `cdp-worker-nav` | Worker webdriver patch | `cdp-evasion.ts` |
| `cdp-blink-mask` | Blink/Selenium marker deletion | `cdp-evasion.ts` |
| `intl-locale-norm` | Intl locale normalization | `injector.ts` |
| `uach-cdp` | CDP UACH emulation | `injector.ts` |
