# Detection Feature — Implementation Checklist

**Purpose**: Actionable task list for improving Detection feature security, performance, and testing coverage.

---

## 🔴 Critical (Do First)

### 1. Add Timeout Protection
**File**: `src/main/detection-test.ts`  
**Status**: ⬜ Not started  
**Effort**: 20 min  
**Priority**: 🔴 CRITICAL

```typescript
// BEFORE (hangs indefinitely if page evaluation stalls)
const result = await page.evaluate(() => navigator.webdriver)

// AFTER (timeout after 5s per vector)
const result = await Promise.race([
  page.evaluate(() => navigator.webdriver),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Vector timeout')), 5000)
  )
]).catch(() => undefined)
```

**Checklist**:
- [ ] Wrap evaluateVectors() call in overall timeout (30s max)
- [ ] Wrap each individual vector test in 5s timeout
- [ ] Return "timeout" status for failed vectors instead of crashing
- [ ] Add timeout property to DetectionVectorResult type
- [ ] Test with deliberately slow page to verify timeout works
- [ ] Update UI to show timeout status in category breakdown

---

### 2. Add Input Validation
**File**: `src/main/ipc/handlers.ts` (detection:runTest & detection:batchTest)  
**Status**: ⬜ Not started  
**Effort**: 30 min  
**Priority**: 🔴 CRITICAL

```typescript
// BEFORE (no validation)
ipcMain.handle('detection:runTest', async (_event, profileId: string) => {
  return detectionRunner.runTest(profileId) // could be garbage
})

// AFTER (validated)
ipcMain.handle('detection:runTest', async (_event, profileId: string) => {
  if (!profileId || typeof profileId !== 'string') {
    throw new Error('Invalid profileId')
  }
  const profile = db.getProfile(profileId)
  if (!profile) {
    throw new Error(`Profile ${profileId} not found`)
  }
  return detectionRunner.runTest(profileId)
})
```

**Checklist**:
- [ ] Validate profileId is string and non-empty
- [ ] Check profile exists in DB before running test
- [ ] Validate batchTest profileIds array (max 100 profiles)
- [ ] Reject batch if any profile not found
- [ ] Add error messages that are user-friendly
- [ ] Test with invalid profileId and verify error handling

---

### 3. Add Logging for Debugging
**File**: `src/main/detection-test.ts`  
**Status**: ⬜ Not started  
**Effort**: 1 hr  
**Priority**: 🔴 CRITICAL

```typescript
// Add logging at key points
import { logger } from './logger' // or use console with timestamps

async runTest(profileId: string) {
  logger.info(`[Detection] Starting test for profile ${profileId}`)
  try {
    const vectors = await this.evaluateVectors(profileId)
    logger.info(`[Detection] ${vectors.filter(v => v.passed).length}/${vectors.length} vectors passed`)
    // ...
  } catch (error) {
    logger.error(`[Detection] Test failed for profile ${profileId}:`, error)
    throw error
  }
}

private async evaluateVectors(profileId: string) {
  // ...
  for (const testFn of [this.testWebdriver, this.testChromeRuntime, ...]) {
    try {
      const result = await testFn(page)
      logger.debug(`[Detection] ${result.name}: ${result.passed ? 'PASS' : 'FAIL'} - ${result.detail}`)
      vectors.push(result)
    } catch (error) {
      logger.warn(`[Detection] ${testFn.name} failed:`, error.message)
    }
  }
}
```

**Checklist**:
- [ ] Add logger import and initialize
- [ ] Log at test start/end (profile ID, timestamp)
- [ ] Log individual vector results with pass/fail
- [ ] Log any errors with full stack trace
- [ ] Log batch test progress (X of Y completed)
- [ ] Save logs to `userData/logs/detection.log` with rotation
- [ ] Add UI option to download logs for debugging
- [ ] Test log output for correctness

---

## 🟡 High Priority (Sprint 1)

