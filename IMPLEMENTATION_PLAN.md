# 🔧 Nav Automation Critical Fixes - Implementation Plan

**Branch:** `nav-automation-critical-fixes`
**Based on:** `NAV_AUTOMATION_ANALYSIS.md`
**Priority:** MUST FIX before production release

---

## Fix #1: whileLoop MAX_ITERATIONS Limit ⚠️ CRITICAL

### Problem
```javascript
case 'whileLoop': {
  // while (condition) { execute steps }
  // IF CONDITION ALWAYS TRUE → INFINITE LOOP
  // App hangs forever
}
```

### Solution
```javascript
const MAX_ITERATIONS = 10_000
const MAX_ITERATION_TIME = 300_000  // 5 minutes total max

case 'whileLoop': {
  const condition = params.condition  // 'selector-exists', etc.
  const innerSteps = params.steps ?? []
  const timeoutPerStep = params.timeoutMs ?? 5000
  
  let iterations = 0
  const startTime = Date.now()
  
  while (iterations < MAX_ITERATIONS) {
    if (Date.now() - startTime > MAX_ITERATION_TIME) {
      throw new Error(`whileLoop exceeded ${MAX_ITERATIONS} iterations or 5min timeout`)
    }
    
    // Evaluate condition
    let matched = false
    if (condition === 'selector-exists') {
      matched = !!(await page.$(params.selector).catch(() => null))
    } else if (condition === 'selector-missing') {
      matched = !(await page.$(params.selector).catch(() => null))
    }
    // ... other condition types
    
    if (!matched) break  // Condition false → exit
    
    // Execute loop steps with timeout
    const loopStatus = await this.executeSteps(page, innerSteps, control, allResults, variables)
    if (loopStatus === 'stopped') throw new Error('Workflow stopped')
    if (loopStatus === 'failed') throw new Error(`whileLoop iteration ${iterations + 1} failed`)
    
    iterations++
  }
  
  if (iterations >= MAX_ITERATIONS) {
    throw new Error(`whileLoop exceeded max ${MAX_ITERATIONS} iterations`)
  }
  
  return { iterations, timeout: false }
}
```

### Files to modify
- `src/main/automation.ts` (line ~2805)

### Test cases
- ✅ whileLoop exits when condition becomes false
- ✅ whileLoop throws at 10,000 iterations
- ✅ whileLoop throws after 5 minutes
- ✅ Error message clear

---

## Fix #2: forEachElement Stale Handle Issue 🔴 BLOCKER

### Problem
```javascript
case 'forEachElement': {
  const elements = await page.$$(selector)  // Get all handles
  for (const el of elements) {
    await el.click()  // DOM changed → handle is stale → ERROR
  }
}
```

### Solution: Re-fetch selector per iteration
```javascript
case 'forEachElement': {
  const selector = params.selector
  const innerSteps = params.steps ?? []
  const limit = Math.min(Number(params.limit ?? 0) || 1000, 1000)  // MAX 1000
  
  // First pass: count matching elements
  const count = await page.$$eval(selector, (els) => els.length).catch(() => 0)
  
  if (count === 0) {
    throw new Error(`forEachElement: no elements matching "${selector}"`)
  }
  
  if (count > 1000) {
    throw new Error(`forEachElement: ${count} elements exceed max 1000 (limit param)`)
  }
  
  const maxIter = limit > 0 ? Math.min(count, limit) : count
  let completed = 0
  
  for (let idx = 0; idx < maxIter; idx++) {
    if (control.abort) throw new Error('Workflow stopped')
    
    // RE-FETCH the selector each iteration (safer than cached handles)
    const elements = await page.$$(selector).catch(() => [])
    if (idx >= elements.length) break  // All elements consumed
    
    const el = elements[idx]
    
    // Inject iteration variables
    variables['_element.index'] = String(idx)
    variables['_element.total'] = String(maxIter)
    
    try {
      const status = await this.executeSteps(page, innerSteps, control, allResults, variables)
      if (status === 'stopped') throw new Error('Workflow stopped')
      if (status === 'failed') throw new Error(`Iteration ${idx + 1} failed`)
      completed++
    } finally {
      delete variables['_element.index']
      delete variables['_element.total']
    }
  }
  
  return { matched: count, completed, failed: count - completed }
}
```

