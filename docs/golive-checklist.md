# Ghost Browser — Go-Live Checklist

> **Mục đích**: Đánh giá mức độ sẵn sàng của application trước khi launch ra thị trường SEA (Vietnam / Thailand / Indonesia).
>
> **Trạng thái**: ✅ Hoàn thành · 🟡 Cần kiểm tra / hoàn thiện · ❌ Chưa có / cần làm · ⏭️ Defer (không block go-live)

---

## 1. Core Features

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 1.1 | Profile CRUD (tạo / sửa / xoá / clone) | ✅ | Đầy đủ, có bulk ops |
| 1.2 | Isolated Chromium per profile | ✅ | Mỗi profile có userDataDir riêng |
| 1.3 | Profile groups + search | ✅ | Màu sắc, tìm kiếm theo tên/OS/proxy |
| 1.4 | Profile export / import (ZIP) | ✅ | |
| 1.5 | Cookie import / export / live capture | ✅ | JSON + Netscape format |
| 1.6 | Profile version history | ✅ | Max 20 snapshot / profile |
| 1.7 | Profile warm-up | ✅ | Danh sách site tùy chỉnh |
| 1.8 | Fingerprint drift (tự động cập nhật UA theo Chrome binary) | ✅ | |
| 1.9 | Storage inspector (LocalStorage / IndexedDB) | ✅ | Read-only, CDP-backed |
| 1.10 | Fingerprint collision detector | ✅ | Noise-seed + identity-tuple |

---

## 2. Fingerprint Engine

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 2.1 | 22 injection scripts (navigator, canvas, webgl, audio, fonts…) | ✅ | Layer 1 |
| 2.2 | CDP evasion (ẩn automation traces, stack sanitization) | ✅ | Layer 2 |
| 2.3 | Behavior simulation (mouse jitter, typing cadence, scroll) | ✅ | Layer 3 |
| 2.4 | Timing defenses (Date.now, rAF, performance.now) | ✅ | Layer 3 |
| 2.5 | Phase 8 scripts (Intl, WebGPU, UACH, Math FPU) | ✅ | Layer 4 |
| 2.6 | 11 built-in presets (5 desktop + 3 Android + 3 iOS) | ✅ | |
| 2.7 | Geolocation spoofing | ✅ | Per-profile |
| 2.8 | Mobile CDP emulation (viewport + touch) | ✅ | |
| 2.9 | Locale ↔ timezone validation | ✅ | Warning badge khi không khớp |
| 2.10 | Deterministic noise (cùng profile = cùng fingerprint) | ✅ | Seed từ profile UUID |
| 2.11 | Chromium patch catalog (60+ patches) | ✅ | PatchManager UI |
| 2.12 | **Custom Chromium binary** (patches require-build) | ❌ | Không có binary tùy chỉnh — patches ở level `requires-build` không thực sự áp dụng được |

---

## 3. Proxy Manager

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 3.1 | HTTP / HTTPS / SOCKS5 | ✅ | |
| 3.2 | Test proxy + latency + IP check | ✅ | |
| 3.3 | Proxy rotation (none / random / round-robin) | ✅ | |
| 3.4 | SOCKS5 DNS leak prevention | ✅ | `--proxy-dns` flag |
| 3.5 | Bulk import | ✅ | |
| 3.6 | Per-profile proxy assignment | ✅ | |
| 3.7 | **TLS / JA3 rewriting** | ⏭️ | 12.A.3 — deferred, không block go-live |

---

## 4. Detection Testing

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 4.1 | 50 detection vectors (45 fingerprint + 5 network alignment) | ✅ | |
| 4.2 | Score 0–100 với color coding | ✅ | |
| 4.3 | Per-profile + global history | ✅ | |
| 4.4 | Batch run (multi-select profiles) | ✅ | |
| 4.5 | CSV export kết quả | ✅ | |
| 4.6 | Category breakdown chart | ✅ | |
| 4.7 | **Kiểm thử thực tế với các trang anti-bot thực** | 🟡 | Cần verify với creepjs, browserleaks, pixelscan trước launch |

