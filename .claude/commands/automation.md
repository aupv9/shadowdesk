# Ghost Browser Automation Engine

Review or implement workflow automation features using Ghost Browser's RPA builder and execution engine.

## Quick Reference

**Automation Action Types**: 28 total  
**Key Files**: `src/main/automation.ts`, `src/renderer/src/components/Automation/`  
**DB Table**: `workflows`, `workflow_executions`

---

## Core Workflow Structure

```typescript
interface Workflow {
  id: string
  userId: string
  name: string
  steps: AutomationStep[]
  variables: Record<string, string>  // User-defined vars
  template?: string  // optional template key
}

type AutomationStep = 
  | { type: 'navigate'; url: string }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'extractText'; selector: string; saveTo?: string; transform?: string }
  | { type: 'conditional'; condition: string; trueBranch: AutomationStep[]; falseBranch?: AutomationStep[] }
  | { type: 'loop'; count: number; steps: AutomationStep[] }
  | { type: 'waitForSelector'; selector: string; timeout: number }
  | ... (20 more types)
```

---

## Variable Interpolation

Variables work in: **navigate URL**, **click/type selectors**, **httpRequest body/headers**, **text strings**

```typescript
// User defines:
{ myVar: 'example.com', count: '5' }

// In step:
{ type: 'navigate', url: 'https://{myVar}' }

// Resolves to:
'https://example.com'
```

**Built-in variables**:
- `{timestamp}` — current Unix time
- `{random}` — 6-digit random number
- `{profileName}` — current profile name
- `{runId}` — execution UUID

---

## Action Categories

### Navigation & Waiting
- `navigate` — load URL
- `waitForSelector` — wait for element to exist
- `waitForNavigation` — wait for page load
- `waitForRequest` — intercept HTTP request by URL pattern
- `waitForResponse` — intercept HTTP response + extract body

### DOM Interaction
- `click`, `rightClick`, `doubleClick` — click element
- `type` — type text into input/textarea
- `hover` — hover over element
- `scroll` — scroll page or element
- `select` — select dropdown option
- `keyPress` — send keyboard key
- `setAttribute` — set HTML attribute

### Data Extraction
- `extractText` — get element text, optional transform
- `evaluate` — run custom JS, return result
- `httpRequest` — make HTTP call
- `extractJson` — extract from JSON using JSONPath
- `screenshot` — save screenshot to file
- `download` — download file

### Control Flow
- `conditional` — if/else branching
- `loop` — repeat N times
- `forEachElement` — iterate matched elements
- `whileLoop` — repeat while condition true

### Specialized
- `solveCaptcha` — solve via captcha service
- `injectCaptchaToken` — inject token into form
- `upload` — upload file to input
- `useCredential` — inject from vault
- `wait` — fixed delay

---

## Transform Pipeline

Applied to: `extractText`, `evaluate`, `httpRequest`, `extractJson`, `waitForResponse`

**Operators**:
- `trim` — remove whitespace
- `upper` / `lower` — case conversion
- `number` — parse to number
- `length` — get string length
- `jsonPath:$.path.field` — JSONPath extraction
- `regex:/pattern/[flags]` — regex match group 1
- `split:,:[1]` — split by delimiter, take index
- `replace:find:with` — string replace
- `prefix:str` / `suffix:str` — prepend/append

**Chain format**: `"trim|upper|prefix:PREFIX-"` or `["trim", "upper"]`

Example:
```typescript
{
  type: 'extractText',
  selector: '#price',
  saveTo: 'productPrice',
  transform: 'trim|regex:/\\$(\\d+\\.\\d{2})/|number'
}
```

Extracts: `"  $99.99  "` → `99.99`

---

## Execution Model

```typescript
// Phase: Prepare
1. Load workflow steps
2. Resolve user variables from input
3. For each profile in execution list:
   - Launch Chromium (if not running)
   - Get CDP WebSocket URL
   - Create puppeteer Page instance

// Phase: Execute
4. For each step:
   a. Interpolate variables in step config
   b. Execute action:
      - Click: page.click(selector)
      - Extract: page.evaluate(getElementText, selector)
      - Wait: page.waitForSelector(selector, { timeout })
      - Conditional: evaluate condition script, branch
   c. On error + retryable: retry up to 3x with delay
   d. Capture result (if saveTo specified)
   e. Update runtime variables

// Phase: Complete
5. Collect all results, stream to UI
6. Store execution record in DB
7. Close profiles (if not persistent mode)
```

