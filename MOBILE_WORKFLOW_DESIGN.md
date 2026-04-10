# Ghost Browser — Mobile Workflow Features Design Document
**Version 1.0** | **Date:** 2026-04-10 | **Phase:** Phase 17 (Mobile Automation Enhancement)

---

## Executive Summary

Ghost Browser currently supports **11 mobile presets** (3 Android + 3 iOS) with fingerprint spoofing and detection testing. This document proposes a comprehensive **Mobile Workflow System** that enables:

1. **Mobile-Native Automation** — Gestures, touch events, sensor APIs, device-specific actions
2. **Cross-Device Workflow Orchestration** — Run same workflow across multiple mobile profiles
3. **Mobile Behavior Simulation** — Realistic human interaction patterns on mobile devices
4. **Real Device Integration** — Connect physical/emulated Android devices via ADB
5. **Mobile Detection & Evasion** — Detect mobile anti-bot defenses and adapt workflows

---

## Current State Analysis

### Existing Mobile Capabilities ✅
- **11 Mobile Presets** in `src/main/fingerprint/presets.ts`:
  - 3 Android (Samsung A54, Pixel 7, OPPO Reno)
  - 3 iOS (iPhone 14, iPhone 15, iPad)
  - Correct UA strings, screen dimensions, device capabilities
- **Basic Mobile Fingerprinting** via navigator scripts
- **Desktop-Only Automation Engine** — No mobile gesture support
- **Web-Based Mobile Testing** — Limited to Chromium's mobile emulation mode

### Gaps Identified ❌
| Gap | Impact | Priority |
|-----|--------|----------|
| No touch/gesture automation | Can't interact with swipe-based UI | HIGH |
| No device sensor simulation | Missing accelerometer, gyroscope, location | HIGH |
| No real device support | Can't test on actual iOS/Android | MEDIUM |
| No mobile app testing | Only web automation | MEDIUM |
| No cross-device orchestration | Single profile = single workflow | HIGH |
| No mobile behavior library | Can't simulate realistic patterns | HIGH |

---

## Phase 17: Mobile Workflow System Architecture

### Overview Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer (React UI)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Mobile Workflow Builder                              │   │
│  │ ├─ Mobile Step Library                               │   │
│  │ ├─ Device Selector + Profile Mapper                  │   │
│  │ ├─ Multi-Device Executor                             │   │
│  │ └─ Mobile Behavior Inspector                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓ IPC
┌─────────────────────────────────────────────────────────────┐
│                   Main Process (Node.js)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ MobileWorkflowEngine                                 │   │
│  │ ├─ GestureHandler (tap, swipe, pinch, long-press)   │   │
│  │ ├─ SensorSimulator (accel, gyro, location, etc)     │   │
│  │ ├─ MobileProfileMatcher (auto-select profiles)       │   │
│  │ ├─ CrossDeviceOrchestrator (parallel execution)      │   │
│  │ └─ RealDeviceConnector (ADB, WebDriver)             │   │
│  ├─ BrowserManager (Chromium launch + profiles)         │   │
│  ├─ Database (workflows, execution logs, device state)  │   │
│  └─ IPC Handlers (mobileWorkflow:* channels)            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              Chromium Browser Instance                       │
│  ├─ Mobile Emulation Mode (Android 13/iOS 17)              │
│  ├─ Gesture Injection (via CDP sendInputEvent)             │
│  ├─ Sensor API Spoofing (via evaluateOnNewDocument)        │
│  └─ Touch Event Simulation                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Core Mobile Actions

### Gesture Actions
```typescript
// New AutomationStep.action types:
type MobileAction = 
  | 'tapPoint'              // Tap at x,y coordinates
  | 'tapElement'            // Tap on CSS selector
  | 'tapMulti'              // Multi-touch (pinch, two-finger)
  | 'swipe'                 // Swipe gesture (direction, distance, duration)
  | 'longPress'             // Long press (duration, element/coords)
  | 'doubleTap'             // Double tap
  | 'scroll'                // Scroll (x/y offset)
  | 'pinch'                 // Pinch zoom in/out
  | 'rotate'                // Device rotate (portrait <-> landscape)
  | 'dragDrop'              // Drag element to new position
  | 'inputText'             // Type on keyboard (with realistic delays)
```

