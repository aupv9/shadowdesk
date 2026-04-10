# Mobile Workflow Features — Planning & Technical Analysis
**Status**: Planning Phase | **Target**: Phase 17-19 Implementation  
**Date**: 2026-04-10

---

## 1. Feature Overview & Comparison with Multilogin

### What Ghost Browser Mobile Workflow Offers vs Multilogin

| Feature | Ghost Browser (Phase 17-19) | Multilogin | Status |
|---------|--------------------------|-----------|--------|
| **Mobile Gesture Support** | ✅ Tap, swipe, pinch, long-press, drag | ✅ Basic touch | **Advantage: Ghost** |
| **Sensor Simulation** | ✅ Geolocation, accel, gyro, battery, network | ⚠️ Limited | **Advantage: Ghost** |
| **Behavior Patterns** | ✅ 10 archetypes + AI-driven timing | ⚠️ Manual | **Advantage: Ghost** |
| **Real Device Support** | 🔄 Phase 18 (ADB + Appium) | ✅ Cloud Android | **Multilogin ahead** |
| **Cross-Device Orchestration** | ✅ Parallel + sequential | ⚠️ Limited | **Advantage: Ghost** |
| **Desktop + Mobile** | ✅ Unified workflow engine | ❌ Separate | **Advantage: Ghost** |
| **iOS Support** | ✅ iOS presets + Phase 18 Appium | ⚠️ Cloud only | **Competitive** |
| **AI Optimization** | ✅ Phase 16 AI for gesture/behavior | ❌ None | **Advantage: Ghost** |
| **SEA Platform Focus** | ✅ Shopee, Lazada, TikTok Shop | ❌ Global | **Advantage: Ghost** |

---

## 2. Core Technical Components

### A. Mobile Gesture Engine
```
┌─────────────────────────────────────────────┐
│     User defines gesture in UI              │
│     (tap at x:150, y:280 on iPhone 14)      │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  IPC: mobileGesture:execute                 │
│  Sends: { x, y, duration, jitter, ... }    │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  MobileWorkflowEngine                       │
│  ├─ Generate random jitter (±2px)           │
│  ├─ Check anti-bot detection first          │
│  └─ Send to Puppeteer/CDP                   │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  Puppeteer touchscreen API OR               │
│  CDP Input.synthesizeGesture                │
│  └─ Tap at calculated x,y                   │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│  Chromium Mobile Emulation                  │
│  └─ Native touch event fired                │
└─────────────────────────────────────────────┘
```

**Implementation Details**:
- **Gesture Timing**: Human-like delays between gestures (100-500ms)
- **Jitter**: Add ±2px random offset to prevent "perfect tapping"
- **Gesture Types**: 
  - Single-touch: tap, double-tap, long-press
  - Multi-touch: pinch, two-finger swipe
  - Drag: element drag-drop with momentum
- **Failure Handling**: Retry with new coordinates if gesture fails

### B. Sensor Simulation Layer
```
┌──────────────────────────────────┐
│  User sets location (Hanoi)      │
│  Sets accelerometer (moving)     │
└──────────────────┬───────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────┐
│  MobileWorkflowEngine.sensorState            │
│  Stores: { location, accel, gyro, battery } │
└──────────────────┬───────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────┐
│  Inject via page.evaluateOnNewDocument()     │
│  • Mock navigator.geolocation                │
│  • Mock DeviceMotionEvent                    │
│  • Mock window.screen (brightness, etc)     │
└──────────────────┬───────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────┐
│  Website calls navigator.geolocation         │
│  ↓ Returns mocked data                       │
│  ✅ Site thinks device is in Hanoi           │
└──────────────────────────────────────────────┘
```

**Sensor Types Supported**:
1. **Geolocation** — lat/lng/accuracy/altitude
2. **Motion** — accelerometer (x,y,z) + gyroscope
3. **Battery** — level, charging status, time remaining
4. **Network** — 2G, 3G, 4G, 5G, WiFi (Pending Phase 19)
5. **Proximity** — distance sensor (5-200cm range)
6. **Ambient Light** — lux value (0-10000)
7. **Orientation** — portrait, landscape, portrait-upside-down