**Concurrency**: Default 1 profile at a time. Can run 5+ profiles in parallel via `concurrency` setting.

---

## Conditional Branching

```typescript
{
  type: 'conditional',
  condition: 'typeof window.myFeature !== "undefined"',  // JS that evals to boolean
  trueBranch: [
    { type: 'click', selector: '.yes-button' }
  ],
  falseBranch: [
    { type: 'click', selector: '.no-button' }
  ]
}
```

---

## Common Patterns

### Login Flow
```typescript
[
  { type: 'navigate', url: 'https://login.example.com' },
  { type: 'waitForSelector', selector: '[name="username"]', timeout: 5000 },
  { type: 'type', selector: '[name="username"]', text: '{username}' },
  { type: 'type', selector: '[name="password"]', text: '{password}' },
  { type: 'click', selector: 'button[type="submit"]' },
  { type: 'waitForNavigation', timeout: 10000 }
]
```

### Price Scraping with Pagination
```typescript
[
  { type: 'navigate', url: 'https://shop.example.com/products' },
  { type: 'loop', count: 5, steps: [
    { type: 'extractText', selector: '.product-price', saveTo: 'prices' },
    { type: 'click', selector: 'a.next-page' },
    { type: 'waitForNavigation', timeout: 5000 }
  ]}
]
```

### Conditional Captcha Handling
```typescript
[
  { type: 'navigate', url: 'https://form.example.com' },
  { type: 'conditional', 
    condition: 'document.querySelector(".g-recaptcha") !== null',
    trueBranch: [
      { type: 'solveCaptcha', captchaType: 'reCAPTCHA_v2', provider: 'anticaptcha', saveTo: 'captchaToken' },
      { type: 'injectCaptchaToken', selector: '[name="g-recaptcha-response"]', token: '{captchaToken}' }
    ]
  },
  { type: 'click', selector: 'button[type="submit"]' }
]
```

---

## Key Implementation Details

**Retryable Actions**: navigate, click*, type, wait*, extract*, http*, solve*, inject*
**Non-Retryable**: wait (fixed delay), screenshot, download, conditional, loop, forEachElement

**Error Propagation**: Step error stops execution unless wrapped in conditional. Execution history records the error message.

**Variable Scope**: Variables persist across all steps in a single execution. New execution starts with fresh scope.

**Performance**: 
- Serial: 10 steps ≈ 5-10s (network dependent)
- Parallel (5 profiles): ≈ 5-10s per step (concurrency controlled)

---

## Webhook Triggers

**Trigger URL**: `POST /api/webhooks/workflows/:workflowId/run`

```bash
curl -X POST http://localhost:9222/api/webhooks/workflows/my-workflow-id/run \
  -H "Content-Type: application/json" \
  -d '{
    "profileIds": ["profile-1", "profile-2"],
    "variables": { "myVar": "custom-value" },
    "concurrency": 2
  }'

# Response: 202 Accepted
# { executionId: "exec-uuid" }
```

Poll status via: `GET /api/workflows/:workflowId/runs/last`

---

## UI Components

**Workflow Builder**: `src/renderer/src/components/Automation/`
- `WorkflowBuilder.tsx` — main view
- `StepEditor.tsx` — single step config
- `ActionSelector.tsx` — action type picker
- `VariableEditor.tsx` — define workflow variables

**Execution Monitor**: Shows live progress, step results, variable snapshots

---

## Debugging

Enable detailed logging in automation handler:
```typescript
// src/main/ipc/handlers.ts - executeWorkflow
console.log(`[Automation] Step ${i}: ${step.type}`)
console.log(`[Automation] Variables:`, variables)
console.log(`[Automation] Result:`, result)
```

Inspect execution history in: Sidebar → Workflows → select workflow → Runs tab