### Sensor Actions
```typescript
type SensorAction =
  | 'setLocation'           // Mock geolocation (lat, lng, accuracy)
  | 'setAccelerometer'      // Simulate device movement
  | 'setGyroscope'          // Simulate device rotation
  | 'setProximity'          // Simulate proximity sensor
  | 'setAmbientLight'       // Simulate light sensor
  | 'setHumidity'           // Simulate humidity sensor
  | 'setBattery'            // Simulate battery level
  | 'setNetworkInfo'        // Simulate network type (4G, 5G, WiFi)
  | 'setUserAgent'          // Override UA mid-session
```

### Device Control Actions
```typescript
type DeviceAction =
  | 'rotateDevice'          // Rotate emulated device
  | 'setViewport'           // Change screen dimensions
  | 'simulateBackPress'     // Android back button
  | 'simulateHomePress'     // Home button
  | 'openApp'               // Open app (real device only)
  | 'closeApp'              // Close app (real device only)
  | 'installApp'            // Install APK/IPA (real device)
```

---

## 2. Mobile Workflow Configuration

### Step Definition Example
```typescript
// Mobile-specific step in workflow
{
  id: 'step-001',
  action: 'tapPoint',
  label: 'Tap subscribe button',
  params: {
    x: 150,
    y: 280,
    duration: 100,              // ms
    skipAnimation: false        // wait for animation finish
  },
  deviceProfile: 'android-samsung-chrome120',  // NEW: tie to profile
  detectiveMode: true          // NEW: test against anti-bot before tap
}

// Swipe example
{
  id: 'step-002',
  action: 'swipe',
  label: 'Scroll feed',
  params: {
    fromX: 150, fromY: 500,
    toX: 150, toY: 200,
    duration: 800,              // ms for swipe animation
    count: 3                     // repeat swipe N times
  }
}

// Multi-touch (pinch)
{
  id: 'step-003',
  action: 'pinch',
  label: 'Zoom in image',
  params: {
    centerX: 200, centerY: 300,
    scaleFactor: 2.0,           // 1.0 = no zoom, 2.0 = 2x
    duration: 500
  }
}

// Sensor simulation
{
  id: 'step-004',
  action: 'setLocation',
  label: 'Simulate location in Ho Chi Minh',
  params: {
    latitude: 10.8231,
    longitude: 106.6297,
    accuracy: 50,               // meters
    altitude: 10                // meters (optional)
  }
}
```

---

## 3. Database Schema Extensions

### New Tables

#### `mobile_workflows`
```sql
CREATE TABLE mobile_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  steps JSON NOT NULL,        -- Array of MobileAutomationStep
  device_config JSON,         -- { "profiles": ["id1", "id2"], "parallel": true }
  execution_mode TEXT,        -- "single", "parallel", "sequential"
  created_at DATETIME,
  updated_at DATETIME,
  created_by TEXT
);
```

#### `mobile_execution_logs`
```sql
CREATE TABLE mobile_execution_logs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT,
  profile_id TEXT,
  device_name TEXT,           -- e.g., "Samsung Galaxy A54"
  started_at DATETIME,
  ended_at DATETIME,
  status TEXT,                -- "success", "failed", "timeout"
  error_message TEXT,
  execution_metrics JSON,     -- { "tapCount": 5, "scrollCount": 3, "duration": 2500 }
  screenshots BLOB,           -- base64 encoded screenshots during run
  FOREIGN KEY (workflow_id) REFERENCES mobile_workflows(id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);
```

#### `mobile_device_state`
```sql
CREATE TABLE mobile_device_state (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  device_type TEXT,           -- "android", "ios", "real_device"
  last_known_state JSON,      -- { "battery": 85, "location": {lat, lng}, "network": "4G" }
  last_updated DATETIME,
  is_connected BOOLEAN,       -- For real devices
  device_id TEXT,             -- ADB device ID (optional)
  FOREIGN KEY (profile_id) REFERENCES profiles(id)
);
```