### C. Behavior Pattern Injection
```
┌──────────────────────────────────┐
│  Select: "power_user"            │
│  archetype                       │
└──────────────────┬───────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────┐
│  MobileBehaviorLibrary.applyBehaviorPattern()│
│  ├─ tapDelayMs: 50 + rand(0-100)             │
│  ├─ swipeDurationMs: 300 + rand(0-150)       │
│  ├─ pauseBetweenActionsMs: 300 + rand(0-500)│
│  └─ scrollDistance: 500 + rand(0-300)        │
└──────────────────┬───────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────┐
│  Modify workflow steps:                      │
│  • Add delays before each gesture            │
│  • Vary scroll distances (±20%)              │
│  • Insert random pauses (1-2s)               │
│  • Simulate occasional misses (3-5%)         │
└──────────────────┬───────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────┐
│  Result:                                     │
│  ✅ Appears like real "power_user", not bot  │
└──────────────────────────────────────────────┘
```

**10 Behavior Archetypes**:
1. **casual_browser** — Slow, random, human-like (delays: 200-500ms)
2. **power_user** — Fast, efficient (delays: 50-150ms)
3. **bot_evasion** — Highly random, anti-detection focused (delays: 100-600ms)
4. **rapid_interactor** — Very fast (delays: 30-80ms)
5. **mobile_native** — Handles phone-specific gestures naturally
6. **careful_shopper** — Lingers on products (scrolls slowly)
7. **bulk_operator** — High action count, minimal pausing
8. **social_lurker** — Lots of scrolling, minimal interaction
9. **form_filler** — Deliberate, accurate, type-heavy
10. **idler** — Long pauses, occasional activity (night mode?)

---

## 3. Database Schema Design

### Core Mobile Tables

```sql
-- Mobile workflows (separate from desktop automation workflows)
CREATE TABLE mobile_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  steps JSON NOT NULL,              -- Array<MobileAutomationStep>
  device_config JSON NOT NULL,       -- { profiles: [], executionMode: "parallel" }
  behavior_pattern TEXT,             -- Archetype name (optional)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  is_template BOOLEAN DEFAULT 0      -- Reusable template?
);

-- Execution logs (track every run)
CREATE TABLE mobile_execution_logs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  device_name TEXT,                 -- "iPhone 14", "Samsung A54", etc
  started_at DATETIME,
  ended_at DATETIME,
  duration_ms INTEGER,
  status TEXT,                       -- "success", "failed", "timeout", "aborted"
  error_message TEXT,
  step_results JSON,                 -- { stepId: { success, duration, error } }
  
  -- Metrics
  tap_count INTEGER,
  swipe_count INTEGER,
  scroll_count INTEGER,
  long_press_count INTEGER,
  gesture_fail_count INTEGER,
  
  -- Sensor state at execution time
  sensor_state JSON,                 -- { location, battery, network, ... }
  
  -- Screenshots (base64 encoded, optional)
  screenshots JSON,                  -- [{ stepId, base64 }, ...]
  
  created_at DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES mobile_workflows(id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

-- Track device connection state (real devices)
CREATE TABLE mobile_device_state (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  device_type TEXT,                -- "emulated", "real_android", "real_ios"
  device_id TEXT,                  -- ADB device ID or UDID
  device_name TEXT,
  model TEXT,
  os_version TEXT,
  is_connected BOOLEAN,
  last_connected_at DATETIME,
  connection_error TEXT,
  last_updated DATETIME,
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);

-- Pre-defined gesture templates for reuse
CREATE TABLE gesture_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  gesture_type TEXT,              -- "tap", "swipe", "pinch", "drag"
  description TEXT,
  config JSON,                    -- Gesture-specific config
  created_at DATETIME
);

-- Behavior pattern library (10 archetypes + custom)
CREATE TABLE behavior_patterns (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE,
  archetype TEXT,                -- "casual_browser", "power_user", etc.
  description TEXT,
  config JSON,                   -- { tapDelayMs, swipeDurationMs, ... }
  is_custom BOOLEAN,
  created_at DATETIME
);

-- Cross-device batch execution history
CREATE TABLE mobile_batch_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT,
  profile_ids JSON,              -- ["id1", "id2", "id3"]
  execution_mode TEXT,           -- "parallel", "sequential"
  started_at DATETIME,
  ended_at DATETIME,
  total_profiles INTEGER,
  successful_count INTEGER,
  failed_count INTEGER,
  status TEXT,
  created_at DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES mobile_workflows(id)
);
```

