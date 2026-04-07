# Ghost Browser — Documentation

Anti-detect browser platform for the SEA market (Vietnam, Thailand, Indonesia).
Desktop app: **Electron 31 + React 18 + TypeScript**.

## Contents

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | Process architecture, IPC pattern, database schema, file map |
| [fingerprint.md](fingerprint.md) | Fingerprint engine — 18 scripts, CDP evasion, presets, noise determinism |
| [detection.md](detection.md) | Detection test suite — all 45 vectors explained |
| [automation.md](automation.md) | RPA engine — 17 action types, templates, REST API |
| [team-sync.md](team-sync.md) | Team features, cloud sync (AES-256-GCM), licensing |

## Quick Start

```bash
npm install
npm run dev        # dev mode (Electron window)
npm run typecheck  # TypeScript check
npm run build      # production build
npm run dist:win   # Windows installer
```

## Feature Summary

| Category | Count |
|----------|-------|
| Fingerprint presets | 11 |
| Fingerprint scripts (vectors) | 18 |
| CDP evasion methods | 14 |
| Detection test vectors | 45 |
| Automation action types | 17 |
| Built-in workflow templates | 6 |
| Chromium patches (catalog) | 30 (21 active) |
| License plans | 4 (free/starter/pro/enterprise) |

## Phase History

| Version | Phase | Released | Focus |
|---------|-------|----------|-------|
| 0.1.0 | 1 | 2026-04-06 | MVP: profiles, fingerprint engine, proxy manager |
| 0.2.0 | 2 | 2026-04-06 | Settings, auto-updater, keyboard shortcuts, groups, export |
| 0.3.0 | 3 | 2026-04-06 | Auth, licensing, team features, cloud sync |
| 0.4.0 | 4 | 2026-04-06 | Automation API, RPA builder, workflow templates, mobile presets |
| 0.5.0 | 5 | 2026-04-06 | Advanced CDP evasion, detection testing (20 vectors), iOS presets |
| 0.6.0 | 6 | 2026-04-06 | Behavior simulation, timing defenses, profile versioning |
| 0.7.0 | 7 | 2026-04-07 | Batch detection, result management, behavior/timing config UI |
| 0.8.0 | 8 | 2026-04-07 | Chromium patch catalog, Layer 4 scripts, 45 detection vectors |

See [CHANGELOG.md](../CHANGELOG.md) for full details.