#### `gesture_templates`
```sql
CREATE TABLE gesture_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  gesture_type TEXT,          -- "swipe", "pinch", "scroll", "drag"
  template_config JSON,       -- { "direction": "up", "distance": 500, "duration": 800 }
  created_at DATETIME
);
```

---

## 4. Mobile Automation Engine Implementation

### File: `src/main/mobile-workflow-engine.ts`
```typescript
import type { 
  MobileAutomationStep, 
  MobileWorkflow,
  MobileExecutionContext,
  SensorState 
} from '../shared/types'
import type { Page } from 'puppeteer-core'

export class MobileWorkflowEngine {
  private currentPage: Page | null = null
  private sensorState: SensorState = {}
  private executionMetrics: ExecutionMetrics = {}

  /**
   * Execute a mobile workflow on a single profile
   */
  async executeWorkflow(
    workflow: MobileWorkflow,
    profileId: string,
    context: MobileExecutionContext
  ): Promise<MobileExecutionResult> {
    const startTime = Date.now()
    const results: AutomationStepResult[] = []

    try {
      for (const step of workflow.steps) {
        const stepResult = await this.executeStep(step, context)
        results.push(stepResult)

        // Stop if step failed and stopOnError is true
        if (!stepResult.success && context.stopOnError) break
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        steps: results,
        metrics: this.executionMetrics
      }
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        steps: results,
        error: error.message
      }
    }
  }

  /**
   * Execute a single mobile step
   */
  private async executeStep(
    step: MobileAutomationStep,
    context: MobileExecutionContext
  ): Promise<AutomationStepResult> {
    switch (step.action) {
      case 'tapPoint':
        return await this.handleTapPoint(step, context)
      case 'swipe':
        return await this.handleSwipe(step, context)
      case 'pinch':
        return await this.handlePinch(step, context)
      case 'longPress':
        return await this.handleLongPress(step, context)
      case 'setLocation':
        return await this.handleSetLocation(step, context)
      case 'setAccelerometer':
        return await this.handleSetAccelerometer(step, context)
      // ... other actions
      default:
        return { success: false, error: `Unknown action: ${step.action}` }
    }
  }

  /**
   * Tap at specific coordinates using CDP sendInputEvent
   */
  private async handleTapPoint(
    step: MobileAutomationStep,
    context: MobileExecutionContext
  ): Promise<AutomationStepResult> {
    const params = step.params as TapPointParams
    
    try {
      // Add human-like jitter to coordinates
      const jitterX = this.getRandomJitter(params.x, 2)
      const jitterY = this.getRandomJitter(params.y, 2)

      // Send touch start
      await this.currentPage!.touchscreen!.tap(jitterX, jitterY)

      // Simulate touch delay
      if (params.duration) {
        await this.sleep(params.duration)
      }

      // Log metrics
      this.executionMetrics.tapCount = (this.executionMetrics.tapCount || 0) + 1

      return { success: true, duration: params.duration || 100 }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Swipe gesture with realistic speed curve
   */
  private async handleSwipe(
    step: MobileAutomationStep,
    context: MobileExecutionContext
  ): Promise<AutomationStepResult> {
    const params = step.params as SwipeParams
    
    try {
      const touchscreen = this.currentPage!.touchscreen!
      const steps = 10 // interpolation points
      const duration = params.duration || 500
      const stepDuration = duration / steps

      // Start touch
      await touchscreen.tap(params.fromX, params.fromY)

      // Animate swipe
      for (let i = 1; i < steps; i++) {
        const progress = i / steps
        const currentX = params.fromX + (params.toX - params.fromX) * progress
        const currentY = params.fromY + (params.toY - params.fromY) * progress

        await this.sleep(stepDuration)
        // Note: Puppeteer's touchscreen API has limited swipe support
        // May need to use CDP directly: session.send('Input.synthesizeScrollGesture')
      }

      this.executionMetrics.scrollCount = (this.executionMetrics.scrollCount || 0) + 1

      return { success: true, duration }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Pinch zoom gesture
   */
  private async handlePinch(
    step: MobileAutomationStep,
    context: MobileExecutionContext
  ): Promise<AutomationStepResult> {
    const params = step.params as PinchParams
    
    try {
      // Use CDP to send pinch gesture
      const cdpSession = await this.currentPage!.target().createCDPSession()
      
      const distance = 50 * (params.scaleFactor - 1)
      
      await cdpSession.send('Input.synthesizePinchGesture', {
        x: params.centerX,
        y: params.centerY,
        scaleFactor: params.scaleFactor,
        relativeSpeed: 1,
        gestureSourceType: 'touch'
      })

      await this.sleep(params.duration || 500)

      return { success: true, duration: params.duration || 500 }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Simulate geolocation
   */
  private async handleSetLocation(
    step: MobileAutomationStep,
    context: MobileExecutionContext
  ): Promise<AutomationStepResult> {
    const params = step.params as SetLocationParams
    
    try {
      // Store sensor state
      this.sensorState.location = {
        latitude: params.latitude,
        longitude: params.longitude,
        accuracy: params.accuracy,
        altitude: params.altitude
      }

      // Inject geolocation mock via evaluateOnNewDocument
      const mockScript = `
        navigator.geolocation.getCurrentPosition = (success, error) => {
          success({
            coords: {
              latitude: ${params.latitude},
              longitude: ${params.longitude},
              accuracy: ${params.accuracy},
              altitude: ${params.altitude || 0},
              altitudeAccuracy: 10,
              heading: NaN,
              speed: NaN
            },
            timestamp: Date.now()
          });
        };

        navigator.geolocation.watchPosition = (success, error) => {
          const id = setInterval(() => {
            success({
              coords: {
                latitude: ${params.latitude} + (Math.random() - 0.5) * 0.0001,
                longitude: ${params.longitude} + (Math.random() - 0.5) * 0.0001,
                accuracy: ${params.accuracy},
                altitude: ${params.altitude || 0}
              },
              timestamp: Date.now()
            });
          }, 1000);
          return id;
        };
      `

      await this.currentPage!.evaluateOnNewDocument(mockScript)

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Simulate accelerometer readings
   */
  private async handleSetAccelerometer(
    step: MobileAutomationStep,
    context: MobileExecutionContext
  ): Promise<AutomationStepResult> {
    const params = step.params as SetAccelerometerParams
    
    try {
      this.sensorState.accelerometer = {
        x: params.x,
        y: params.y,
        z: params.z
      }

      const mockScript = `
        if (!window.DeviceMotionEvent) {
          window.DeviceMotionEvent = class {
            constructor() {}
            get acceleration() {
              return {
                x: ${params.x},
                y: ${params.y},
                z: ${params.z}
              };
            }
          };
        }

        window.addEventListener = new Proxy(window.addEventListener, {
          apply: (target, thisArg, args) => {
            if (args[0] === 'devicemotion') {
              const event = new window.DeviceMotionEvent('devicemotion', {
                acceleration: { x: ${params.x}, y: ${params.y}, z: ${params.z} }
              });
              args[1]?.(event);
            }
            return target.apply(thisArg, args);
          }
        });
      `

      await this.currentPage!.evaluateOnNewDocument(mockScript)

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Utility methods
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private getRandomJitter(value: number, range: number): number {
    return value + (Math.random() - 0.5) * range
  }
}
```

