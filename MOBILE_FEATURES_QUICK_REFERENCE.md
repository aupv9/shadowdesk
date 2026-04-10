# Mobile Workflow Features — Quick Reference Guide
**Version 1.0** | **For**: Developers & Product Team | **Updated**: 2026-04-10

---

## 🎯 Feature Quick Overview

### Core 5 Gesture Actions
```
TAP POINT      → Tap at x,y with jitter (±2px)
SWIPE          → Animated swipe (800-1200ms)
PINCH          → Multi-touch zoom (scale 0.5-2.5x)
LONG PRESS     → Hold 500-2000ms
DOUBLE TAP     → Rapid 2x tap
```

### Core 4 Sensor Actions
```
SET LOCATION   → Mock geolocation (lat/lng)
SET ACCEL      → Simulate device motion (x,y,z)
SET BATTERY    → Mock battery level + charging
SET NETWORK    → Simulate 2G/3G/4G/5G (Phase 19)
```

### 10 Behavior Archetypes
```
1. casual_browser      — Slow, random (200-500ms delays)
2. power_user          — Fast, efficient (50-150ms delays)
3. bot_evasion         — Highly randomized anti-detection
4. rapid_interactor    — Very fast (30-80ms delays)
5. mobile_native       — Phone-specific gestures
6. careful_shopper     — Lingers on products
7. bulk_operator       — High action count, minimal pause
8. social_lurker       — Lots of scrolling
9. form_filler         — Deliberate typing + accuracy
10. idler              — Long pauses, occasional activity
```

---

## 📊 Database Quick Reference

### Tables Created (Phase 17)
```
mobile_workflows       → Store workflows
mobile_execution_logs  → Track executions
mobile_device_state    → Device connection state
gesture_templates      → Pre-built gesture configs
behavior_patterns      → 10 archetypes + custom
mobile_batch_executions → Batch execution history
```

### Key Columns
```
mobile_workflows:
  - id (PK)
  - name, description
  - steps (JSON array)
  - device_config (JSON: profiles, execution_mode)
  - behavior_pattern (string)

mobile_execution_logs:
  - id (PK)
  - workflow_id, profile_id
  - status ("success" | "failed" | "timeout")
  - metrics (tap_count, swipe_count, etc)
  - sensor_state (JSON)
  - screenshots (base64 encoded)
```

---

## 🔌 IPC Channels at a Glance

### Workflow Management
```typescript
// Create workflow
window.api.mobileWorkflow.create({
  name: "Shopee Lister",
  steps: [...],
  deviceConfig: { targetProfiles: [...], executionMode: "parallel" }
})
→ { id: "wf-123" }

// List all
window.api.mobileWorkflow.list()
→ { workflows: [...] }

// Execute
window.api.mobileWorkflow.execute({
  workflowId: "wf-123",
  profileIds: ["profile-1", "profile-2"],
  mode: "parallel"
})
→ { executionId: "exec-456" }

// Status (real-time)
window.api.mobileExecution.status({ executionId: "exec-456" })
→ {
    id: "exec-456",
    overallProgress: 45,
    profileStatus: {
      "profile-1": { currentStepId: "s5", status: "running", ... },
      "profile-2": { currentStepId: "s3", status: "running", ... }
    }
  }
```

### Behavior Patterns
```typescript
// List archetypes
window.api.mobileBehavior.list()
→ [
    { id: "bp-casual", name: "casual_browser", archetype: "casual_browser", ... },
    { id: "bp-power", name: "power_user", archetype: "power_user", ... },
    ...
  ]

// Apply to workflow
window.api.mobileBehavior.apply({
  workflowId: "wf-123",
  patternName: "casual_browser"
})
→ { modified_workflow: { steps: [...modified with delays...] } }
```