### Alternative: Use index-based approach (even safer)
```javascript
// Don't loop over handles — loop over indices, fetch fresh per iteration
for (let idx = 0; idx < maxIter; idx++) {
  const el = await page.$$(selector).then((els) => els[idx])
  if (!el) break
  
  // Execute steps targeting this specific element
  // (most steps work on page context, not element handles)
}
```

### Files to modify
- `src/main/automation.ts` (line ~2680)
- `src/shared/types.ts` (add `limit` param to forEachElement)

### Test cases
- ✅ forEachElement with 10 elements → completes all 10
- ✅ forEachElement with 5000 elements → throws MAX_ELEMENTS error
- ✅ forEachElement with DOM changes during loop → handles stale refs
- ✅ forEachElement with limit param → stops at limit

---

## Fix #3: File Path Validation in readFile/writeFile 🔒 SECURITY

### Problem
```javascript
case 'readFile': {
  const filePath = params.filePath  // Could be: /etc/passwd, ../../../.env
}
```

### Solution: Whitelist user-data directory
```javascript
import { resolve as pathResolve, normalize, relative } from 'path'
import { app } from 'electron'

const USER_DATA_DIR = app.getPath('userData')

function validateFilePath(filePath: string): string {
  if (!filePath) throw new Error('filePath required')
  
  // Reject absolute paths outside userData
  if (path.isAbsolute(filePath)) {
    const normalized = pathResolve(filePath)
    const rel = relative(USER_DATA_DIR, normalized)
    
    // If relative path starts with .., it's outside userData
    if (rel.startsWith('..')) {
      throw new Error(`File access denied: ${filePath} is outside userData directory`)
    }
    return normalized
  }
  
  // For relative paths, resolve within userData
  const normalized = pathResolve(USER_DATA_DIR, filePath)
  const rel = relative(USER_DATA_DIR, normalized)
  
  if (rel.startsWith('..')) {
    throw new Error(`File access denied: cannot access ../../../ paths`)
  }
  
  return normalized
}

case 'readFile': {
  const filePath = validateFilePath(params.filePath)
  const enc = (params.encoding ?? 'utf-8') as BufferEncoding
  const text = await fsReadFile(filePath, enc)
  // ...
}

case 'writeFile': {
  const filePath = validateFilePath(params.filePath)
  const content = params.content ?? ''
  const enc = (params.encoding ?? 'utf-8') as BufferEncoding
  await mkdir(dirname(filePath), { recursive: true })
  // ...
}
```

### Files to modify
- `src/main/automation.ts` (line ~1626, ~1649)
- Add `validateFilePath()` utility function

### Test cases
- ✅ readFile with relative path → allowed
- ✅ readFile with `../../../etc/passwd` → BLOCKED
- ✅ readFile with `/etc/passwd` → BLOCKED
- ✅ writeFile creates parent dirs only within userData → OK

---

## Fix #4: Credential Audit Logging 📋 COMPLIANCE

### Problem
```javascript
case 'useCredential': {
  const cred = vault.get(id)
  // No logging of who accessed which credential
}
```

### Solution: Log to audit_log table
```javascript
case 'useCredential': {
  const vault = getVault()
  if (!vault.isUnlocked()) {
    throw new Error('Vault is locked')
  }
  
  const id = params.id
  const label = params.label
  let cred
  if (id) {
    cred = vault.get(id)
  } else if (label) {
    const list = vault.list()
    cred = list.find((c) => c.label === label)
  }
  
  // ADD AUDIT LOG
  const db = Database.getInstance()
  try {
    db.insertAuditLog({
      user_id: 'system',  // Or extract from IPC context
      user_name: 'automation',
      action: 'credential_access',
      target_id: cred.id,
      target_name: cred.label,
      timestamp: new Date().toISOString(),
      ip_address: 'localhost',
      metadata: {
        workflow_id: step.workflowId,  // If available
        step_id: step.id,
        action: 'useCredential'
      }
    })
  } catch (e) {
    console.error('[audit] failed to log credential access:', e)
  }
  
  // Return credential as usual
  return { loaded: true, label: cred.label, ... }
}
```

### Files to modify
- `src/main/automation.ts` (line ~1801)
- `src/main/database.ts` (add insertAuditLog method if not exists)

### Test cases
- ✅ Each useCredential creates audit_log entry
- ✅ Audit log includes credential label, timestamp, workflow_id
- ✅ Failed audit doesn't block credential access

---