---

## 5. Cross-Device Orchestration

### File: `src/main/mobile-orchestrator.ts`
```typescript
export class CrossDeviceOrchestrator {
  /**
   * Execute same workflow across multiple profiles in parallel
   */
  async executeWorkflowBatch(
    workflow: MobileWorkflow,
    profileIds: string[],
    options: {
      parallel: boolean
      stopOnFirstError: boolean
      delayBetweenProfiles: number  // ms
    }
  ): Promise<BatchExecutionResult> {
    const results: Map<string, ExecutionResult> = new Map()

    if (options.parallel) {
      // Parallel execution
      const promises = profileIds.map(profileId =>
        this.executeForProfile(workflow, profileId)
          .then(result => results.set(profileId, result))
      )
      await Promise.all(promises)
    } else {
      // Sequential execution with delays
      for (const profileId of profileIds) {
        const result = await this.executeForProfile(workflow, profileId)
        results.set(profileId, result)

        if (!result.success && options.stopOnFirstError) break
        if (options.delayBetweenProfiles) {
          await this.sleep(options.delayBetweenProfiles)
        }
      }
    }

    return {
      total: profileIds.length,
      successful: Array.from(results.values()).filter(r => r.success).length,
      results
    }
  }

  /**
   * Smart profile selector — choose profiles based on target requirements
   */
  selectProfilesForTarget(options: {
    targetOs: 'android' | 'ios' | 'both'
    targetDevices?: string[]  // "samsung", "pixel", "iphone", etc
    count: number
  }): string[] {
    // Query database for matching profiles
    // Filter by fingerprint preset OS + device type
    // Return top N matches
  }
}
```