### Sample Data
```sql
-- Insert behavior archetype
INSERT INTO behavior_patterns VALUES (
  'bp-casual-browser',
  'casual_browser',
  'casual_browser',
  'Simulates casual browsing: slow, random interactions',
  '{
    "tapDelayMs": "() => 200 + Math.random() * 300",
    "swipeDurationMs": "() => 600 + Math.random() * 400",
    "pauseBetweenActionsMs": "() => 1000 + Math.random() * 2000",
    "scrollDistance": "() => 300 + Math.random() * 200",
    "missRate": 0.05,
    "retapRate": 0.02
  }',
  0,
  CURRENT_TIMESTAMP
);

-- Insert gesture template
INSERT INTO gesture_templates VALUES (
  'gt-swipe-up-feed',
  'Swipe Up (Feed)',
  'swipe',
  'Standard upward swipe for feed scrolling',
  '{
    "fromX": 150,
    "fromY": 500,
    "toX": 150,
    "toY": 200,
    "duration": 500,
    "count": 1
  }',
  CURRENT_TIMESTAMP
);
```

---

## 4. IPC Channel Specification

### Mobile Workflow IPC

| Channel | Request | Response | Notes |
|---------|---------|----------|-------|
| `mobileWorkflow:create` | `{ name, steps, deviceConfig }` | `{ id, created_at }` | Create new mobile workflow |
| `mobileWorkflow:list` | `{}` | `{ workflows: [...] }` | List all mobile workflows |
| `mobileWorkflow:get` | `{ id }` | `MobileWorkflow` | Get workflow details |
| `mobileWorkflow:update` | `{ id, name, steps, ... }` | `{ success }` | Update workflow |
| `mobileWorkflow:delete` | `{ id }` | `{ success }` | Delete workflow |
| `mobileWorkflow:duplicate` | `{ id }` | `{ newId }` | Clone workflow |
| `mobileWorkflow:execute` | `{ workflowId, profileIds, mode }` | `{ executionId }` | Start execution (async) |

### Mobile Execution IPC

| Channel | Request | Response | Notes |
|---------|---------|----------|-------|
| `mobileExecution:status` | `{ executionId }` | `ExecutionStatus` | Get real-time status |
| `mobileExecution:cancel` | `{ executionId }` | `{ success }` | Cancel running execution |
| `mobileExecution:logs` | `{ executionId }` | `{ logs: [...] }` | Get full execution logs |
| `mobileExecution:history` | `{ workflowId, limit }` | `{ history: [...] }` | Get past execution records |

### Mobile Device IPC

| Channel | Request | Response | Notes |
|---------|---------|----------|-------|
| `mobileDevice:list` | `{}` | `{ devices: [...] }` | List connected devices |
| `mobileDevice:connect` | `{ deviceId }` | `{ success, error }` | Connect to real device |
| `mobileDevice:disconnect` | `{ deviceId }` | `{ success }` | Disconnect device |
| `mobileDevice:info` | `{ deviceId }` | `DeviceInfo` | Get device details |
| `mobileDevice:screenshot` | `{ deviceId }` | `{ base64 }` | Capture screenshot from device |

### Mobile Gesture Testing IPC

| Channel | Request | Response | Notes |
|---------|---------|----------|-------|
| `mobileGesture:testTap` | `{ x, y }` | `{ success, error }` | Test tap on active page |
| `mobileGesture:testSwipe` | `{ fromX, toX, fromY, toY }` | `{ success, error }` | Test swipe |
| `mobileGesture:testPinch` | `{ centerX, centerY, scale }` | `{ success, error }` | Test pinch |

### Mobile Behavior IPC

| Channel | Request | Response | Notes |
|---------|---------|----------|-------|
| `mobileBehavior:list` | `{}` | `{ patterns: [...] }` | List 10+ behavior archetypes |
| `mobileBehavior:getConfig` | `{ name }` | `BehaviorPattern` | Get archetype config |
| `mobileBehavior:apply` | `{ workflowId, patternName }` | `{ modified_workflow }` | Apply behavior to workflow |
| `mobileBehavior:preview` | `{ steps, patternName }` | `{ modified_steps }` | Preview behavior injection |

---

## 5. React Components Architecture

