# Automation & RPA Engine

## Overview

The automation engine executes multi-step workflows inside a running profile browser. It supports 17 action types including conditional branching, loops, and HTTP requests.

---

## Action Types

| Action | Parameters | Description |
|--------|-----------|-------------|
| `navigate` | `url`, `waitUntil?` | Navigate to URL. `waitUntil`: `load`/`networkidle0`/`networkidle2`/`domcontentloaded` |
| `click` | `selector` | Click element matching CSS selector |
| `type` | `selector`, `text`, `delay?`, `clear?` | Type text into input. `delay` ms between keystrokes (default 50). `clear: true` clears field first |
| `wait` | `ms` | Wait N milliseconds |
| `waitForSelector` | `selector`, `visible?`, `timeout?` | Wait for element to appear. `visible: true` also waits for visibility |
| `screenshot` | `path?`, `fullPage?` | Capture screenshot. `fullPage: true` captures full scrollable page |
| `extractText` | `selector`, `outputKey?` | Extract `textContent` from element. Stored in step output |
| `scroll` | `x`, `y` | Scroll page by (x, y) pixels |
| `select` | `selector`, `value` | Select an `<option>` by value in a `<select>` |
| `keyPress` | `key` | Press a keyboard key (e.g. `Enter`, `Tab`, `Escape`) |
| `evaluate` | `script` | Execute arbitrary JavaScript in the page context. Return value captured as output |
| `hover` | `selector` | Move mouse over element (triggers CSS `:hover`) |
| `rightClick` | `selector` | Right-click element (opens context menu) |
| `setAttribute` | `selector`, `attribute`, `value` | Set a DOM attribute on the matched element |
| `httpRequest` | `url`, `method`, `headers?`, `body?` | Make an HTTP request from Node.js context. Response available as output |
| `conditional` | `selector`, `thenSteps[]`, `elseSteps[]` | Run `thenSteps` if selector found, otherwise `elseSteps` |
| `loop` | `times`, `steps[]` | Repeat `steps` N times |

---

## Workflow Structure

```typescript
interface AutomationWorkflow {
  id: string
  name: string
  description?: string
  steps: AutomationStep[]
  created_at: string
  updated_at: string
}

interface AutomationStep {
  id: string
  action: AutomationActionType
  label?: string
  params: Record<string, any>
}
```

### Step Result

```typescript
interface AutomationStepResult {
  stepId: string
  action: AutomationActionType
  success: boolean
  duration_ms: number
  output?: any     // e.g. extracted text, HTTP response, screenshot path
  error?: string
}
```

---

## Built-in Templates (6)

### 1. Web Page Scraper

```
navigate  → url: https://example.com
wait      → ms: 2000
extractText → selector: 'h1', outputKey: title
extractText → selector: '.content', outputKey: body
screenshot  → fullPage: true
```

### 2. Login Flow

```
navigate    → url: https://app.example.com/login
waitForSelector → selector: '#email'
type        → selector: '#email', text: '{email}'
type        → selector: '#password', text: '{password}'
click       → selector: 'button[type="submit"]'
waitForSelector → selector: '.dashboard', timeout: 10000
screenshot
```

### 3. Social Media Feed Scroll

```
navigate    → url: https://social.example.com/feed
wait        → ms: 3000
loop (5×):
  scroll    → x: 0, y: 800
  wait      → ms: 1500
screenshot  → fullPage: false
```

### 4. E-Commerce Price Checker

```
navigate     → url: https://shop.example.com/product
waitForSelector → selector: '.product-title'
extractText  → selector: '.product-title', outputKey: title
extractText  → selector: '.price', outputKey: price
screenshot
```

### 5. Form Auto-Fill

```
navigate     → url: https://form.example.com
waitForSelector → selector: 'form'
type         → selector: '#name', text: 'John Doe'
type         → selector: '#email', text: 'john@example.com'
type         → selector: '#phone', text: '+1234567890'
click        → selector: 'button[type="submit"]'
waitForSelector → selector: '.success-message'
screenshot
```

### 6. Site Health Check

```
navigate     → url: https://example.com
wait         → ms: 2000
evaluate     → script: 'performance.timing.loadEventEnd - performance.timing.navigationStart'
evaluate     → script: 'document.title'
conditional  → selector: '.error-message'
  thenSteps: screenshot, extractText(.error-message)
  elseSteps: extractText(h1)
```

---

## Usage

### Via UI

1. Open **Automation** section
2. Create a new workflow or use **Templates**
3. Add/edit steps in the step editor
4. Select a profile and click **Run**

### Via IPC

```typescript
// Create workflow
const wf = await window.api.workflows.create({
  name: 'My Workflow',
  description: 'Optional description',
  steps: [
    { id: uuid(), action: 'navigate', params: { url: 'https://example.com' } },
    { id: uuid(), action: 'screenshot', params: { fullPage: true } }
  ]
})

// Run on a profile
const result = await window.api.workflows.run(wf.id, profileId)

// Stop running workflow
window.api.workflows.stop(wf.id, profileId)

// Check if running
const running = await window.api.workflows.isRunning(wf.id, profileId)

// Get run history
const runs = await window.api.workflows.runs(wf.id)
```

### Via REST API

```bash
# List workflows
GET /api/workflows

# Run workflow on profile
POST /api/workflows/:workflowId/run
Content-Type: application/json
{ "profileId": "uuid" }

# Stop workflow
POST /api/workflows/:workflowId/stop
{ "profileId": "uuid" }
```

---

## Local REST API Server

The API server is an Express instance that runs inside the Electron main process.

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Port | 9222 | HTTP port |
| Auth Token | (none) | Optional Bearer token |

### Starting via IPC

```typescript
await window.api.apiServer.start({ port: 9222, authToken: 'my-secret' })
await window.api.apiServer.stop()
const status = await window.api.apiServer.status()
// { running: boolean, port: number, url: string }
```

### Authentication

When a token is configured, include it in every request:

```
Authorization: Bearer my-secret
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/profiles` | List all profiles |
| GET | `/api/profiles/:id` | Get profile details |
| GET | `/api/profiles/active` | Get active session IDs |
| POST | `/api/profiles/:id/launch` | Launch profile browser |
| POST | `/api/profiles/:id/close` | Close profile browser |
| GET | `/api/proxies` | List all proxies |
| POST | `/api/detection/run/:id` | Run detection test |
| GET | `/api/detection/results/:id` | Get test results |
| GET | `/api/workflows` | List workflows |
| POST | `/api/workflows/:id/run` | Run workflow on profile |
| POST | `/api/workflows/:id/stop` | Stop running workflow |