---

## 6. Mobile Behavior Simulation Library

### File: `src/main/mobile-behavior.ts`
```typescript
export interface MobileBehaviorPattern {
  name: string
  description: string
  archetype: 'casual_browser' | 'power_user' | 'bot_evasion' | 'rapid_interactor'
  tapPattern: TapBehavior
  swipePattern: SwipeBehavior
  pausePattern: PauseBehavior
  viewportOrientation: 'portrait' | 'landscape' | 'random'
}

export class MobileBehaviorLibrary {
  // 10 pre-defined archetypes
  static ARCHETYPES = {
    'casual_browser': {
      // Random, slow interactions
      tapDelayMs: () => 200 + Math.random() * 300,
      swipeDurationMs: () => 600 + Math.random() * 400,
      pauseBetweenActionsMs: () => 1000 + Math.random() * 2000,
      scrollDistance: () => 300 + Math.random() * 200
    },
    'power_user': {
      // Fast, precise interactions
      tapDelayMs: () => 50 + Math.random() * 100,
      swipeDurationMs: () => 300 + Math.random() * 150,
      pauseBetweenActionsMs: () => 300 + Math.random() * 500,
      scrollDistance: () => 500 + Math.random() * 300
    },
    'bot_evasion': {
      // Highly randomized to avoid detection
      tapDelayMs: () => 100 + Math.random() * 500,
      swipeDurationMs: () => 400 + Math.random() * 600,
      pauseBetweenActionsMs: () => 1500 + Math.random() * 3000,
      scrollDistance: () => 200 + Math.random() * 400,
      // Also includes random tap misses, retaps
      missRate: 0.05,
      retapRate: 0.03
    }
    // ... more archetypes
  }

  /**
   * Inject behavior pattern into workflow
   */
  static applyBehaviorToWorkflow(
    workflow: MobileWorkflow,
    pattern: MobileBehaviorPattern
  ): MobileWorkflow {
    // Wrap each step with behavior delays
    return {
      ...workflow,
      steps: workflow.steps.map(step => ({
        ...step,
        behavior: {
          delay: pattern.tapPattern.delayMs?.(),
          pauseAfter: pattern.pausePattern.pauseBetweenActionsMs?.()
        }
      }))
    }
  }
}
```

---

## 7. Real Device Integration (Phase 18)