## Fix #5: Regex Pattern Validation at Parse Time ✔️

### Problem
```javascript
params.pattern = "(?P<name>..."  // Invalid regex
// Error only happens at runtime when action executes
```

### Solution: Validate in step validation phase
```javascript
function validateRegexPattern(pattern: string | undefined): void {
  if (!pattern) return
  try {
    new RegExp(pattern)
  } catch (e: any) {
    throw new Error(`Invalid regex pattern: ${e.message}`)
  }
}

// In executeWorkflow, before executing steps:
for (const step of workflow.steps) {
  if (step.action === 'whileLoop' && step.params?.pattern) {
    validateRegexPattern(step.params.pattern)
  }
  if (step.action === 'waitForRequest' && step.params?.pattern) {
    validateRegexPattern(step.params.pattern)
  }
  if (step.action === 'waitForResponse' && step.params?.pattern) {
    validateRegexPattern(step.params.pattern)
  }
  if (step.action === 'waitForDownload' && step.params?.pattern) {
    validateRegexPattern(step.params.pattern)
  }
  // ... other actions with regex
}
```

### Files to modify
- `src/main/automation.ts` (add validateRegexPattern function, call in executeWorkflow)

### Test cases
- ✅ Valid regex pattern → passes
- ✅ Invalid regex pattern → throws at parse time
- ✅ Error message is clear

---

## Fix #6: whileLoop Iteration Timeout (SHOULD FIX)

### Implementation
```javascript
case 'whileLoop': {
  const timeoutPerIteration = params.timeoutMs ?? 5000  // 5s default
  
  while (iterations < MAX_ITERATIONS) {
    const iterStart = Date.now()
    
    // Execute loop steps
    const loopStatus = await Promise.race([
      this.executeSteps(page, innerSteps, control, allResults, variables),
      new Promise((_, rej) => setTimeout(
        () => rej(new Error(`Iteration timeout after ${timeoutPerIteration}ms`)),
        timeoutPerIteration
      ))
    ])
    
    const iterDuration = Date.now() - iterStart
    if (iterDuration > timeoutPerIteration * 2) {
      console.warn(`[whileLoop] iteration took ${iterDuration}ms (timeout: ${timeoutPerIteration}ms)`)
    }
    
    iterations++
  }
}
```

---

## Fix #7: Element Count Limit (SHOULD FIX)

### Implementation
```javascript
case 'forEachElement': {
  const count = await page.$$eval(selector, (els) => els.length).catch(() => 0)
  
  const MAX_ELEMENTS = 1000
  if (count > MAX_ELEMENTS) {
    throw new Error(
      `forEachElement: ${count} elements exceed max ${MAX_ELEMENTS}. ` +
      `Use limit param or adjust selector to be more specific.`
    )
  }
}
```

---

## Implementation Order

1. **Week 1 (MUST FIX):**
   - [ ] Add MAX_ITERATIONS to whileLoop (#1)
   - [ ] Fix forEachElement stale handles (#2)
   - [ ] Add file path validation (#3)

2. **Week 2 (MUST FIX + SHOULD FIX):**
   - [ ] Add credential audit logging (#4)
   - [ ] Add regex validation (#5)
   - [ ] Add iteration timeout to whileLoop (#6)

3. **Week 3 (Polish):**
   - [ ] Add element count limit (#7)
   - [ ] Update error messages
   - [ ] Add integration tests

---

## Testing Strategy

### Unit Tests
- `tests/unit/automation-whileloop.test.ts` — MAX_ITERATIONS, timeout
- `tests/unit/automation-foreach.test.ts` — stale handles, element count
- `tests/unit/automation-filepath.test.ts` — file path validation
- `tests/unit/automation-regex.test.ts` — regex validation

### Integration Tests
- Test full workflows with fixes applied
- Test error cases and edge conditions

---

## Rollback Plan

Each fix is independent:
1. Revert commit if issue found
2. All fixes behind feature flags (optional)
3. Gradual rollout: beta users first

---

## Success Criteria

| Fix | Success Criterion |
|-----|-------------------|
| whileLoop limit | No more infinite loops; clear error at 10k iterations |
| forEachElement | 95%+ success rate (up from 62%) |
| File path validation | All LFI attempts blocked |
| Audit logging | 100% of useCredential logged |
| Regex validation | Zero runtime regex errors |

---

**Next:** Start implementing Fix #1 (whileLoop)