---

## 5. Automation Engine

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 5.1 | 22 action types (navigate, click, type, loop, conditional…) | ✅ | |
| 5.2 | Variable interpolation `{key}` | ✅ | |
| 5.3 | Captcha solving (2captcha / anti-captcha / CapMonster) | ✅ | |
| 5.4 | File upload / download | ✅ | |
| 5.5 | Visual selector recorder | ✅ | Smart selector generation |
| 5.6 | Parallel execution | ✅ | Configurable batch size |
| 5.7 | Workflow scheduling (cron) | ✅ | |
| 5.8 | Run history persistence | ✅ | |
| 5.9 | 6 built-in workflow templates | ✅ | |
| 5.10 | Credential vault integration (`useCredential` action) | ✅ | |
| 5.11 | **Timezone-aware scheduling** | ⏭️ | Hiện chỉ local timezone — defer |

---

## 6. Auth, License & Team

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 6.1 | Login / register / logout / đổi mật khẩu | ✅ | |
| 6.2 | JWT access + refresh tokens | ✅ | |
| 6.3 | 4 license plans (free / starter / professional / enterprise) | ✅ | |
| 6.4 | Machine fingerprint + activation/deactivation | ✅ | |
| 6.5 | Profile creation gated theo plan limit | ✅ | |
| 6.6 | Team workspace, member invites, roles | ✅ | admin/editor/viewer |
| 6.7 | Profile sharing trong team | ✅ | |
| 6.8 | Audit log | ✅ | |
| 6.9 | Cloud sync E2E encryption (AES-256-GCM) | ✅ | |
| 6.10 | **Backend API thực tế** | 🟡 | `api-client.ts` có sẵn nhưng cần endpoint production thực. Không có mock/stub — app sẽ lỗi nếu không có server |
| 6.11 | **Email verification flow** | 🟡 | `resendVerification` IPC có nhưng UI chưa rõ có complete không |
| 6.12 | **Password reset flow** | ❌ | Không thấy IPC handler cho forgot-password / reset-password |
| 6.13 | **License expiry UI + grace period notification** | 🟡 | `license.expiring` webhook event có, nhưng cần kiểm tra in-app notification |

---

## 7. Security

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 7.1 | Credential vault AES-256-GCM + scrypt | ✅ | |
| 7.2 | Vault idle auto-lock (15 phút) | ✅ | |
| 7.3 | Cloud sync E2E encryption | ✅ | |
| 7.4 | HMAC-SHA256 webhook signing | ✅ | |
| 7.5 | Local API server Bearer token auth | ✅ | Optional |
| 7.6 | contextBridge isolation (không expose Node.js trực tiếp) | ✅ | |
| 7.7 | **Electron `nodeIntegration: false`** | 🟡 | Cần verify trong `main/index.ts` — nếu bật là lỗ hổng nghiêm trọng |
| 7.8 | **`webSecurity: true` (CSP)** | 🟡 | Cần verify không bị tắt trong BrowserWindow options |
| 7.9 | **Input validation trên IPC handlers** | 🟡 | Cần audit — IPC nhận dữ liệu từ renderer; SQL injection qua sql.js positional params là an toàn, nhưng cần kiểm tra shell injection trong browser launch args |
| 7.10 | **Secrets không lọt vào log** | 🟡 | Cần kiểm tra `api-client.ts` và `auth.ts` không log token/password |
| 7.11 | **Code signing** (Windows / macOS installer) | ❌ | Chưa thấy cert config trong `electron-builder.yml` — Windows SmartScreen sẽ chặn unsigned app |

---