### File: `src/main/real-device-connector.ts`
```typescript
export class RealDeviceConnector {
  /**
   * Connect to Android device via ADB (Android Debug Bridge)
   */
  async connectAdbDevice(deviceId: string): Promise<AdbDevice> {
    // Use adb.js library (lightweight Node.js ADB client)
    // 1. List connected devices: adb devices
    // 2. Connect: adb connect <device>
    // 3. Get device info: adb shell getprop
    // 4. Enable WebDriver: adb shell settings put global webdriver 1
    // 5. Forward WebDriver port: adb forward tcp:4723 tcp:4723
  }

  /**
   * Launch Chromium on real Android device
   */
  async launchChromeOnDevice(
    deviceId: string,
    profileConfig: FingerprintConfig
  ): Promise<Page> {
    // 1. Use appium or chrome-remote-interface to connect
    // 2. Send CDP commands to device's Chrome instance
    // 3. Apply fingerprint via CDP injection
    // 4. Return Page object for automation
  }

  /**
   * For iOS: Use Appium + WebDriverAgent
   */
  async connectIosDevice(udid: string): Promise<IosDevice> {
    // Requires Xcode + WebDriverAgent binary
    // Launch with Appium server
  }
}
```

---

## 8. IPC Channels (New)

### File: `src/main/ipc/handlers.ts` (additions)
```typescript
// Mobile Workflow Management
ipcMain.handle('mobileWorkflow:create', async (event, workflow: MobileWorkflow) => {
  // Save to database
  // Return workflow ID
})

ipcMain.handle('mobileWorkflow:list', async () => {
  // List all mobile workflows
})

ipcMain.handle('mobileWorkflow:execute', async (event, workflowId: string, profileIds: string[]) => {
  // Execute workflow on profiles
  // Return execution ID for real-time tracking
})

ipcMain.handle('mobileWorkflow:executionStatus', async (event, executionId: string) => {
  // Get real-time execution status (via WebSocket or polling)
})

// Mobile Device Management
ipcMain.handle('mobileDevice:list', async () => {
  // List connected real devices (ADB, physical, etc)
})

ipcMain.handle('mobileDevice:connect', async (event, deviceId: string) => {
  // Connect to device via ADB/Appium
})

// Gesture Testing
ipcMain.handle('mobileGesture:test', async (event, gesture: GestureDefinition) => {
  // Test a single gesture on active page
  // Useful for UI debugging
})

// Behavior Pattern
ipcMain.handle('mobileBehavior:list', async () => {
  // List 10 pre-defined behavior archetypes
})

ipcMain.handle('mobileBehavior:apply', async (event, workflowId: string, pattern: string) => {
  // Apply behavior pattern to workflow
})
```

---

## 9. React Components (New)

### `src/renderer/src/components/MobileWorkflowBuilder/`

```
MobileWorkflowBuilder/
├── index.tsx                    # Main mobile workflow editor
├── MobileStepLibrary.tsx        # Gesture + sensor action palette
├── MobileDeviceSelector.tsx     # Profile/device multi-select
├── GestureVisualizer.tsx        # Show tap/swipe on device screen
├── BehaviorPatternSelector.tsx  # Select archetype
├── CrossDeviceExecutor.tsx      # Run on multiple profiles
├── ExecutionMonitor.tsx         # Real-time progress + logs
└── MobileProfileMapper.tsx      # Map workflow steps to profiles
```

#### Example: `MobileWorkflowBuilder/index.tsx`
```typescript
export function MobileWorkflowBuilder() {
  const [workflow, setWorkflow] = useState<MobileWorkflow>(null)
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [behaviorPattern, setBehaviorPattern] = useState('casual_browser')

  const handleAddGestureStep = (gesture: 'tap' | 'swipe' | 'pinch') => {
    // Add step to workflow
  }

  const handleExecute = async () => {
    // Call mobileWorkflow:execute IPC
    // Monitor progress in real-time
  }

  return (
    <div className="mobile-workflow-builder">
      <div className="left-panel">
        <MobileStepLibrary onSelectGesture={handleAddGestureStep} />
        <BehaviorPatternSelector value={behaviorPattern} onChange={setBehaviorPattern} />
      </div>

      <div className="center-panel">
        {/* Visual workflow editor */}
        <GestureVisualizer workflow={workflow} />
      </div>

      <div className="right-panel">
        <MobileDeviceSelector value={selectedProfiles} onChange={setSelectedProfiles} />
        <button onClick={handleExecute}>Execute on {selectedProfiles.length} profiles</button>
      </div>
    </div>
  )
}
```

