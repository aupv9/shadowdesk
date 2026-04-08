# Workflow Automation Flow — Ghost Browser

## 📋 Overview

Ghost Browser's automation system enables users to create, manage, and execute complex workflows on Chromium profiles. The system supports single execution, parallel batch execution, and scheduled recurring execution with comprehensive error handling, debugging, and monitoring.

---

## 🏗️ Architecture Components

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **AutomationEngine** | `src/main/automation.ts` | Executes workflows and steps on browser profiles |
| **WorkflowScheduler** | `src/main/scheduler.ts` | Manages scheduled workflow execution (cron-based) |
| **Database (Workflows)** | `src/main/database.ts` | Persists workflows, runs, versions, schedules |
| **IPC Handlers** | `src/main/ipc/handlers.ts` | Exposes workflow APIs to renderer |
| **Automation Store** | `src/renderer/src/stores/automationStore.ts` | React state management for workflow UI |
| **API Server** | `src/main/api-server.ts` | External REST API for workflow control |
| **Recorder** | `src/main/recorder.ts` | Records user actions as workflow steps |
| **Recording Refiner** | `src/main/recording-refiner.ts` | Refines recorded workflows with AI |

### Supporting Services

- **BrowserManager**: Launches and manages Chromium profiles
- **Database**: Stores workflows, runs, versions, and schedules
- **AI Assistant**: AI-powered workflow generation and fixing (Phase 16)
- **Captcha Solver**: Solves CAPTCHAs during automation
- **Vault**: Manages encrypted credentials for use in workflows
- **DetectionTestRunner**: Tests profiles against detection vectors

---

## 🔄 Workflow Lifecycle

### Phase 1: Workflow Creation

