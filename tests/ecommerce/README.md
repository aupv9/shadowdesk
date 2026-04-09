# E-Commerce Operations Test Suite

Full-flow testing harness for the **E-Commerce Operations** pillar of Ghost Browser:

1. **Multi-store monitoring** — Shopee, Lazada, TikTok Shop, Tiki, GrabFood, VNPay
2. **Price intelligence & competitor tracking** — cross-platform price matrix
3. **Inventory scraping** — in-stock / low-stock / out-of-stock state machine
4. **Bulk account management** — profile rotation, session isolation, rate-limit handling

## Architecture

```
tests/ecommerce/
├── fixtures/                   # Realistic HTML snapshots of each marketplace
│   ├── shopee-search.html
│   ├── shopee-product.html
│   ├── shopee-product-low-stock.html
│   ├── shopee-product-oos.html
│   ├── lazada-search.html
│   ├── lazada-product.html
│   ├── lazada-flash-sale.html
│   ├── tiktok-shop-feed.html
│   ├── tiki-search.html
│   ├── tiki-flash-deal.html
│   ├── grabfood-restaurants.html
│   └── vnpay-checkout.html
├── helpers/
│   ├── html-matcher.ts             # Pure-JS HTML parser + CSS selector matcher
│   ├── price-parser.ts             # VND/THB/MYR/SGD/PHP/IDR/USD normalisation
│   ├── offline-workflow-runner.ts  # Simulates AutomationEngine against fixtures
│   ├── mock-marketplace-server.ts  # Node HTTP server with rate-limit + sessions
│   └── profile-pool.ts             # Bulk profile rotation simulator
├── multi-store-monitoring.test.ts
├── price-intelligence.test.ts
├── inventory-scraping.test.ts
├── bulk-account-management.test.ts
└── README.md
```

And a flag-gated live smoke runner at `tests/smoke/ecommerce-live-smoke.ts`.

## Running the tests

### Offline suite (CI-safe, no network, no browser)

```bash
npm run test:ecommerce              # one-shot
npm run test:ecommerce:watch        # watch mode
```

This exercises every SEA e-commerce workflow template in
`src/main/workflow-templates.ts` against a matching HTML fixture, plus the
mock marketplace server for stateful bulk-account scenarios.

Runs against `vitest` with `environment: 'node'`. No `jsdom`, `happy-dom`,
`cheerio`, `express`, or `puppeteer` binaries needed — the suite is 100%
pure-Node and adds **zero new dependencies**.

### Live smoke runner (flag-gated, real network)

```bash
npm run test:ecommerce:smoke:dry    # prints target table, no network traffic
npm run test:ecommerce:smoke:live   # probes real Shopee/Lazada/Tiki/... URLs
```

The live runner is a lightweight HTTPS probe — it fetches each marketplace
homepage, checks for a platform-specific sentinel string, and reports pass/fail.
It does **not** launch a full browser, does **not** test behavioural anti-detect,
and does **not** log in. For full browser-based smoke testing use the
existing `npm run test:automation` script.

Configuration:

| env var                      | default | purpose                       |
|------------------------------|---------|-------------------------------|
| `GHOSTBROWSER_LIVE_SMOKE=1`  | unset   | enables live mode without `--live` |
| `SMOKE_TIMEOUT_MS`           | 15000   | per-probe timeout             |

## What the tests guarantee

### `multi-store-monitoring.test.ts`

For each built-in SEA workflow template:
- `navigate` resolves to a matching fixture URL
- every `waitForSelector` / `click` / `hover` selector exists in the fixture
- `extractText(all:true)` yields ≥ the expected cardinality (usually 10)
- every `saveAs` variable is populated

If a selector in `workflow-templates.ts` ever drifts from the real marketplace
DOM shape, these tests fail and the fixture has to be updated in lock-step —
making silent regressions impossible.

### `price-intelligence.test.ts`

- `parsePrice()` handles all 7 SEA currency formats correctly (leading symbol,
  trailing symbol, dots-as-thousands, commas-as-thousands)
- `parsePriceBatch()` drops unparseable entries without failing
- `priceStats()` produces correct min/max/mean/median on known inputs
- Cross-platform aggregation (Shopee + Lazada + Tiki) produces a competitor
  matrix with per-platform stats
- Price alert thresholds and "cheapest variant" buy-signals are computable
  from the parsed shape

### `inventory-scraping.test.ts`

- Three shopee-product fixtures drive the state machine:
  in-stock (54 units), low-stock (3 units), out-of-stock (0 units + disabled button)
- `classifyStock()` correctly categorises each Vietnamese / English stock label
- Tiki flash-deal page yields a mixed-state inventory report that a
  dashboard could render

### `bulk-account-management.test.ts`

Uses the `MockMarketplaceServer` (Node `http` on an ephemeral port) + a
`ProfilePool` (round-robin / random / least-used rotation) to verify:

- 10 profiles × 1 login each → 10 distinct session cookies
- Cookies are isolated per profile (no bleed)
- Rate-limited profiles enter cooldown and rotate out of the pool
- Least-used rotation picks the profile with the lowest `runCount`
- Random rotation is deterministic with a fixed `rngSeed`
- Mass product fetch across 20 profiles completes without errors
- Health endpoint exposes stats for observability
- Failed auth returns 401 without issuing a session
- Rate-limit window expires correctly (end-to-end backoff)

## Adding a new marketplace

1. Add the platform to `src/main/sea-platforms.ts` (`SEA_PLATFORMS` array)
2. Add workflow templates to `src/main/workflow-templates.ts`
3. Create a fixture under `tests/ecommerce/fixtures/<platform>-<page>.html`
   that matches the selectors your template uses
4. Add a `describe()` block in `multi-store-monitoring.test.ts`
5. Register the fixture path in `mock-marketplace-server.ts` → `FIXTURE_MAP`
   if you want the bulk-account tests to hit it

## Why these tests matter

"Tôi muốn setup full flow full kịch bản testing cho E-Commerce Operations xem
application đáp ứng được thực tế chưa." — the user, 2026-04-09

This suite answers that question across four dimensions:

| Dimension              | What's validated                                   |
|------------------------|----------------------------------------------------|
| **Correctness**        | Selectors resolve on realistic fixture HTML        |
| **Data integrity**     | Extracted titles/prices/stock have the right shape |
| **Multi-platform**     | 6 marketplaces covered in one consistent harness   |
| **Operational robustness** | Rotation, rate-limits, session isolation       |
| **Reachability** (live)| Real marketplaces are reachable & sentinel-healthy |

It runs in Vitest so every PR gets automatic coverage, and it's deliberately
designed to break LOUDLY when workflow templates drift from their target sites.