### Component Tree
```
┌─ MobileWorkflowManager (Page)
│
├─ MobileWorkflowBuilder
│  ├─ MobileStepLibrary (Left Sidebar)
│  │  ├─ GestureActionPalette
│  │  │  ├─ TapAction
│  │  │  ├─ SwipeAction
│  │  │  ├─ PinchAction
│  │  │  ├─ LongPressAction
│  │  │  └─ DragDropAction
│  │  ├─ SensorActionPalette
│  │  │  ├─ GeolocationControl
│  │  │  ├─ AccelerometerControl
│  │  │  └─ BatteryControl
│  │  └─ DeviceActionPalette
│  │     ├─ RotateDevice
│  │     └─ SetViewport
│  │
│  ├─ WorkflowCanvas (Center)
│  │  ├─ StepCard (draggable)
│  │  ├─ StepConnector (visual flow)
│  │  └─ StepEditor (inline edit)
│  │
│  ├─ DeviceSelector (Right Sidebar)
│  │  ├─ ProfileMultiSelect
│  │  ├─ ExecutionModeSelector
│  │  └─ BehaviorPatternSelector
│  │
│  └─ ActionBar
│     ├─ SaveButton
│     ├─ ExecuteButton
│     ├─ TestButton (run on 1 profile)
│     └─ PreviewButton
│
├─ MobileExecutionMonitor
│  ├─ ProgressBar (overall %)
│  ├─ DeviceProgressList
│  │  ├─ DeviceProgressCard
│  │  │  ├─ Current step
│  │  │  ├─ Step counter (5/12)
│  │  │  ├─ Duration
│  │  │  ├─ Status indicator
│  │  │  └─ Live screenshot
│  │  └─ ...
│  ├─ ExecutionTimeline
│  ├─ ErrorLog
│  └─ DownloadResults
│
└─ MobileExecutionHistory
   ├─ ExecutionTable
   │  ├─ Date
   │  ├─ Workflow
   │  ├─ Profiles (count)
   │  ├─ Status
   │  ├─ Duration
   │  └─ Actions (view log, replay)
   └─ FilterBar
```

### Key Components Detail

#### 1. GestureActionPalette
```typescript
interface TapActionConfig {
  x: number              // 0-320 (device width)
  y: number              // 0-640 (device height)
  duration?: number      // ms
  skipAnimation: boolean // wait for animation finish
  jitterEnabled: boolean // add ±2px random
}

// Component features:
// - Visual phone preview showing tap location
// - Coordinate picker (click on preview to select)
// - Duration slider (50-500ms)
// - Live preview on active profile
// - Undo/redo support
```

#### 2. BehaviorPatternSelector
```typescript
interface BehaviorSelection {
  archetype: string     // "casual_browser", "power_user", etc.
  customConfig?: {
    tapDelayRange: [min, max]
    pauseRange: [min, max]
    errorRate: number
  }
}

// Component features:
// - 10 preset cards with descriptions
// - Preview of behavior timing (animations)
// - Custom override inputs
// - "Before/After" workflow comparison
```

#### 3. MobileExecutionMonitor
```typescript
interface ExecutionStatus {
  id: string
  workflowId: string
  profileIds: string[]
  currentStep: number
  totalSteps: number
  overallProgress: number    // 0-100
  profileStatus: {
    [profileId]: {
      currentStepId: string
      stepNumber: number
      status: "running" | "success" | "failed" | "waiting"
      duration: number
      lastScreenshot: string // base64
      error?: string
    }
  }
  startedAt: number
  estimatedDuration: number
}

// Component features:
// - Real-time progress updates (WebSocket or polling)
// - Device cards showing current step + screenshot
// - Cancel execution button
// - View full logs (expandable)
```

---

## 6. TypeScript Type Definitions