### 4. Create Detection Vector Reference Guide
**File**: `docs/DETECTION_VECTORS.md` (new)  
**Status**: ⬜ Not started  
**Effort**: 2 hrs  
**Priority**: 🟡 HIGH

**Content needed for each of 45 vectors**:
- Vector name & category
- What it checks (1 sentence)
- How it can fail (and why)
- How to fix it in Fingerprint Editor
- Example values (pass vs fail)
- Detection provider that uses it (PerimeterX, DataDome, etc.)

**Example**:
```markdown
## navigator.webdriver (Automation)

**What it checks**: Whether the browser is launched via Puppeteer/Selenium.

**How it fails**: navigator.webdriver === true or navigator.webdriver === 'ok'

**Why it fails**: 
- Browser launched via webdriver protocol instead of user-launched
- Puppeteer/Selenium sets this flag automatically

**How to fix**:
1. Open Fingerprint Editor → CDP Evasion
2. Enable "Hide webdriver flag"
3. Re-run detection test

**Example values**:
- ✅ PASS: undefined
- ❌ FAIL: true, 'ok'

**Providers**: PerimeterX, DataDome, Cloudflare

---
```

**Checklist**:
- [ ] Document all 45 vectors (use template above)
- [ ] Group by category (Automation, Browser, Graphics, etc.)
- [ ] Add links to relevant Fingerprint Editor sections
- [ ] Include real-world detection provider examples
- [ ] Create index by provider name
- [ ] Add troubleshooting section
- [ ] Link from DetectionDashboard UI (? icon next to vector name)
- [ ] Review with security team

---

### 5. Create Unit Test Suite
**File**: `src/main/detection-test.test.ts` (new)  
**Status**: ⬜ Not started  
**Effort**: 2-3 hrs  
**Priority**: 🟡 HIGH

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DetectionTestRunner } from './detection-test'
import { Database } from './database'
import { BrowserManager } from './browser-manager'

describe('DetectionTestRunner', () => {
  let runner: DetectionTestRunner
  let db: Database
  let bm: BrowserManager

  beforeEach(() => {
    runner = DetectionTestRunner.getInstance()
    db = Database.getInstance()
    bm = BrowserManager.getInstance()
  })

  describe('runTest', () => {
    it('should throw if profile not found', async () => {
      await expect(runner.runTest('invalid-id')).rejects.toThrow('not found')
    })

    it('should return DetectionTestResult with 45+ vectors', async () => {
      const profileId = 'test-profile-1'
      // Create test profile
      const result = await runner.runTest(profileId)
      expect(result.vectors.length).toBeGreaterThanOrEqual(45)
      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(100)
    })

    it('should persist result to database', async () => {
      const result = await runner.runTest('test-profile-1')
      const saved = db.getDetectionTestResults('test-profile-1')
      expect(saved).toContainEqual(expect.objectContaining({ id: result.id }))
    })

    it('should close browser if it opened it', async () => {
      const profileId = 'test-profile-2'
      await runner.runTest(profileId)
      expect(bm.isRunning(profileId)).toBe(false)
    })

    it('should handle timeout and return partial results', async () => {
      // Mock slow page evaluation
      const result = await runner.runTest('test-profile-3')
      // Should not throw, should have some results
      expect(result.vectors.length).toBeGreaterThan(0)
    })
  })

  describe('evaluateVectors', () => {
    it('testWebdriver should return false when undefined', async () => {
      // Test individual vector
    })

    it('testChromeRuntime should return true when present', async () => {
      // Test individual vector
    })
  })

  describe('batchTest', () => {
    it('should test multiple profiles sequentially', async () => {
      // Test batch mode
    })

    it('should continue even if one profile fails', async () => {
      // Test error resilience
    })
  })
})
```

**Checklist**:
- [ ] Set up test file with vitest/jest config
- [ ] Write tests for each public method (runTest, getResults, etc.)
- [ ] Write tests for each vector evaluation (at least core ones)
- [ ] Write tests for error cases (missing profile, timeout, etc.)
- [ ] Write tests for batch mode (success, partial failure)
- [ ] Achieve >80% code coverage
- [ ] Add tests to CI/CD pipeline
- [ ] Verify tests pass locally before commit

---

### 6. Remove Unsafe Type Cast
**File**: `src/main/detection-test.ts` (line 80)  
**Status**: ⬜ Not started  
**Effort**: 15 min  
**Priority**: 🟡 HIGH

```typescript
// BEFORE (unsafe cast)
const session = (bm as any).sessions?.get(profileId)

