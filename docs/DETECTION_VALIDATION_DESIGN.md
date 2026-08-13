# ShadowDesk — Detection Validation Design

**Version 1.1** | **Date:** 2026-08-13 | **Status:** Phases A–C implemented; D–E outstanding

> **Landed:** severity model and weighted scoring, guarded vector runner, dual
> scores, the coherence engine (R1–R14), and the WAF canary with
> fingerprint-vs-IP attribution.
>
> **Outstanding:** Layer 2 external probes (Phase D) and the reporting work in
> Phase E beyond the dual-score gauges already in the dashboard.
>
> **Not yet exercised against a live browser.** The rules, classifier,
> attribution and persistence are unit-tested, but the collectors
> (`coherence-collector.ts`) and `runCanary` have only been typechecked. In
> particular, if `collectWorker`/`collectIframe` return null in practice, R3
> and R4 will report `unavailable` rather than actually comparing realms.

> Supersedes the framing in `DETECTION_ANALYSIS.md` and `DETECTION_SCORECARD.md`.
> Those documents grade the existing suite as "production ready" against the
> question *does the injection engine work*. That is a real question and the
> suite answers it well. It is not the question users think the score answers.

---

## Executive summary

`detection-test.ts` runs 45+ vectors and reports a 0–100 score that the UI
labels "less detectable". The number cannot support that claim, because no
detector participates in producing it. The suite navigates to `about:blank`
and asks the page whether ShadowDesk's own overrides are present.

This document keeps that suite — renamed to what it measures — and adds three
layers that produce evidence a real anti-bot system would recognise:

| Layer | Question answered | Network | Rots |
|---|---|---|---|
| **0. Injection integrity** (existing) | Did my overrides apply? | No | No |
| **1. Coherence engine** (new) | Do my values contradict each other? | No | No |
| **2. External probes** (new) | What do public fingerprint testers say? | Yes | Yes |
| **3. WAF canary** (new) | Does a real WAF challenge me? | Yes | No |

Layer 1 is the highest-value work: offline, deterministic, no maintenance
burden, and it targets the failure mode that actually gets accounts banned.

---

## Problem statement

Four structural defects, in order of severity.

### 1. The test is a tautology

```ts
// detection-test.ts:196
const result = await page.evaluate(() =>
  typeof window.chrome !== 'undefined' && typeof window.chrome.runtime !== 'undefined')
```

`chrome.runtime` exists because `cdp-evasion.ts` created it moments earlier.
The vector asks the injector to confirm its own work.

Only **9 vectors** hunt for an artifact the injector did not itself produce —
`navigator.webdriver`, headless signals, ChromeDriver/Selenium variables, error
stack traces, `Function.toString` masking, prototype-chain integrity, the
worker `webdriver` check, and the `defineProperty` descriptor check. The
remaining majority confirm that an override landed. Those are useful as
**regression tests for the engine** and worthless as **evidence about
detectability**.

### 2. No detector ever runs

```ts
// detection-test.ts:94
await page.goto('about:blank', { waitUntil: 'load' })
```

CreepJS, Cloudflare and DataDome work by *correlating* signals and by probing
for tampering (`Function.toString` patching, proto-chain gaps, worker/main
divergence). None of that machinery executes on `about:blank`.

### 3. Every vector weighs the same

```ts
// detection-test.ts:54
const overallScore = Math.round((passedCount / vectors.length) * 100)
```

`navigator.plugins.length > 0` counts exactly as much as
`navigator.webdriver === false`. A profile that leaks WebDriver and passes the
other 44 vectors scores **97/100 and is labelled "passed"**.

### 4. Coherence checking is one line deep

`browser-vectors.ts:162` compares the UA string to `navigator.vendor`. Nothing
compares the UA's claimed OS against the WebGL renderer, the timezone against
the proxy's geo-IP, or the worker context's fingerprint against the main
thread's. A profile advertising Windows while WebGL reports `Apple M2` passes
today.