### Core Types
```typescript
// Mobile Actions
type MobileGestureAction = 
  | 'tapPoint' | 'tapElement' | 'tapMulti' 
  | 'swipe' | 'longPress' | 'doubleTap' 
  | 'scroll' | 'pinch' | 'rotate' | 'dragDrop' | 'inputText'

type MobileSensorAction = 
  | 'setLocation' | 'setAccelerometer' | 'setGyroscope' 
  | 'setProximity' | 'setAmbientLight' | 'setHumidity' 
  | 'setBattery' | 'setNetworkInfo'

type MobileDeviceAction = 
  | 'rotateDevice' | 'setViewport' | 'simulateBackPress' 
  | 'simulateHomePress' | 'openApp' | 'closeApp' | 'installApp'

type MobileAction = MobileGestureAction | MobileSensorAction | MobileDeviceAction

// Step Definition
interface MobileAutomationStep extends AutomationStep {
  action: MobileAction
  params: {
    // Gesture-specific
    x?: number
    y?: number
    fromX?: number
    fromY?: number
    toX?: number
    toY?: number
    duration?: number
    count?: number
    scaleFactor?: number
    jitterEnabled?: boolean
    skipAnimation?: boolean
    
    // Sensor-specific
    latitude?: number
    longitude?: number
    accuracy?: number
    altitude?: number
    
    // Device-specific
    orientation?: 'portrait' | 'landscape'
    width?: number
    height?: number
    
    [key: string]: any
  }
  deviceProfile?: string
  detectiveMode?: boolean
  retryCount?: number
  timeout?: number
}

// Workflow Configuration
interface MobileWorkflow extends BaseWorkflow {
  type: 'mobile'
  steps: MobileAutomationStep[]
  deviceConfig: {
    targetProfiles: string[]     // Profile IDs
    executionMode: 'single' | 'parallel' | 'sequential'
    delayBetweenProfiles?: number
    stopOnError: boolean
    timeoutPerStep?: number
    maxRetries?: number
  }
  behaviorPattern?: string        // Archetype name
}

// Execution Context
interface MobileExecutionContext {
  executionId: string
  workflowId: string
  profileId: string
  deviceName: string
  page: Page                       // Puppeteer Page
  startTime: number
  stopOnError: boolean
  timeoutPerStep: number
}

// Behavior Pattern
interface MobileBehaviorPattern {
  id: string
  name: string
  archetype: string
  description: string
  config: {
    tapDelayMs: () => number
    swipeDurationMs: () => number
    pauseBetweenActionsMs: () => number
    scrollDistance: () => number
    missRate?: number
    retapRate?: number
    viewportOrientation?: 'portrait' | 'landscape' | 'random'
  }
}

// Execution Result
interface MobileExecutionResult extends AutomationRunResult {
  executionId: string
  profileId: string
  deviceName: string
  steps: AutomationStepResult[]
  metrics: {
    tapCount: number
    swipeCount: number
    scrollCount: number
    longPressCount: number
    totalDuration: number
    averageStepDuration: number
  }
  sensorState?: SensorState
  screenshots?: Array<{ stepId: string; base64: string }>
}

// Batch Execution
interface MobileBatchExecutionResult {
  executionId: string
  workflowId: string
  profileIds: string[]
  executionMode: 'parallel' | 'sequential'
  startedAt: number
  endedAt?: number
  totalProfiles: number
  successfulCount: number
  failedCount: number
  pendingCount: number
  results: Map<string, MobileExecutionResult>
  overallStatus: 'running' | 'success' | 'failed' | 'partial'
}

// Real Device
interface RealDevice {
  type: 'android' | 'ios'
  id: string
  name: string
  model: string
  osVersion: string
  isConnected: boolean
  lastConnectedAt?: number
}

interface AdbDevice extends RealDevice {
  type: 'android'
  androidVersion: string
  webdriverPort: number
  adbId: string
}

interface IosDevice extends RealDevice {
  type: 'ios'
  iosVersion: string
  udid: string
  xcodePath: string
}
```

---

## 7. Implementation Phases & Timeline

### Phase 17 (Now) — Mobile Workflow Foundation (6 weeks)
**Goal**: Deliver basic mobile gesture automation + behavior simulation

**Week 1-2**: Foundation
- [ ] Database schema creation & migrations
- [ ] `MobileWorkflowEngine` class skeleton
- [ ] IPC channels setup
- [ ] Zustand store for mobile workflows

**Week 3-4**: Gesture Implementation
- [ ] `handleTapPoint()` — CDP touch events
- [ ] `handleSwipe()` — swipe animation with interpolation
- [ ] `handlePinch()` — pinch zoom via CDP
- [ ] `handleLongPress()` — long-touch behavior
- [ ] Manual testing on mobile emulation