### Device Management
```typescript
// List connected devices
window.api.mobileDevice.list()
→ {
    devices: [
      { id: "adb-123", name: "Samsung A54", type: "android", isConnected: true },
      { id: "ios-456", name: "iPhone 14", type: "ios", isConnected: false }
    ]
  }

// Connect real device
window.api.mobileDevice.connect({ deviceId: "adb-123" })
→ { success: true }
```

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────┐
│   React UI                      │
│   (MobileWorkflowBuilder)       │
└──────────────┬──────────────────┘
               │
         IPC (mobileWorkflow:*)
               │
┌──────────────↓──────────────────┐
│  MobileWorkflowEngine           │
│  ├─ GestureHandler              │
│  ├─ SensorSimulator             │
│  ├─ BehaviorInjector            │
│  └─ RealDeviceConnector         │
└──────────────┬──────────────────┘
               │
         Puppeteer/CDP
               │
┌──────────────↓──────────────────┐
│  Chromium Mobile Emulation      │
│  (Android 13/14, iOS 17)        │
└─────────────────────────────────┘
```

---

## 📝 Sample Workflow JSON

```json
{
  "id": "wf-shopee-lister",
  "name": "Shopee Multi-Account Lister",
  "type": "mobile",
  "deviceConfig": {
    "targetProfiles": ["android-samsung-chrome120", "android-pixel-chrome121"],
    "executionMode": "parallel"
  },
  "behaviorPattern": "casual_browser",
  "steps": [
    {
      "id": "s1",
      "action": "setLocation",
      "label": "Mock location to Ho Chi Minh",
      "params": {
        "latitude": 10.8231,
        "longitude": 106.6297,
        "accuracy": 50
      }
    },
    {
      "id": "s2",
      "action": "navigate",
      "label": "Open Shopee",
      "params": {
        "url": "https://shopee.vn",
        "waitUntil": "networkidle2"
      }
    },
    {
      "id": "s3",
      "action": "wait",
      "label": "Wait for page load",
      "params": { "ms": 2000 }
    },
    {
      "id": "s4",
      "action": "swipe",
      "label": "Scroll feed",
      "params": {
        "fromX": 150,
        "fromY": 500,
        "toX": 150,
        "toY": 200,
        "duration": 800,
        "count": 2
      }
    },
    {
      "id": "s5",
      "action": "tapPoint",
      "label": "Tap first product",
      "params": {
        "x": 150,
        "y": 280,
        "duration": 100,
        "jitterEnabled": true
      }
    },
    {
      "id": "s6",
      "action": "wait",
      "label": "Wait for product page",
      "params": { "ms": 3000 }
    },
    {
      "id": "s7",
      "action": "screenshot",
      "label": "Capture product details",
      "params": { "fullPage": false }
    }
  ]
}
```

---

## 🔧 Implementation Checklist (Phase 17)

### Week 1-2: Foundation
- [ ] Database migrations
- [ ] `MobileWorkflowEngine` class
- [ ] IPC handlers setup
- [ ] Zustand store

### Week 3-4: Core Gestures
- [ ] `handleTapPoint()` 
- [ ] `handleSwipe()` with interpolation
- [ ] `handlePinch()` via CDP
- [ ] `handleLongPress()`
- [ ] Manual testing

### Week 5-6: UI + Patterns
- [ ] `MobileWorkflowBuilder` React component
- [ ] `GestureActionPalette`
- [ ] `BehaviorPatternSelector`
- [ ] Real-time execution monitor
- [ ] Documentation

---

## 🧪 Testing Checklist

### Unit Tests
```typescript
// Test gesture timing
expect(calculateTapDuration(pattern)).toBe(100 ± 20)

// Test behavior injection
const modified = applyBehaviorPattern(steps, 'power_user')
expect(modified.steps[0].delay).toBeLessThan(150)

// Test sensor mocking
expect(injectedScript).toContain('navigator.geolocation')
```

### Integration Tests
```typescript
// Test full workflow on emulated device
const result = await engine.executeWorkflow(workflow, profileId)
expect(result.success).toBe(true)
expect(result.metrics.tapCount).toBeGreaterThan(0)