---

## 10. Type Definitions (Shared)

### `src/shared/types.ts` (additions)
```typescript
// Mobile Workflow Types
export interface MobileWorkflow extends BaseWorkflow {
  type: 'mobile'
  steps: MobileAutomationStep[]
  deviceConfig: MobileDeviceConfig
  behaviorPattern?: string  // archetype name
}

export interface MobileAutomationStep extends AutomationStep {
  action: MobileAction | SensorAction | DeviceAction
  params: Record<string, any>
  deviceProfile?: string  // tie step to specific profile
  detectiveMode?: boolean // test anti-bot before step
}

export interface MobileDeviceConfig {
  targetProfiles: string[]
  executionMode: 'single' | 'parallel' | 'sequential'
  delayBetweenProfiles?: number
  stopOnError?: boolean
  timeoutPerStep?: number
  enableSensorMock?: boolean
  enableGestureMock?: boolean
}

export interface MobileExecutionContext {
  workflowId: string
  profileId: string
  deviceName: string
  startTime: number
  stopOnError: boolean
}

export interface SensorState {
  location?: {
    latitude: number
    longitude: number
    accuracy: number
    altitude?: number
  }
  accelerometer?: { x: number; y: number; z: number }
  gyroscope?: { x: number; y: number; z: number }
  proximity?: number
  ambientLight?: number
  battery?: number
  networkInfo?: string
}

export interface MobileExecutionResult extends AutomationRunResult {
  deviceName: string
  sensorState?: SensorState
  gestureCount: number
  metrics: ExecutionMetrics
}

export interface ExecutionMetrics {
  tapCount: number
  swipeCount: number
  scrollCount: number
  longPressCount: number
  totalDuration: number
  averageStepDuration: number
}

export interface MobileBehaviorPattern {
  id: string
  name: string
  archetype: 'casual_browser' | 'power_user' | 'bot_evasion' | 'rapid_interactor'
  tapDelayMs: () => number
  swipeDurationMs: () => number
  pauseBetweenActionsMs: () => number
  scrollDistance: () => number
  missRate?: number
  retapRate?: number
}

// Real Device Types
export interface AdbDevice {
  id: string
  name: string
  model: string
  androidVersion: string
  isConnected: boolean
  webdriverPort: number
}

export interface IosDevice {
  udid: string
  name: string
  model: string
  osVersion: string
  isConnected: boolean
}

export type RealDevice = AdbDevice | IosDevice
```

---

## 11. Phase Implementation Roadmap

### Phase 17 (Current) — Mobile Workflow Foundation
**Weeks 1–6**
- [x] Database schema extensions
- [x] MobileWorkflowEngine core class
- [x] 5 basic gestures (tap, swipe, pinch, long-press, double-tap)
- [x] 4 sensor mocks (geolocation, accelerometer, gyroscope, battery)
- [x] IPC channels for mobile operations
- [x] React MobileWorkflowBuilder component
- [x] 10 behavior archetypes

### Phase 18 (Next) — Real Device Integration + Advanced Evasion
**Weeks 7–12**
- [ ] ADB connector (Android real devices)
- [ ] Appium integrator (iOS real devices)
- [ ] Mobile anti-bot detection layer
- [ ] Adaptive gesture timing based on target site
- [ ] Mobile-specific CDP evasion (hide WebDriver, etc)
- [ ] Device rotation + viewport management

### Phase 19 — Batch Testing + ML Optimization
**Weeks 13–18**
- [ ] Batch mobile detection testing
- [ ] ML-based gesture optimization (learn from detections)
- [ ] Cross-profile behavior synchronization
- [ ] Mobile app automation (non-web)
- [ ] Network condition simulation (3G, 4G, 5G latency)

---

## 12. Technical Debt & Risks