## 8. UI/UX & Polish

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 8.1 | Dark / light theme | ✅ | |
| 8.2 | Toast notification system | ✅ | |
| 8.3 | Error Boundaries per section | ✅ | |
| 8.4 | Empty state components | ✅ | |
| 8.5 | Keyboard shortcuts (Ctrl+N/F/R) | ✅ | |
| 8.6 | Welcome / onboarding wizard | ✅ | |
| 8.7 | Offline banner | ✅ | |
| 8.8 | Confirm dialog cho destructive actions | ✅ | |
| 8.9 | **Ngôn ngữ giao diện (Vietnamese/Thai/Indonesian i18n)** | ❌ | Hiện tại chỉ English — thị trường SEA target |
| 8.10 | **Loading skeleton / spinner nhất quán** | 🟡 | Cần review — một số section có thể thiếu loading state |
| 8.11 | **Responsive layout** | 🟡 | Desktop app — cần test ở nhiều resolution |
| 8.12 | **Accessibility (a11y)** | 🟡 | Lucide icons + aria labels cơ bản, chưa audit WCAG |

---

## 9. Performance & Stability

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 9.1 | sql.js WASM singleton (async init một lần) | ✅ | |
| 9.2 | Auto-save sau mỗi DB write | ✅ | |
| 9.3 | Chromium fallback khi không tìm thấy binary | ✅ | Typed `CHROMIUM_NOT_FOUND` error |
| 9.4 | Profile version pruning (max 20) | ✅ | |
| 9.5 | **Memory leak khi nhiều profiles chạy đồng thời** | 🟡 | Chưa có stress test — cần kiểm tra `browser-manager.ts` cleanup |
| 9.6 | **DB file size growth** | 🟡 | Detection test results không bị auto-prune — cần kiểm tra giới hạn |
| 9.7 | **App startup time** | 🟡 | WASM init + Electron có thể chậm — cần benchmark |
| 9.8 | **Chromium process cleanup khi app close** | 🟡 | Cần verify không để zombie processes |

---

## 10. Distribution & Deployment

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 10.1 | `electron-builder.yml` config | ✅ | Có file config |
| 10.2 | Windows installer (`dist:win`) | ✅ | Script có sẵn |
| 10.3 | Auto-updater (electron-updater, 4h interval) | ✅ | |
| 10.4 | **macOS build + notarization** | 🟡 | Script chưa thấy `dist:mac` — cần kiểm tra |
| 10.5 | **Windows code signing cert** | ❌ | Chưa có — SmartScreen block người dùng Windows |
| 10.6 | **macOS code signing + notarization** | ❌ | Bắt buộc cho macOS Gatekeeper |
| 10.7 | **Update server / release hosting** | ❌ | Auto-updater cần server hosting releases (S3, GitHub Releases…) |
| 10.8 | **Chromium bundling strategy** | 🟡 | App cần Chromium — puppeteer-core không tự bundle. Cần hướng dẫn hoặc bundle sẵn |

---

## 11. Testing

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 11.1 | TypeScript typecheck sạch (node + web) | ✅ | CI-enforced |
| 11.2 | CI/CD (GitHub Actions) | ✅ | typecheck + test + build |
| 11.3 | Pre-commit hook (husky + lint-staged) | ✅ | |
| 11.4 | Unit tests vitest | 🟡 | Coverage thấp — chủ yếu fingerprint presets |
| 11.5 | **E2E tests** | ❌ | Không có Playwright/Spectron tests |
| 11.6 | **Manual QA checklist trước release** | ❌ | Chưa có documented test plan |
| 11.7 | **Kiểm thử với anti-detect sites thực** (creepjs, pixelscan, browserscan) | ❌ | Bắt buộc trước launch |

---

## 12. AI Assistant (Phase 16)

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 12.1 | NL Workflow Builder (16.A) | ✅ | |
| 12.2 | AI Detection Advisor (16.B) | ✅ | |
| 12.3 | Smart Selector Healing (16.C) | ✅ | |
| 12.4 | Behavior Archetype Library (16.D) | ✅ | 6 archetypes |
| 12.5 | **API key management cho end user** | 🟡 | User cần tự nhập Anthropic API key — cần hướng dẫn rõ trong UI |
| 12.6 | **Rate limiting / cost control** | 🟡 | ~20 calls/session — cần thông báo khi gần hết quota |

---

