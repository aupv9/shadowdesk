# Phase 18 — Automation & RPA: Data Pipelines, Control Flow, and Integration

Phase 18 closes the gap between ShadowDesk's RPA engine and production-grade
scraping/automation suites. It adds six new actions, a reusable transform
pipeline, run-history export, and an inbound webhook trigger so external
systems can drive workflows over HTTP.

## 1. New Action Types (6)

### `extractJson`
Pulls a value out of a JSON document by JSONPath.

**Sources** (provide exactly one):
- `variable` — read JSON from an existing workflow variable
- `value` — inline JSON string (supports `{varName}` interpolation)
- `script` — a JS expression evaluated in the page; result is JSON-stringified
- `selector` — CSS selector whose element `textContent` is the JSON source

**Parameters**
| Param | Type | Notes |
|-------|------|-------|
| `path` | string | JSONPath — supports `$`, `$.a.b`, `$.a[0]`, `$.a[*]`, `$.a.0.b`, `$["a.b"]` |
| `saveAs` | string | Variable name to write the extracted value into |
| `default` | string | Fallback when `path` resolves to `undefined`/`null` |
| `optional` | bool | Swallow JSON parse errors (uses `default` instead) |
| `transform` | string \| string[] | Transform pipeline applied before save |

### `forEachElement`
Iterates over every DOM element matching a selector and runs a nested body of
steps per element. Survives mutations: elements are tagged with a unique
`data-sd-fee-*` attribute at iteration start, so clicks/DOM changes inside the
body don't break the loop.

**Variables exposed inside the body**
| Var | Description |
|-----|-------------|
| `el.index` | 0-based iteration index |
| `el.total` | Total elements matched |
| `el.text` | `textContent` (trimmed) |
| `el.html` | `innerHTML` |
| `el.tag` | Lowercased tag name |
| `el.href` | For `<a>` elements, the `href` |
| `el.value` | For inputs, the current `value` |
| `el.selector` | Stable per-element selector to target inside the body |

**Parameters**
| Param | Type | Notes |
|-------|------|-------|
| `selector` | string | CSS selector to iterate |
| `steps` | AutomationStep[] | Body run per element |
| `prefix` | string | Prefix for exposed variables (default `el.`) |
| `limit` | number | Max iterations (default no limit) |
| `skip` | number | Skip first N elements |
| `reverse` | bool | Iterate in reverse order |
| `failFast` | bool | Stop whole loop on first child failure (default `true`) |

### `whileLoop`
Safety-capped conditional loop. Evaluates a condition before each iteration.

**Condition types**
| Type | Needs | Meaning |
|------|-------|---------|
| `selector-exists` | `selector` | Loop while element is in the DOM |
| `selector-missing` | `selector` | Loop while element is absent |
| `text-contains` | `selector`, `text` | Loop while element's text contains substring |
| `js-truthy` | `script` | Loop while the JS expression evaluates truthy |
| `var-equals` | `variable`, `value` | Loop while variable equals value |
| `var-truthy` | `variable` | Loop while variable is non-empty/non-false |

**Parameters**
| Param | Default | Notes |
|-------|---------|-------|
| `maxIterations` | 100 | Hard cap — prevents infinite loops |
| `delayMs` | 0 | Delay between iterations |
| `invert` | false | Treat condition as "until" instead of "while" |
| `steps` | — | Nested body run per iteration |

### `waitForRequest` / `waitForResponse`
Pause until a matching network event occurs.

**Common parameters**
- `urlPattern` — glob (`**/api/user*`) OR regex (`/^https:\/\/api\..*$/`)
- `method` — optional method filter (`GET`, `POST`, etc.)
- `timeout` — default 30000ms

**`waitForResponse` additional parameters**
- `status` — required HTTP status (e.g. 200)
- `captureBody` — default `true`
- `extractPath` — JSONPath applied to the parsed body
- `transform` — transform pipeline (chained after `extractPath`)
- `saveAs` — target variable name