> **Partial credit where due:** a `Worker navigator.webdriver` vector already
> exists (`detection-test.ts:563`) and checks that one property inside a
> worker. It does not compare UA, platform, `hardwareConcurrency`,
> `deviceMemory` or `languages` across contexts.

---

## Design

### Cross-cutting change A — severity, not headcount

```ts
export type VectorSeverity = 'fatal' | 'high' | 'medium' | 'low'
export type VectorSource   = 'injection' | 'coherence' | 'probe' | 'canary'
export type VectorStatus   = 'pass' | 'fail' | 'unavailable'

export interface DetectionVectorResult {
  name: string
  category: string
  passed: boolean            // retained for back-compat with stored rows
  detail?: string
  severity: VectorSeverity   // new
  source: VectorSource       // new
  status: VectorStatus       // new — 'unavailable' never counts against a score
}
```

Scoring rules:

- Any `fatal` failure ⇒ report status is `failed`, whatever the arithmetic says.
- Weighted mean over the rest: fatal 10, high 5, medium 2, low 1.
- `unavailable` vectors are excluded from both numerator and denominator, and
  surfaced separately as a maintenance warning.

### Cross-cutting change B — two scores, never one

| Score | Source layers | Meaning |
|---|---|---|
| **Injection integrity** | 0 | Is the engine working on this profile? |
| **Detection risk** | 1 + 2 + 3 | Would a real site flag this profile? |

Merging them is what makes today's number misleading. The dashboard shows both,
and only "detection risk" is allowed near customer-facing material.

### Cross-cutting change C — attribute fingerprint vs IP

Layer 2 and 3 verdicts depend on IP reputation as much as on the fingerprint.
A datacenter proxy fails with a flawless fingerprint. Every Layer 2/3 result is
therefore keyed on **(profile × proxy)**, and the report states which variable
is implicated: run the same profile through a second proxy, and if one passes,
the finding belongs to the IP. Without this, users will tune fingerprints to
fix an IP problem.

---

### Layer 1 — Coherence engine

New module `src/main/fingerprint/coherence.ts`. Pure comparison logic over four
data sources, no network:

- **D** — declared `FingerprintConfig` from the DB
- **M** — live values from `page.evaluate()` on the main thread
- **W** — live values from a `Worker` (via blob URL, as the existing worker vector does)
- **F** — live values from a same-origin `iframe`
- **P** — proxy geo-IP (extend the `ip-api.com` call already in `browser-manager.testProxy`)

| # | Rule | Sources | Severity |
|---|---|---|---|
| R1 | UA OS token ↔ `navigator.platform` ↔ UA-CH `platform` | M | fatal |
| R2 | UA OS ↔ WebGL `UNMASKED_VENDOR/RENDERER` (Windows UA + Apple GPU) | M | fatal |
| R3 | Worker parity: UA, platform, `hardwareConcurrency`, `deviceMemory`, `languages` | M vs W | fatal |
| R4 | Iframe parity: same property set | M vs F | fatal |
| R5 | WebRTC candidates expose no non-proxy public IP | M, P | fatal |
| R6 | `timeZone` ↔ `Intl.resolvedOptions().timeZone` ↔ proxy geo-IP timezone | D, M, P | high |
| R7 | `navigator.language` ↔ `languages[0]` ↔ `Intl` locale ↔ `Accept-Language` | D, M | high |
| R8 | Screen `width/height/avail*` ↔ `devicePixelRatio` ↔ declared device class | D, M | high |
| R9 | `maxTouchPoints` ↔ `ontouchstart` ↔ `pointer`/`hover` media queries ↔ device class | D, M | high |
| R10 | Chrome major in UA ↔ UA-CH brands ↔ real binary version ↔ presence of version-gated APIs | D, M | high |
| R11 | **Render stability**: canvas/WebGL/audio hashes identical across two launches of one profile | M ×2 | high |
| R12 | **Render uniqueness**: those hashes differ from every other profile's | M, DB | high |
| R13 | `deviceMemory`/`hardwareConcurrency` plausible for the declared device | D | medium |
| R14 | Font whitelist contains the OS-exclusive families implied by the declared OS | D, M | medium |