## 13. Backend & Ecosystem

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 13.1 | REST API server local (port 9222) | ✅ | External automation |
| 13.2 | Webhooks + Telegram integration | ✅ | |
| 13.3 | Remote browser nodes | ✅ | Distributed sessions |
| 13.4 | Workflow marketplace (bundled) | ✅ | JSON catalog |
| 13.5 | **Production backend API server** | ❌ | `api-client.ts` cần server thực — auth, license, team, sync đều không work nếu không có backend |
| 13.6 | **Marketplace CDN** | ⏭️ | Hiện dùng JSON tĩnh — ok cho launch |

---

## 14. Legal & Compliance (SEA Market)

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 14.1 | **Terms of Service** | ❌ | Chưa có trong app |
| 14.2 | **Privacy Policy** | ❌ | Đặc biệt quan trọng: app thu thập machine fingerprint, sync cloud |
| 14.3 | **PDPA (Thailand) / UU ITE (Indonesia) / PDPD (Vietnam) compliance** | ❌ | Luật bảo vệ dữ liệu cá nhân tại SEA |
| 14.4 | **EULA** | ❌ | Cần gắn vào installer |
| 14.5 | **Chính sách hoàn tiền** | ❌ | Cần cho subscription |

---

## 15. Monetization & Business Readiness

| # | Hạng mục | Trạng thái | Ghi chú |
|---|----------|-----------|---------|
| 15.1 | 4 plan tiers trong code | ✅ | free / starter / professional / enterprise |
| 15.2 | **Payment gateway integration** | ❌ | Không thấy trong codebase — Stripe / local payment (MoMo, PromptPay, GoPay) |
| 15.3 | **Subscription management UI** | ❌ | Chỉ có license key activation, không có self-serve upgrade/downgrade |
| 15.4 | **Trial period logic** | 🟡 | Free plan có giới hạn profiles, nhưng cần kiểm tra trial expiry handling |
| 15.5 | **Invoice / billing history** | ❌ | Chưa có |
| 15.6 | **Customer support channel** | ❌ | Không thấy help link / support email trong app |

---

## Tóm tắt — Go/No-Go Assessment

### ✅ Đã hoàn thiện tốt
- Fingerprint engine (22 vectors, CDP evasion, behavior simulation) — **production-grade**
- Profile management với đầy đủ CRUD, bulk ops, versioning
- Automation engine 22 actions + captcha + credentials vault
- Detection testing 50 vectors với scoring rõ ràng
- Team & cloud sync với E2E encryption
- CI/CD và TypeScript typecheck sạch

### 🚨 Blockers (phải làm trước go-live)

| Priority | Item | Lý do block |
|----------|------|------------|
| P0 | **Backend API server production** | Auth/license/sync không work |
| P0 | **Windows code signing cert** | SmartScreen chặn, user sẽ hoàng sợ |
| P0 | **Password reset flow** | Khách hàng bị khóa tài khoản không có cách lấy lại |
| P0 | **Privacy Policy + ToS** | Legal risk, app stores / OS có thể reject |
| P0 | **Payment gateway** | Không thể thu tiền |
| P1 | **Kiểm thử thực tế anti-detect** (creepjs, pixelscan) | Core value proposition phải proven |
| P1 | **Electron security audit** (nodeIntegration, webSecurity, CSP) | Security vulnerability |
| P1 | **Chromium bundling strategy** | Người dùng mới không có Chromium |
| P1 | **Update server / release hosting** | Auto-updater không work nếu không có server |

### ⚠️ Nên làm (không block nhưng ảnh hưởng user experience)

- Vietnamese/Thai/Indonesian i18n (thị trường SEA)
- macOS build + notarization  
- Subscription management UI (tự serve upgrade/downgrade)
- E2E test suite
- Memory/performance stress test khi chạy nhiều profiles
- Customer support channel trong app

### ⏭️ Có thể defer sau launch
- TLS/JA3 rewriting (12.A.3)
- Timezone-aware scheduling
- Marketplace CDN
- Custom Chromium binary (require-build patches)