// Test batch execution
const batchResult = await orchestrator.executeWorkflowBatch(
  workflow,
  ['profile1', 'profile2', 'profile3'],
  { parallel: true }
)
expect(batchResult.successfulCount).toBe(3)
```

### Manual Testing
- [ ] Create workflow via UI, save to DB, execute
- [ ] Verify gesture coordinates on device emulation
- [ ] Check behavior pattern delays applied
- [ ] Monitor parallel execution on 5+ profiles
- [ ] Verify screenshots captured during execution
- [ ] Test error recovery (failed step, retry)

---

## 🚨 Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Tap at device pixel coords, not viewport | Use `page.viewport().width` to scale |
| Swipe doesn't register on SPA | Use CDP `synthesizeScrollGesture` instead |
| Behavior delays not applied | Check archetype config in DB |
| Real device disconnects mid-execution | Implement health check before each step |
| Screenshots too large (memory) | Compress to 80% quality, limit to key steps |
| Parallel execution race condition | Use Mutex for profile-specific resources |
| Mobile profile & desktop step mixed | Validate step.action matches workflow.type |

---

## 📚 File Structure

```
src/main/
├── mobile-workflow-engine.ts      # Core gesture engine
├── mobile-orchestrator.ts          # Cross-device executor
├── mobile-behavior.ts              # 10 archetypes
├── real-device-connector.ts        # Phase 18: ADB + Appium
└── ipc/handlers.ts                 # IPC channel handlers

src/renderer/src/components/
├── MobileWorkflowBuilder/
│   ├── index.tsx
│   ├── MobileStepLibrary.tsx
│   ├── GestureVisualizer.tsx
│   ├── BehaviorPatternSelector.tsx
│   ├── CrossDeviceExecutor.tsx
│   └── ExecutionMonitor.tsx
└── ...

src/shared/
└── types.ts                        # Mobile type definitions

docs/
├── MOBILE_WORKFLOW_DESIGN.md       # Full technical design
├── MOBILE_FEATURES_PLANNING.md     # Planning + analysis
└── MOBILE_FEATURES_QUICK_REFERENCE.md  # This file
```

---

## 🎓 Learning Resources

### Understanding Mobile Automation
1. **Puppeteer Mobile Emulation** — https://pptr.dev/guides/mobile-automation
2. **Chrome DevTools Protocol** — Gestures + Input API
3. **Sensor APIs** — navigator.geolocation, DeviceMotionEvent
4. **Behavior Analysis** — Learning human interaction patterns

### SEA Platform Detection Signals
- **Shopee** — CDP presence, gesture timing variance
- **Lazada** — Inventory checks, network patterns
- **TikTok Shop** — Account age, behavioral consistency

---

## 🔄 Phase Progression

```
Phase 17 (6 weeks)        Phase 18 (6 weeks)        Phase 19 (6 weeks)
─────────────────────     ──────────────────────    ───────────────────
✅ Gestures               ✅ Real devices (ADB)      ✅ Batch detection
✅ Sensors (4 types)      ✅ Mobile CDP evasion      ✅ ML optimization
✅ Behaviors (10x)        ✅ Android + iOS           ✅ 85%+ pass rate
✅ UI Builder             ✅ Device health checks    ✅ Auto-tuning
✅ Basic execution        ✅ Network simulation      ✅ Performance opt
                          (Phase 19 prep)
```

---

## 📞 Getting Help

### Questions?
- Architecture: See `MOBILE_WORKFLOW_DESIGN.md` §2-4
- Database: See `MOBILE_FEATURES_PLANNING.md` §3
- Components: See `MOBILE_FEATURES_PLANNING.md` §5
- Types: See `src/shared/types.ts` (additions)

### Need Examples?
- Sample workflow: `MOBILE_WORKFLOW_DESIGN.md` Appendix A
- Real device workflow: `MOBILE_WORKFLOW_DESIGN.md` Appendix B
- React component: `MOBILE_FEATURES_PLANNING.md` §5

---

**Last Updated**: 2026-04-10  
**Next Update**: After Phase 17 kickoff  
**Maintainer**: Product + Engineering team