```
┌─────────────────────────────────────────────────────────────┐
│ USER CREATES WORKFLOW                                       │
└─────────────────────────────────────────────────────────────┘
        │
        ├─ Via UI: Create from scratch
        ├─ Via Template: Select pre-built template
        ├─ Via Recording: Record user actions
        └─ Via AI: Natural language → workflow (Phase 16)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ RENDERER: useAutomationStore.createWorkflow()              │
│  ├─ Send: CreateWorkflowInput (name, description, steps)   │
│  └─ Target: window.api.workflows.create()                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ IPC HANDLER: workflows:create                              │
│  ├─ Generate workflow ID (UUID)                            │
│  ├─ Validate workflow structure                            │
│  ├─ Call: db.createWorkflow()                              │
│  └─ Return: AutomationWorkflow object                      │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE: INSERT into workflows table                       │
│  ├─ id: UUID                                               │
│  ├─ name: string                                           │
│  ├─ description: string (optional)                         │
│  ├─ steps: JSON array of AutomationStep                    │
│  ├─ variables: JSON object (default values)                │
│  ├─ created_at: timestamp                                  │
│  └─ updated_at: timestamp                                  │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ RENDERER: Update UI + Store                                │
│  ├─ Add workflow to workflows[] list                       │
│  └─ Notify user of success                                 │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Workflow Configuration

**Workflow Metadata**
```json
{
  "id": "uuid",
  "name": "Shopee Product Scraper",
  "description": "Search Shopee and extract product listings",
  "variables": {
    "keyword": "laptop",
    "maxPages": "2"
  },
  "steps": [
    // Array of AutomationStep objects
  ],
  "created_at": "2025-04-08T10:00:00Z",
  "updated_at": "2025-04-08T10:00:00Z"
}
```

**AutomationStep Structure**
```json
{
  "id": "step-uuid",
  "action": "navigate|click|type|conditional|loop|etc",
  "label": "Human-readable step name",
  "params": {
    // Action-specific parameters
    "url": "https://shopee.vn",
    "selector": ".searchbar",
    "text": "{keyword}",
    "saveAs": "pageTitle"
  },
  "retries": 3,
  "retryDelay": 1000,
  "retryBackoff": "exponential",
  "retryOn": ["timeout", "network"],
  "timeoutMs": 30000,
  "onErrorGoto": "error-handler-step-id"
}
```

---

## ▶️ Workflow Execution Flow

### Single Profile Execution

```
┌──────────────────────────────────────────────────────────┐
│ USER CLICKS: Run Workflow on Profile                    │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ RENDERER: automationStore.runWorkflow()                 │
│  ├─ workflowId: string                                  │
│  ├─ profileId: string                                   │
│  ├─ variables?: Record<string, string>                  │
│  └─ window.api.workflows.run(...)                       │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ IPC HANDLER: workflows:run                              │
│  └─ async handler dispatches to AutomationEngine        │
│     └─ engine.executeWorkflow(workflowId, profileId)    │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ AUTOMATION ENGINE: executeWorkflow()                    │
└──────────────────────────────────────────────────────────┘
        │
        ├─ Step 1: Load workflow from DB
        │   └─ Parse steps and variables from JSON
        │
        ├─ Step 2: Pre-flight Validation
        │   ├─ Validate regex patterns in steps
        │   ├─ Check profile is launched
        │   └─ Get active browser page
        │
        ├─ Step 3: Initialize Run Context
        │   ├─ Generate runId = "{workflowId}:{profileId}"
        │   ├─ Merge variables:
        │   │  ├─ Stored workflow defaults
        │   │  ├─ Runtime overrides
        │   │  └─ Built-in vars: timestamp, runId, random, profileName
        │   ├─ Setup debug control flags
        │   └─ Initialize step results array
        │
        ├─ Step 4: Emit "before-workflow" Hook
        │   └─ Notify listeners workflow is starting
        │
        ├─ Step 5: Execute Steps
        │   └─ executeSteps(steps, variables, ...)
        │       │
        │       ├─ For each step in workflow.steps:
        │       │
        │       │ a) Interpolate variables in params
        │       │    └─ Replace {varName} with actual values
        │       │
        │       │ b) Execute step via executeStep()
        │       │    ├─ Navigate, Click, Type, Extract, etc.
        │       │    └─ Each action returns output
        │       │
        │       │ c) Handle step result
        │       │    ├─ Capture duration (ms)
        │       │    ├─ Store output in variables
        │       │    ├─ Handle success/failure
        │       │    ├─ Apply data transforms if saveAs
        │       │    └─ Append to stepResults[]
        │       │
        │       │ d) Check for control flow
        │       │    ├─ Retry on failure?
        │       │    ├─ Jump to error step?
        │       │    ├─ Pause at breakpoint?
        │       │    ├─ User abort?
        │       │    └─ Global timeout?
        │       │
        │       └─ If step fails:
        │          ├─ Check onErrorGoto
        │          ├─ Jump to error handler OR
        │          └─ Stop execution
        │
        ├─ Step 6: Emit "after-workflow" Hook
        │   └─ Notify listeners workflow completed
        │
        └─ Step 7: Finalize
            ├─ Determine final status (completed|failed|stopped)
            ├─ Cleanup network intercepts
            ├─ Cleanup debug hooks
            ├─ Record to database
            └─ Return AutomationRunResult

        ▼