**Week 5-6**: UI + Behavior Patterns
- [ ] React `MobileWorkflowBuilder` component
- [ ] `GestureActionPalette` — drag/drop gestures
- [ ] `BehaviorPatternSelector` — 10 archetypes
- [ ] Basic execution monitoring
- [ ] Documentation + sample workflows

**Deliverable**: Demo running multi-step workflow on 3 mobile profiles

---

### Phase 18 (7-12 weeks) — Real Device + Advanced Evasion
**Goal**: Connect real iOS/Android devices + advanced CDP evasion for mobile

**Week 7-9**: Real Device Integration
- [ ] ADB connector (Android devices)
- [ ] Appium setup (iOS devices)
- [ ] Device discovery & health checks
- [ ] Real device execution in `MobileWorkflowEngine`

**Week 10-12**: Mobile-Specific Evasion
- [ ] Mobile CDP evasion (hide WebDriver, automation traces)
- [ ] Adaptive gesture timing based on target detection
- [ ] Mobile app automation (Android APK via Appium)
- [ ] Network condition simulation (4G vs WiFi)

**Deliverable**: Run workflows on real iPhone 14 + Samsung A54

---

### Phase 19 (13-18 weeks) — Batch Testing + ML Optimization
**Goal**: Batch mobile detection testing + machine learning-based gesture tuning

**Week 13-15**: Batch Testing
- [ ] Mobile detection test framework (20+ vectors)
- [ ] Batch test runner (test 10 profiles in parallel)
- [ ] Detection analysis dashboard

**Week 16-18**: ML Optimization
- [ ] Learn from detection failures (which gestures trigger detection)
- [ ] Auto-adjust timing/jitter based on target site
- [ ] Cross-profile behavior synchronization
- [ ] Performance optimization for 100+ concurrent workflows

**Deliverable**: 85%+ pass rate on SEA platform (Shopee, Lazada, TikTok Shop) detection tests

---

## 8. SEA Platform-Specific Considerations

### Shopee Mobile Automation
```typescript
// Shopee detection signals:
// 1. CDP presence (checkoutPage might check window.webdriver)
// 2. Gesture timing (too fast = bot detection)
// 3. Geolocation variance (same profile, different geo = suspicious)
// 4. User agent + device mismatch

// Recommended workflow:
const shopeeWorkflow = {
  behaviorPattern: 'casual_browser',  // Slow interactions
  steps: [
    // Set location BEFORE navigation (some sites check early)
    { action: 'setLocation', params: { latitude: 10.8, longitude: 106.6 } },
    { action: 'navigate', url: 'https://shopee.vn' },
    { action: 'wait', params: { ms: 2000 } },
    
    // Search products (use swipe for realistic scrolling)
    { action: 'swipe', params: { duration: 800, count: 3 } },
    
    // Tap product (add jitter to avoid perfect coordinates)
    { action: 'tapPoint', params: { x: 150, y: 280, jitterEnabled: true } },
    
    // Long pause before next action (humans browse slowly)
    { action: 'wait', params: { ms: 3000 } },
  ]
}
```

### Lazada Mobile Automation
```typescript
// Lazada specific:
// 1. Flash Sale detection (rapid taps = bot)
// 2. Inventory checks (same item = suspicious pattern)
// 3. Network variance expected (Vietnam network delays)

// Recommended:
const lazadaWorkflow = {
  behaviorPattern: 'careful_shopper',  // Deliberate, slow
  steps: [
    // Add network latency simulation (Phase 19)
    { action: 'setNetworkInfo', params: { type: '4G', latency: 100 } },
    
    // Navigate + wait
    { action: 'navigate', url: 'https://lazada.vn' },
    { action: 'wait', params: { ms: 2500 } },
    
    // Scroll feed slowly
    { action: 'scroll', params: { y: 300, duration: 1200 } },
  ]
}
```

### TikTok Shop Mobile Automation
```typescript
// TikTok Shop detection:
// 1. Extremely strict anti-bot (AI-based)
// 2. Account age matters (new account = higher suspension)
// 3. Behavioral consistency critical (same person's behavior)

// Recommended:
const tiktokShopWorkflow = {
  behaviorPattern: 'bot_evasion',  // Highly randomized
  steps: [
    // Set realistic device state
    { action: 'setBattery', params: { level: 65, isCharging: false } },
    { action: 'setAccelerometer', params: { x: 0.1, y: -9.8, z: 0.2 } },
    
    // Navigate with delay
    { action: 'navigate', url: 'https://tiktokshop.com/vn' },
    { action: 'wait', params: { ms: 3000 } },
    
    // Humanlike browsing
    { action: 'swipe', params: { duration: 1000, count: 2 } },
  ]
}
```