### `paginate`
Clicks a "Next" button until it disappears or is disabled, running a body of
steps once per page. Exposes `pg.index` (0-based) and `pg.count` (pages
visited) to nested steps.

**Parameters**
| Param | Default | Notes |
|-------|---------|-------|
| `nextSelector` | — | Selector for the next/"load more" button |
| `maxPages` | 50 | Hard cap to prevent runaway pagination |
| `waitForNavigation` | false | Set `true` for classic multi-page pagination |
| `waitAfterClick` | 500 | ms to wait for content to load (SPA-style) |
| `steps` | — | Body run on each page |

## 2. Transform Pipeline

A uniform transform is available anywhere a step writes into a variable. The
`transform` field accepts a string with `|`-separated ops, or an array of ops.

### Ops
| Op | Argument | Description |
|----|----------|-------------|
| `trim` | — | Strip whitespace |
| `upper` | — | UPPERCASE |
| `lower` | — | lowercase |
| `number` | — | Extract the first number (int or float) |
| `length` | — | Replace with string length |
| `jsonPath:$.path` | path | Parse JSON and pull a path |
| `regex:pattern` | regex | First capture group (or full match if no group) |
| `split:sep:index` | — | Split and take the Nth piece |
| `replace:find:with` | — | Literal string replace |
| `replace:re:pattern:with` | — | Regex replace (global) |
| `prefix:str` | — | Prepend string |
| `suffix:str` | — | Append string |

### Example
```json
{
  "action": "httpRequest",
  "params": {
    "url": "https://api.example.com/user/me",
    "method": "GET",
    "extractPath": "$.profile.email",
    "transform": "trim|lower|suffix: (verified)",
    "saveAs": "userEmail"
  }
}
```

Supported on: `extractText`, `evaluate`, `httpRequest`, `extractJson`,
`waitForResponse`.

## 3. Run History Export

### Via IPC (desktop UI)
```ts
window.api.workflows.exportRuns(workflowId, {
  format: 'csv',         // or 'json'
  perStep: false,        // CSV only: one row per step
  limit: 500,            // default 500, max 5000
  status: 'failed',      // optional filter
  includeVariables: true // default true
})
```
Opens a save dialog and writes the file. Passing `null` for `workflowId`
exports runs across all workflows.

### Via HTTP (external tools)
```
GET /api/workflows/:id/runs/export?format=csv&limit=500&perStep=1&status=failed
GET /api/workflows/:id/runs/export?format=json&limit=100
```

CSV columns (per-run):
```
run_id, workflow_id, profile_id, status, started_at, completed_at,
duration_ms, step_count, failed_steps, error[, variables]
```

CSV columns (per-step):
```
run_id, workflow_id, profile_id, run_status, step_index, step_id,
action, success, error, duration_ms, started_at
```

## 4. Inbound Webhook Triggers

```
POST /api/webhooks/workflows/:id/run
```

**Request body**
```json
{
  "profileId": "abc-123",
  "variables": { "searchTerm": "hello" }
}
```

**Behaviour**
- Returns immediately with `202 Accepted` — execution is async.
- Auto-launches the profile if it is not already running.
- Any error during background execution is logged to run history.

**Response**
```json
{
  "accepted": true,
  "runId": "webhook-1739...-a1b2c3",
  "workflowId": "wf-42",
  "profileId": "abc-123",
  "message": "Workflow execution started. Poll /api/workflows/:id/runs/last for result."
}
```

**Polling the result**
```
GET /api/workflows/:id/runs/last
```
Returns the most recent completed run (or 404 if none yet).

## 5. Security Notes

- All Phase 18 HTTP endpoints are scoped to the existing local API server,
  which binds to `127.0.0.1` only.
- Bearer token auth continues to apply to every new endpoint when
  `authToken` is configured.
- The webhook endpoint's background execution never bypasses profile
  isolation, proxy binding, or the fingerprint engine — it reuses the exact
  same `executeWorkflow` code path as the IPC runner.