┌──────────────────────────────────────────────────────────┐
│ DATABASE: INSERT into workflow_runs table                │
│  ├─ workflow_id: UUID                                   │
│  ├─ profile_id: UUID                                    │
│  ├─ status: 'completed' | 'failed' | 'stopped'         │
│  ├─ started_at: ISO timestamp                           │
│  ├─ completed_at: ISO timestamp                         │
│  ├─ duration_ms: number                                 │
│  ├─ step_results: JSON (each step's result)             │
│  ├─ variables_snapshot: JSON (final variable state)     │
│  └─ error: string (if failed)                           │
└──────────────────────────────────────────────────────────┘

        ▼
┌──────────────────────────────────────────────────────────┐
│ RENDERER: Receive AutomationRunResult                   │
│  ├─ Update: runResult in store                          │
│  ├─ Refresh: runHistory                                 │
│  └─ Display: Results dashboard with step details        │
└──────────────────────────────────────────────────────────┘
```

### Execution Modes

#### Mode 1: Single Profile
```javascript
window.api.workflows.run(workflowId, profileId, variables?)
// Execute workflow once on a single profile
```

#### Mode 2: Parallel Batch
```javascript
window.api.workflows.runParallel(workflowId, profileIds, variables?, concurrency=5)
// Execute workflow on multiple profiles in parallel (5 concurrent by default)
// Returns: AutomationRunResult[]
```

#### Mode 3: Scheduled
```javascript
db.createSchedule({
  workflow_id: "uuid",
  profile_ids: ["uuid1", "uuid2"],
  cron: "0 9 * * MON",     // Every Monday at 9 AM
  enabled: true
})
// WorkflowScheduler polls every 30s and triggers due schedules
```

#### Mode 4: External API
```bash
POST /api/workflows/{workflowId}/run
Body: { profileId, variables }
# Local REST API for external automation control
```

---

## 📍 Step Execution Detailed Flow

Each step goes through this lifecycle:

```
Input: AutomationStep
│
├─ 1. Interpolate Variables
│     └─ Replace all {varName} placeholders in params
│
├─ 2. Execute Action
│     ├─ Action router (60+ actions)
│     │  ├─ navigate: page.goto(url, waitUntil)
│     │  ├─ click: page.click(selector)
│     │  ├─ type: page.type(selector, text, delay)
│     │  ├─ extractText: page.$eval(selector)
│     │  ├─ screenshot: page.screenshot()
│     │  ├─ conditional: evaluate condition + execute branch
│     │  ├─ loop: repeat steps N times
│     │  ├─ solveCaptcha: call solver service
│     │  ├─ httpRequest: fetch() + parse response
│     │  └─ ... 50+ more actions
│     │
│     └─ Return: output (varies by action)
│
├─ 3. Transform Output (if saveAs + transform)
│     ├─ trim, upper, lower
│     ├─ jsonPath:$.x.y
│     ├─ regex:pattern
│     ├─ split:sep:index
│     └─ ... 9 transform operations
│
├─ 4. Store in Variables
│     └─ variables[saveAs] = transformed_output
│
├─ 5. Record Result
│     └─ stepResults.push({
│          stepId, action, success, duration_ms, output, error
│        })
│
├─ 6. Handle Errors (if failed)
│     ├─ Check retries remaining
│     │  ├─ If yes:
│     │  │   ├─ Wait retryDelay
│     │  │   ├─ Apply backoff (fixed|linear|exponential)
│     │  │   └─ Retry from step 1
│     │  │
│     │  └─ If no retries left:
│     │      ├─ Check onErrorGoto
│     │      │  ├─ If set: Jump to that step
│     │      │  └─ If not: Stop execution
│     │      │
│     │      └─ If in try-catch: Execute catch block
│     │
│     └─ Optionally capture screenshot on failure
│
├─ 7. Check Control Flow
│     ├─ User abort? → Stop
│     ├─ Global timeout? → Stop
│     ├─ Breakpoint hit? → Pause
│     ├─ Jump condition met? → Jump
│     └─ Else: Continue to next step
│
└─ Return: success status + output

Output: Success/Failure + Step Result
```

---

## 🔢 Variable System

### Variable Sources (Priority Order)

1. **Built-in Variables** (read-only, auto-injected)
   ```
   {timestamp}      → ISO timestamp of run start
   {runId}          → "{workflowId}:{profileId}"
   {random}         → Random alphanumeric string
   {profileName}    → Profile's display name
   ```

2. **Workflow Default Variables**
   ```json
   {
     "keyword": "default-search-term",
     "maxPages": "5"
   }
   ```

3. **Runtime Override Variables**
   ```javascript
   runWorkflow(workflowId, profileId, {
     keyword: "user-provided-keyword"
   })
   ```

4. **Step Output Variables** (created during execution)
   ```
   extractText + saveAs:"productTitle"
   → {productTitle} available in subsequent steps
   ```

### Variable Interpolation

Every step's `params` are interpolated before execution:

```javascript
// Before interpolation
{ selector: "input", text: "{keyword}" }

// After interpolation (with keyword = "laptop")
{ selector: "input", text: "laptop" }
```

### Data Transformation (Phase 18)

Output can be transformed before storing:

```json
{
  "action": "extractText",
  "params": {
    "selector": ".price",
    "saveAs": "rawPrice"
  }
  // Output: "Price: $99.99"
}

// With transform
{
  "action": "extractText",
  "params": {
    "selector": ".price",
    "saveAs": "price",
    "transform": ["regex:\\d+\\.\\d+"]
  }
  // Output: "99.99" → {price} = "99.99"
}
```

---

## 🎛️ Control Flow Statements

### Conditional (If/Else)

```json
{
  "action": "conditional",
  "params": {
    "conditionType": "element-exists|text-contains|js-truthy|var-equals",
    "selector": ".error-message",
    "thenSteps": [ { "action": "screenshot", ... } ],
    "elseSteps": [ { "action": "click", ... } ]
  }
}
```

### Loop (Fixed Iterations)

```json
{
  "action": "loop",
  "params": {
    "times": 5,
    "steps": [
      { "action": "scroll", ... },
      { "action": "wait", ... }
    ]
  }
}
```

### While Loop (Dynamic Conditions)

```json
{
  "action": "whileLoop",
  "params": {
    "condition": "selector-exists|text-contains|js-truthy|var-equals",
    "selector": ".load-more-btn",
    "maxIterations": 10,
    "steps": [ { "action": "click", ... } ]
  }
}
```

### For Each (Data-Driven)

```json
{
  "action": "forEachRow",
  "params": {
    "filePath": "/path/to/data.csv",
    "steps": [
      {
        "action": "type",
        "params": {
          "selector": "input[name=email]",
          "text": "{email}"  // From CSV column
        }
      }
    ]
  }
}
```

### Try-Catch-Finally (Error Handling)

```json
{
  "action": "tryCatch",
  "params": {
    "tryBlock": [
      { "action": "navigate", ... }
    ],
    "catchBlock": [
      { "action": "screenshot", ... },
      { "action": "extractText", ... }
    ],
    "finallyBlock": [
      { "action": "closeTab", ... }
    ]
  }
}
```

### Jump (Conditional Goto)

```json
{
  "action": "jumpToStep",
  "params": {
    "condition": "var-equals|always",
    "targetStepId": "step-uuid",
    "variable": "errorCount",
    "value": "3"
  }
}
```

---

## 🔍 Error Handling & Recovery

### Retry Strategy

```json
{
  "action": "waitForSelector",
  "params": { "selector": ".loading" },
  "retries": 3,                          // Try 3 times
  "retryDelay": 1000,                    // 1 second between retries
  "retryBackoff": "exponential",         // 1s, 2s, 4s
  "retryOn": ["timeout", "not found"]    // Selective retry
}
```

### Error Recovery

```json
{
  "id": "main-step",
  "action": "click",
  "onErrorGoto": "fallback-step"         // Jump on failure
}

// Later in steps array...
{
  "id": "fallback-step",
  "action": "screenshot",
  "params": { "saveAs": "errorScreenshot" }
}
```

### Try-Catch Pattern

```json
{
  "action": "tryCatch",
  "params": {
    "tryBlock": [ { "action": "navigate", ... } ],
    "catchBlock": [ { "action": "screenshot", ... } ],
    "finallyBlock": [ { "action": "wait", ... } ]
  }
}
```

---

## 📊 Monitoring & Debugging

### Real-time Step Progress

IPC handlers send step results back to renderer as they execute:

```
Renderer                    Main Process
   │                             │
   │ workflows:run()             │
   ├────────────────────────→     │
   │                        Step 1: Execute
   │                        Step 2: Execute
   │                        Step 3: Execute (in progress)
   │←─────────────────────── Step results
   │                             │
   Update UI with live progress
```

### Execution History

```
Database: workflow_runs table
├─ run_id
├─ workflow_id
├─ profile_id
├─ status: completed|failed|stopped
├─ started_at
├─ completed_at
├─ duration_ms
├─ step_results: JSON array
├─ variables_snapshot: final state
└─ error: error message
```

### Metrics & Analytics

```javascript
// Query execution metrics
window.api.workflows.metrics(workflowId?)
// Returns: {
//   totalRuns: number,
//   successCount: number,
//   failureCount: number,
//   avgDurationMs: number,
//   success_rate: percentage
// }

// Per-action metrics
window.api.workflows.metrics.actions(workflowId?, limit?)
// Returns: { action, count, avg_duration_ms, success_rate }
```

### Debugging Features

1. **Breakpoints**: Pause at specific steps
2. **Step Over**: Execute one step at a time
3. **Variables Inspection**: View current variable state
4. **Pause/Resume**: Manually control execution
5. **Screenshot on Failure**: Auto-capture for debugging
6. **Per-step Timeouts**: Catch hanging steps

---

## 🗓️ Scheduled Execution

### Scheduler Architecture

```
App Start
  ↓
WorkflowScheduler.start()
  ↓
Set interval: tick() every 30s
  ├─ Check enabled schedules
  ├─ Compare cron expression with current time
  ├─ If due:
  │  ├─ Auto-launch profiles (if not running)
  │  ├─ Execute workflow via AutomationEngine
  │  ├─ Record last_run_at
  │  └─ Calculate next_run_at
  └─ Loop
```

### Cron Expressions

```
Field              Allowed Values
─────────────────────────────────
minute             0-59
hour               0-23
day-of-month       1-31
month              1-12
day-of-week        0-6 (0=Sunday)

Syntax:
*      Any value
,      Multiple values (0,15,30,45)
-      Range (1-5)
*/n    Step values (*/5 = every 5)

Examples:
0 9 * * MON         Every Monday at 9:00 AM
*/30 * * * *        Every 30 minutes
0 0 1 * *           First day of month at midnight
0 8-17 * * 1-5      Every hour 8 AM-5 PM, Mon-Fri
```

### Schedule Management

```javascript
// Create schedule
window.api.schedules.create({
  name: "Daily Scraper",
  workflow_id: "uuid",
  profile_ids: ["uuid1", "uuid2"],
  cron: "0 9 * * *",
  enabled: true
})

// List schedules
window.api.schedules.list()

// Update schedule
window.api.schedules.update(scheduleId, updates)

// Delete schedule
window.api.schedules.delete(scheduleId)

// Manual trigger
window.api.schedules.runNow(scheduleId)
```

---

## 🌐 External API Control

### REST API Endpoints

```
POST /api/workflows/{workflowId}/run
  Body: { profileId, variables }
  Returns: AutomationRunResult

GET /api/workflows/{workflowId}/runs
  Returns: AutomationRunResult[]

GET /api/workflows/{workflowId}/runs/{runId}
  Returns: AutomationRunResult (full details)

POST /api/workflows/{workflowId}/stop
  Body: { profileId }
  Stops running execution
```

### Authentication

```javascript
// Start API server with token
{
  "apiServer": {
    "enabled": true,
    "port": 9222,
    "authToken": "secret-bearer-token"
  }
}

// Call with token
curl -H "Authorization: Bearer secret-bearer-token" \
  http://localhost:9222/api/workflows/uuid/run
```

---

## 🎬 Recording & Refinement

### Recording Flow

```
User performs actions in browser
  ↓
Recorder captures: click, type, navigate, etc.
  ↓
Recording Refiner (AI-powered)
  ├─ Simplify selectors
  ├─ Add waits between actions
  ├─ Add natural delays to type actions
  └─ Suggest variable extraction
  ↓
Suggested workflow shown to user
  ├─ User can edit steps
  ├─ User can add missing steps
  └─ User can test before saving
  ↓
Save as new workflow
```

---

## 🤖 AI-Assisted Workflows (Phase 16)

### Natural Language Generation

```javascript
window.api.ai.generateWorkflow({
  description: "Login to Shopee and search for laptops",
  profileId: "uuid"
})
// Returns: Suggested AutomationWorkflow
```

### Smart Selector Healing

```javascript
window.api.ai.healSelector({
  previousSelector: ".old-selector",
  htmlSnippet: "<div class='new-selector'>...",
  workflowId: "uuid"
})
// Returns: Suggested new selector
```

### Detection Analysis

```javascript
window.api.ai.analyzeDetection({
  detectionResults: DetectionTestResult[],
  profileId: "uuid"
})
// Returns: Recommendations to improve fingerprint
```

---

## 📁 Database Schema

### workflows table

```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  steps TEXT NOT NULL,          -- JSON array
  variables TEXT,               -- JSON object
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### workflow_runs table

```sql
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  status TEXT NOT NULL,         -- completed|failed|stopped
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  duration_ms INTEGER,
  step_results TEXT,            -- JSON array
  variables_snapshot TEXT,      -- JSON object
  error TEXT
)
```

### schedules table

```sql
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  profile_ids TEXT NOT NULL,    -- JSON array
  cron TEXT NOT NULL,
  enabled BOOLEAN,
  last_run_at TEXT,
  next_run_at TEXT,
  created_at TEXT NOT NULL
)
```

---

## 🔗 Integration Points

### With Fingerprint Engine
- Each profile run uses its fingerprint configuration
- Anti-detect features active during automation
- Detection vectors measured after workflow

### With Proxy Manager
- Workflow can switch proxies mid-execution
- `switchProxy` action rotates to new proxy
- Proxy health checked before use

### With Credential Vault
- `useCredential` action fetches encrypted secrets
- Credentials auto-injected into steps
- Vault keys never logged

### With Detection Testing
- Post-workflow detection test available
- Results stored with run history
- Flagged if detection score increased

### With Behavior Simulation
- Human-like typing delays
- Mouse movement jitter
- Natural scroll patterns
- Applied during automation steps

---

## 🚀 Performance Considerations

### Concurrency Limits
- Default parallel execution: 5 concurrent profiles
- Configurable via `concurrency` parameter
- Each profile gets own browser instance

### Memory Usage
- Each Chromium profile: ~150-300 MB
- Parallel execution scales linearly with profiles
- Monitor system resources before large batch runs

### Network Throttling
- Can simulate slow networks
- Per-step timeouts prevent hanging
- Global workflow timeout available

### Database
- Workflow runs stored indefinitely
- Consider archiving old runs periodically
- Indexed queries on workflow_id, profile_id

---

## 📝 Summary Flow Diagram

```
Create Workflow
      │
      ├─ From scratch
      ├─ From template
      ├─ From recording
      └─ From AI (Phase 16)
      │
      ▼
Store in Database
      │
      ├─ Add to library
      └─ Available for reuse
      │
      ▼
Run Workflow
      ├─ Single profile
      ├─ Parallel batch
      ├─ Scheduled (cron)
      └─ External API
      │
      ▼
Execute Steps
      ├─ Interpolate variables
      ├─ Execute action (60+ types)
      ├─ Store outputs
      ├─ Handle errors & retries
      └─ Check control flow
      │
      ▼
Record Results
      ├─ Save to database
      ├─ Display in UI
      └─ Available for analysis
      │
      ▼
Monitor & Debug
      ├─ View step results
      ├─ Inspect variables
      ├─ Set breakpoints
      └─ Replay execution
```

---

**Status**: Complete implementation with phases 1-18 features active