---

## 9. Success Metrics & KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Mobile Workflow Adoption** | 25% of all workflows | Zustand store analytics |
| **Detection Evasion Rate** | 80%+ pass on SEA platforms | batch_detection_tests table |
| **Parallel Execution Throughput** | 10 profiles in <5min | execution_logs.duration_ms |
| **Gesture Accuracy** | 98%+ success rate | step_results.success rate |
| **UI/UX Satisfaction** | 4.5+/5 rating | User feedback survey |
| **Real Device Support** | iOS + Android both working | Phase 18 deliverable |
| **AI Optimization (Phase 19)** | 85%+ pass rate after ML tuning | detection_test_vectors table |

---

## 10. Risk Assessment & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Puppeteer touchscreen API limitations | HIGH | Use CDP `Input.synthesizeScrollGesture` directly |
| iOS WebDriver licensing (Appium) | MEDIUM | Trial period; test WebdriverIO alternative |
| Cross-device sync complexity | MEDIUM | Implement message queue + worker pool |
| Detection arms race (sites evolve) | HIGH | Continuous CDP evasion updates + AI learning |
| Real device stability | MEDIUM | Health checks before/after execution |
| Mobile-specific CDP changes (Chrome versions) | MEDIUM | Version compatibility matrix in CI/CD |

---

## 11. Documentation Artifacts

### User Documentation
- **Mobile Workflow Tutorial** — Step-by-step guide for creating first workflow
- **Gesture Reference** — Visual guide for each gesture + parameter details
- **Behavior Archetype Guide** — When to use which archetype
- **Real Device Setup Guide** — ADB/Appium installation (Phase 18)
- **Troubleshooting** — Common errors + solutions

### Developer Documentation
- **Mobile Engine Architecture** — Design overview + class diagram
- **CDP Gesture Injection** — Technical deep-dive on gesture implementation
- **IPC Channel Spec** — Complete request/response format
- **Database Schema** — ER diagram + migration scripts
- **Phase 18/19 Roadmap** — Next steps + breaking changes

### Sample Workflows
- **Shopee Multi-Account Lister** — End-to-end example
- **Lazada Flash Sale Monitor** — Real-world use case
- **TikTok Shop Bot Evasion** — Anti-detection focused
- **Generic Mobile Form Filler** — Reusable template

---

## 12. Architecture Comparison: Desktop vs Mobile

| Aspect | Desktop Workflow | Mobile Workflow |
|--------|-----------------|-----------------|
| **Step Types** | click, type, navigate, scroll | tap, swipe, pinch, scroll |
| **Timing** | ~50-200ms | ~100-500ms (slower) |
| **Sensors** | None | Geolocation, accel, battery, network |
| **Device Variance** | Minimal (Windows/Mac/Linux) | High (100+ device models) |
| **Real Device Support** | No | Yes (Phase 18) |
| **Behavior Patterns** | 3 archetypes | 10 archetypes |
| **Multi-tasking** | Sequential only | Parallel + sequential |
| **Anti-bot Detection** | CDP evasion Layer 1-3 | Mobile-specific Layer detection |
| **Profile Reuse** | High (many desktops same UA) | Medium (device variance) |

---

## Conclusion

The **Mobile Workflow System** positions Ghost Browser as the only comprehensive anti-detect browser with:

✅ **Desktop + Mobile unified** — Single platform for all automation  
✅ **AI-driven behavior** — 10 archetypes + ML optimization (Phase 19)  
✅ **SEA market leader** — Shopee, Lazada, TikTok Shop focused  
✅ **Real device support** — Phase 18 (ahead of Multilogin timeline)  
✅ **Cross-device orchestration** — Parallel workflow execution  

This creates a significant **competitive moat** vs Multilogin, especially for:
- Power users who need desktop + mobile in one workflow
- Teams managing 100s of accounts across devices
- Businesses needing AI-optimized anti-detection

---

**Document Version**: 1.0  
**Status**: Planning Phase Complete  
**Next Step**: Begin Phase 17 Implementation  
**Last Updated**: 2026-04-10