R11 and R12 deserve emphasis. `CLAUDE.md` states as an invariant that the same
profile yields the same fingerprint across sessions and that seeds are
per-profile. **Nothing currently verifies either.** `collision-detector.ts`
compares stored *config*, not rendered *output* — two profiles can hold
different configs and still paint an identical canvas. R11/R12 test the
invariant where it matters, at the pixel.

Each rule is a pure function so it unit-tests without a browser:

```ts
export interface CoherenceRule {
  id: string
  severity: VectorSeverity
  evaluate(ctx: CoherenceContext): { passed: boolean; detail: string }
}
```

Tests construct deliberately contradictory contexts (Windows UA + `MacIntel`
platform) and assert the rule fires — the inverse of today's suite, which can
only assert that agreement is detected.

---

### Layer 2 — External probes

Navigate real fingerprint testers and read their verdict. Highest value:
**CreepJS**, because it specifically hunts for tampering — the exact class of
defect Layer 0 is blind to. Then `bot.sannysoft.com` (stable table markup),
`browserleaks.com` (raw hashes, useful for R11/R12 corroboration), and one
aggregate verdict site.

These *will* break when the targets change layout. The SEA workflow templates
already demonstrate the failure mode: selectors verified against saved fixtures
stay green while the live site has moved on. Mitigations, all mandatory:

1. **Data-driven manifest**, versioned, in `src/main/detection/probes.json` —
   no selectors compiled into TypeScript.
2. **Fail-soft.** A parse miss yields `status: 'unavailable'`, never `fail`.
   A layout change must not silently drop every user's score.
3. **Freshness CI job**, weekly, runs each probe and opens an issue on parse
   failure — so the manifest is fixed before a user sees it.
4. **Raw verdict retained** alongside the parsed number, so a human can audit
   any surprising result.

```ts
interface DetectionProbe {
  id: string
  url: string
  manifestVersion: string
  extract: { selector: string; kind: 'text' | 'attribute'; attribute?: string }
  parse:   { pattern: string; group: number; scale?: 'percent' | 'raw' }
  expect:  { min?: number; contains?: string[] }
  timeoutMs: number
}
```

---

### Layer 3 — WAF canary (ground truth)

The only unambiguous signal: does a production bot-mitigation system challenge
this profile?

**Use a canary you own** — a static page on your own domain behind Cloudflare
Bot Fight Mode (free tier). Stable, legal, no third-party load, and you control
when the challenge policy changes. Configurable in Settings so operators can
point at their own endpoint.

Classification from the response:

| Signal | Verdict |
|---|---|
| `200` + canary sentinel in body | `passed` |
| `cf-mitigated: challenge` header | `js-challenge` |
| Body references `/cdn-cgi/challenge-platform` | `js-challenge` |
| Redirect to `captcha-delivery.com` | `captcha` (DataDome) |
| `403` + known sentinel | `blocked` |

Run per (profile × proxy). This is the number to put in front of a customer.

---

## Data model & surface changes

| Area | Change |
|---|---|
| `src/shared/types.ts` | `DetectionVectorResult` gains `severity`, `source`, `status`; `DetectionTestResult` gains `injectionScore`, `riskScore`, `proxyId`, `unavailableCount` |
| `database.ts` migration | `ALTER TABLE detection_tests ADD COLUMN injection_score INTEGER`, `risk_score INTEGER`, `proxy_id TEXT`. Existing rows keep `overall_score`; readers treat a null `risk_score` as "legacy, layer 0 only" |
| IPC | `detection:runTest` gains an options arg `{ layers: ('injection'\|'coherence'\|'probe'\|'canary')[] }`; new `detection:probeManifest` and `detection:canaryConfig` |
| Settings | canary URL + expected sentinel; probe opt-in (they generate outbound traffic) |
| Dashboard | two score gauges; vectors grouped by `source`; `unavailable` rendered as grey, not red |