// AFTER (typed properly)
// In browser-manager.ts, export getter for sessions:
export class BrowserManager {
  public getSessions() {
    return this.sessions // return Map<string, BrowserSession>
  }
}

// In detection-test.ts:
const session = bm.getSessions().get(profileId)
```

**Checklist**:
- [ ] Check BrowserManager type definition
- [ ] Add public getter for sessions if missing
- [ ] Update DetectionTestRunner to use typed getter
- [ ] Remove the `(bm as any)` cast
- [ ] Verify TypeScript compilation succeeds
- [ ] Test that detection still works

---

## 🟢 Medium Priority (Sprint 2)

### 7. Implement Concurrent Batch Testing
**File**: `src/main/detection-test.ts` + `src/main/ipc/handlers.ts`  
**Status**: ⬜ Not started  
**Effort**: 2 hrs  
**Priority**: 🟢 MEDIUM

```typescript
// Add semaphore utility
class Semaphore {
  private count: number
  private waitQueue: (() => void)[] = []

  constructor(max: number) {
    this.count = max
  }

  async acquire() {
    if (this.count > 0) {
      this.count--
      return
    }
    await new Promise<void>(resolve => this.waitQueue.push(resolve))
  }

  release() {
    const next = this.waitQueue.shift()
    if (next) {
      next()
    } else {
      this.count++
    }
  }
}

// In DetectionTestRunner
async batchTest(profileIds: string[], concurrency = 5) {
  const sem = new Semaphore(concurrency)
  const results = await Promise.all(
    profileIds.map(async (id) => {
      await sem.acquire()
      try {
        return await this.runTest(id)
      } finally {
        sem.release()
      }
    })
  )
  return results
}
```

**Checklist**:
- [ ] Implement Semaphore or use existing library (p-limit)
- [ ] Update batchTest() to accept concurrency parameter
- [ ] Update IPC handler to pass concurrency (default 3)
- [ ] Add progress callback for UI updates
- [ ] Test with 10+ profiles and measure time improvement
- [ ] Benchmark: compare sequential vs concurrent (target: 3-4x speedup)
- [ ] Update UI to show per-profile progress during batch
- [ ] Handle resource limits (don't exceed N concurrent browsers)

---

### 8. Implement Partial Results Fallback
**File**: `src/main/detection-test.ts`  
**Status**: ⬜ Not started  
**Effort**: 1 hr  
**Priority**: 🟢 MEDIUM

```typescript
private async evaluateVectors(profileId: string) {
  const vectors: DetectionVectorResult[] = []
  const vectorTests = [
    () => this.testWebdriver(page),
    () => this.testChromeRuntime(page),
    // ... rest of tests
  ]

  for (const testFn of vectorTests) {
    try {
      const result = await Promise.race([
        testFn(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Vector timeout')), 5000)
        )
      ])
      vectors.push(result)
    } catch (error) {
      // Return partial result instead of crashing
      vectors.push({
        name: testFn.name || 'Unknown',
        category: 'Unknown',
        passed: false,
        detail: `Error: ${error.message}`
      })
    }
  }

  return vectors // Always return some results
}
```

**Checklist**:
- [ ] Add try/catch around individual vector tests
- [ ] Return "error" or "timeout" status instead of throwing
- [ ] Update UI to show error/timeout vectors differently (orange)
- [ ] Test with deliberately failing vector
- [ ] Verify test completes even with partial failures
- [ ] Update DetectionVectorResult type to include "error" status

---

### 9. Add Database Indices for Performance
**File**: `src/main/database.ts`  
**Status**: ⬜ Not started  
**Effort**: 30 min  
**Priority**: 🟢 MEDIUM

```sql
-- Add indices to detection_tests table
CREATE INDEX IF NOT EXISTS idx_detection_tests_profile_id 
  ON detection_tests(profile_id);