| Risk | Mitigation |
|------|-----------|
| Puppeteer touchscreen API limited | Use CDP `Input.synthesize*Gesture` directly |
| Real device setup complexity | Provide Docker images with pre-configured ADB/Appium |
| iOS WebDriver licensing (Appium) | Plan trial period; consider WebdriverIO alternative |
| Cross-device sync overhead | Implement queueing + worker pool for parallel execution |
| Gesture detection by targets | Continuously update CDP evasion layer |

---

## 13. Success Metrics

- **Adoption**: 25% of workflows use mobile features within 2 months of launch
- **Detection Evasion**: Mobile workflows pass 80%+ of detection tests on SEA platforms (Shopee, Lazada, Tiktok Shop)
- **Performance**: Parallel 10-device workflows complete in <5min
- **UX**: Mobile workflow builder > 4.5/5 user rating
- **Reliability**: <2% step failure rate on production workflows

---

## Appendix A: Sample Mobile Workflow (Shopee Multi-Account Lister)

```json
{
  "id": "wf-shopee-multi-lister",
  "name": "Shopee Multi-Account Product Lister",
  "type": "mobile",
  "deviceConfig": {
    "targetProfiles": ["android-samsung-chrome120", "android-pixel-chrome121"],
    "executionMode": "parallel",
    "stopOnError": false
  },
  "behaviorPattern": "casual_browser",
  "steps": [
    {
      "id": "s1",
      "action": "navigate",
      "label": "Open Shopee",
      "params": { "url": "https://shopee.vn", "waitUntil": "networkidle2" }
    },
    {
      "id": "s2",
      "action": "waitForSelector",
      "label": "Wait for login button",
      "params": { "selector": "button[data-testid='login-button']" }
    },
    {
      "id": "s3",
      "action": "tapElement",
      "label": "Tap login button",
      "params": { "selector": "button[data-testid='login-button']", "duration": 100 }
    },
    {
      "id": "s4",
      "action": "setLocation",
      "label": "Mock location to Vietnam",
      "params": { "latitude": 10.8231, "longitude": 106.6297, "accuracy": 50 }
    },
    {
      "id": "s5",
      "action": "type",
      "label": "Enter email",
      "params": { "selector": "input[type='email']", "text": "seller@example.com" }
    },
    {
      "id": "s6",
      "action": "tapPoint",
      "label": "Tap password field",
      "params": { "x": 160, "y": 180 }
    },
    {
      "id": "s7",
      "action": "type",
      "label": "Enter password",
      "params": { "selector": "input[type='password']", "text": "SecurePassword123!" }
    },
    {
      "id": "s8",
      "action": "tapElement",
      "label": "Tap login submit",
      "params": { "selector": "button[type='submit']" }
    },
    {
      "id": "s9",
      "action": "scroll",
      "label": "Scroll to product section",
      "params": { "y": 800 }
    },
    {
      "id": "s10",
      "action": "extractText",
      "label": "Extract seller stats",
      "params": { "selector": "[data-testid='seller-stats']" }
    },
    {
      "id": "s11",
      "action": "screenshot",
      "label": "Screenshot dashboard",
      "params": { "fullPage": true }
    }
  ]
}
```

---

## Appendix B: Sample Real Device Workflow (Phase 18)

```typescript
// Example: Connect real iPhone and run workflow
const connector = new RealDeviceConnector()
const iosDevice = await connector.connectIosDevice('00A8C12345')

const workflow = await db.getWorkflow('wf-shopee-multi-lister')
const result = await mobileEngine.executeWorkflow(
  workflow,
  'ios-iphone14-safari17',
  {
    workflowId: workflow.id,
    profileId: 'ios-iphone14-safari17',
    deviceName: 'iPhone 14 (Real)',
    device: iosDevice,  // NEW: pass real device
    stopOnError: false
  }
)

console.log(`✅ Executed on real device: ${result.duration}ms, ${result.steps.length} steps`)
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-10  
**Next Review**: Phase 18 Kickoff  
**Authored by**: Claude (AI Assistant)  
**Status**: Ready for Implementation Review