Back-compat: the layer set defaults to `['injection', 'coherence']`, so
existing callers keep working offline and gain the coherence rules for free.

---

## Implementation plan

Effort is relative sizing, not calendar estimates.

### Phase A — Foundations (S)
Severity/source/status on the type; weighted + fatal-override scoring; DB
migration; dual score plumbed through IPC and dashboard; per-vector timeout
(already specified in `DETECTION_IMPLEMENTATION_CHECKLIST.md` §1 — fold it in
here rather than doing it twice).

*Done when:* existing 45 vectors carry a severity, a WebDriver leak forces
`failed` regardless of the other 44, and legacy stored rows still render.

### Phase B — Coherence engine (M) ← **start here for value**
`coherence.ts` with R1–R14; worker + iframe probe harness; extend the proxy
test to capture geo-IP timezone/country; unit tests per rule using
deliberately-contradictory fixtures.

*Done when:* every rule has a passing and a failing unit test, R3/R4 run
against a live profile, and R11 catches a seeded profile whose canvas hash
changes between launches.

### Phase C — WAF canary (S) ✅
Canary config in Settings; response classifier; per-(profile × proxy)
attribution in the report.

*Done when:* a profile on a datacenter proxy reports `js-challenge` while the
same profile on a residential proxy reports `passed`, and the report names the
IP as the differing variable.

*As built:* `detection/canary.ts` classifies on vendor markers before status
codes, because challenge pages are routinely served with HTTP 200 — hence the
page sentinel, without which an interstitial is indistinguishable from the real
page. `detection/attribution.ts` derives the suspect from stored
(profile × proxy) history and returns `inconclusive` with a next step rather
than guessing when no passing comparison exists. The canary loads in its own
tab so the sweep does not navigate whatever the user had open. Disabled by
default, with no third-party URL shipped.

### Phase D — External probes (M, highest maintenance)
`probes.json` manifest; probe runner with fail-soft parsing; CreepJS +
sannysoft first; weekly freshness workflow.

*Done when:* deleting a selector from the manifest yields `unavailable` and a
maintenance warning — never a score drop.

### Phase E — Reporting (S)
Dashboard split by source; export includes raw probe verdicts; risk-score
trend replaces the current single-score chart.

**Sequence rationale:** A → B → C → D → E. B before D because B is
deterministic and permanent while D carries ongoing cost; C before D because a
self-owned canary is cheap and gives ground truth sooner than scraping.

---

## Testing strategy

The existing suite has no unit tests for detection (`DETECTION_SCORECARD.md`
grades testing 4/10). This design is testable by construction:

- **Coherence rules** — pure functions; table-driven tests over contradictory
  contexts. No browser.
- **Scoring** — fatal override, weighting, `unavailable` exclusion.
- **Probe parsing** — saved response fixtures; assert a mangled fixture yields
  `unavailable`, not `fail`.
- **Canary classifier** — synthetic responses per verdict row.
- **R11/R12** — launch one profile twice, assert hash equality; launch two,
  assert inequality.

---

## Non-goals

- Guaranteeing any specific site can be automated. The canary reports what a
  WAF did at one moment through one IP; it is a measurement, not a promise.
- Scraping third-party testers at volume. Probes are opt-in and rate-limited.
- Replacing Layer 0. It remains the engine's regression suite, renamed.

## Risks

| Risk | Mitigation |
|---|---|
| Probes rot silently | Fail-soft + weekly CI freshness job + raw verdict retained |
| Users read "risk score" as a guarantee | Wording in UI states it is a point-in-time measurement per profile × proxy |
| Canary policy drift changes results | Canary is self-owned; pin the Cloudflare setting and version it |
| Layer 2/3 add outbound traffic from an anti-detect product | Opt-in, off by default, documented |