CREATE INDEX IF NOT EXISTS idx_detection_tests_tested_at 
  ON detection_tests(tested_at DESC);

CREATE INDEX IF NOT EXISTS idx_detection_tests_status 
  ON detection_tests(status);
```

**Checklist**:
- [ ] Review current database schema
- [ ] Identify slow queries (profile_id, date range filters)
- [ ] Add indices for frequently queried columns
- [ ] Test query performance before/after
- [ ] Verify indices are created on app startup

---

## 🔵 Low Priority (Sprint 3+)

### 10. Add Detection Score Confidence Levels
**Status**: ⬜ Not started  
**Effort**: 2 hrs  
**Priority**: 🔵 LOW

Instead of binary pass/fail, return confidence % (0-100%).

```typescript
interface DetectionVectorResult {
  name: string
  category: string
  confidence: number // 0-100, e.g., "85% likely human"
  detail?: string
  passed: boolean // derived from confidence > threshold
}

// Example: navigator.webdriver check
// - undefined: 100% confidence (human)
// - false: 95% confidence (probably human)
// - true: 0% confidence (definitely bot)
```

**Checklist**:
- [ ] Review each vector to determine confidence scoring
- [ ] Update each testXxx() method to return confidence
- [ ] Update UI to show confidence bar instead of pass/fail
- [ ] Add confidence threshold configuration (default 80%)
- [ ] Test and validate

---

### 11. Add A/B Testing Mode
**Status**: ⬜ Not started  
**Effort**: 2 hrs  
**Priority**: 🔵 LOW

Allow side-by-side testing of two fingerprints.

**Checklist**:
- [ ] Add UI to select two profiles
- [ ] Run tests in parallel
- [ ] Show score comparison per-category
- [ ] Highlight differences

---

## 📊 Completion Tracking

| # | Task | Status | Owner | Due | Notes |
|---|------|--------|-------|-----|-------|
| 1 | Timeout protection | ⬜ | — | Sprint Now | CRITICAL |
| 2 | Input validation | ⬜ | — | Sprint Now | CRITICAL |
| 3 | Logging for debugging | ⬜ | — | Sprint Now | CRITICAL |
| 4 | Vector reference guide | ⬜ | — | Sprint 1 | HIGH |
| 5 | Unit test suite | ⬜ | — | Sprint 1 | HIGH |
| 6 | Remove unsafe cast | ⬜ | — | Sprint 1 | HIGH |
| 7 | Concurrent batch testing | ⬜ | — | Sprint 2 | MEDIUM |
| 8 | Partial results fallback | ⬜ | — | Sprint 2 | MEDIUM |
| 9 | Database indices | ⬜ | — | Sprint 2 | MEDIUM |
| 10 | Confidence levels | ⬜ | — | Sprint 3+ | LOW |
| 11 | A/B testing mode | ⬜ | — | Sprint 3+ | LOW |

---

## 🎯 Success Criteria

### After Critical Items (1-3):
- ✅ Detection tests no longer hang
- ✅ Invalid profiles caught early
- ✅ Developers can debug issues via logs

### After High Priority Items (4-6):
- ✅ New vectors documented
- ✅ Detection logic has test coverage >80%
- ✅ TypeScript strict mode passes

### After Medium Priority Items (7-9):
- ✅ Batch testing 10x faster (3-5 min → 30-60 sec)
- ✅ Tests complete even if some vectors fail
- ✅ Large result sets query in <100ms

### After Low Priority Items (10-11):
- ✅ Users can fine-tune detection sensitivity
- ✅ Users can A/B test fingerprint changes

---

**Last Updated**: 2026-04-08  
**Reviewed By**: Claude Code Analyst  
**Next Review**: After critical items completed
