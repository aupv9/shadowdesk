import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'
import { BrowserManager } from './browser-manager'
import { getMobileBehaviorArchetype, randomInRange } from './mobile-behavior'
import type {
  MobileAutomationStep,
  MobileWorkflow,
  MobileStepResult,
  MobileExecutionResult,
  MobileExecutionMetrics,
  SensorState,
  MobileBehaviorArchetype
} from '../shared/types'
import type { Page } from 'puppeteer-core'

/**
 * Phase 17: Mobile Workflow Engine
 *
 * Handles gesture injection (tap, swipe, pinch, long-press), sensor simulation
 * (geolocation, accelerometer, gyroscope, battery, network info) and device
 * control (viewport, rotation) on Chromium mobile emulation profiles.
 *
 * Execution flow:
 *   1. Resolve behavior archetype (timing delays, miss rates)
 *   2. For each step, apply behavior-adjusted delays
 *   3. Execute via Puppeteer touchscreen / CDP Input.synthesize* APIs
 *   4. Collect metrics + sensor state
 *   5. Persist execution log to database
 */
export class MobileWorkflowEngine {
  private static instance: MobileWorkflowEngine

  static getInstance(): MobileWorkflowEngine {
    if (!MobileWorkflowEngine.instance) {
      MobileWorkflowEngine.instance = new MobileWorkflowEngine()
    }
    return MobileWorkflowEngine.instance
  }

  /**
   * Execute a mobile workflow on a single profile.
   */
  async executeWorkflow(
    workflow: MobileWorkflow,
    profileId: string,
    page: Page
  ): Promise<MobileExecutionResult> {
    const db = Database.getInstance()
    const executionId = uuidv4()
    const startTime = Date.now()

    // Resolve behavior archetype
    const archetype = workflow.behaviorPattern
      ? getMobileBehaviorArchetype(workflow.behaviorPattern as any)
      : null

    // Log start
    db.addMobileExecutionLog({
      id: executionId,
      workflow_id: workflow.id,
      profile_id: profileId,
      device_name: this.resolveDeviceName(profileId),
      status: 'running'
    })

    const metrics: MobileExecutionMetrics = {
      tapCount: 0,
      swipeCount: 0,
      scrollCount: 0,
      longPressCount: 0,
      pinchCount: 0,
      totalDuration: 0,
      averageStepDuration: 0
    }

    const sensorState: SensorState = {}
    const stepResults: MobileStepResult[] = []
    let lastError: string | undefined

    try {
      for (const step of workflow.steps) {
        // Pre-step behavior delay
        if (archetype) {
          const pause = randomInRange(archetype.pauseRange[0], archetype.pauseRange[1])
          await this.sleep(pause)
        }

        const stepStart = Date.now()
        const result = await this.executeStep(step, page, archetype, sensorState, metrics)
        result.duration = Date.now() - stepStart
        stepResults.push(result)

        if (!result.success && workflow.deviceConfig.stopOnError) {
          lastError = result.error
          break
        }
      }

      const totalDuration = Date.now() - startTime
      metrics.totalDuration = totalDuration
      metrics.averageStepDuration = stepResults.length > 0
        ? totalDuration / stepResults.length
        : 0

      const allSuccess = stepResults.every((r) => r.success)
      const status = allSuccess ? 'success' : 'failed'

      // Persist
      db.updateMobileExecutionLog(executionId, {
        status,
        step_results: stepResults,
        metrics,
        sensor_state: sensorState,
        duration_ms: totalDuration,
        error_message: lastError
      })

      return {
        executionId,
        workflowId: workflow.id,
        profileId,
        deviceName: this.resolveDeviceName(profileId),
        success: allSuccess,
        duration: totalDuration,
        steps: stepResults,
        metrics,
        sensorState,
        error: lastError
      }
    } catch (err: any) {
      const totalDuration = Date.now() - startTime
      db.updateMobileExecutionLog(executionId, {
        status: 'failed',
        step_results: stepResults,
        metrics,
        duration_ms: totalDuration,
        error_message: err.message
      })

      return {
        executionId,
        workflowId: workflow.id,
        profileId,
        deviceName: this.resolveDeviceName(profileId),
        success: false,
        duration: totalDuration,
        steps: stepResults,
        metrics,
        error: err.message
      }
    }
  }

  /**
   * Execute a single mobile step.
   */
  private async executeStep(
    step: MobileAutomationStep,
    page: Page,
    archetype: MobileBehaviorArchetype | null,
    sensorState: SensorState,
    metrics: MobileExecutionMetrics
  ): Promise<MobileStepResult> {
    const timeout = step.timeout ?? 30000
    try {
      const result = await Promise.race([
        this.dispatchAction(step, page, archetype, sensorState, metrics),
        this.timeoutPromise(timeout)
      ])
      return { stepId: step.id, action: step.action, success: true, duration: 0, ...result }
    } catch (err: any) {
      return { stepId: step.id, action: step.action, success: false, duration: 0, error: err.message }
    }
  }

  private async dispatchAction(
    step: MobileAutomationStep,
    page: Page,
    archetype: MobileBehaviorArchetype | null,
    sensorState: SensorState,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const p = step.params

    switch (step.action) {
      // ── Gesture Actions ─────────────────────────────────────────────────
      case 'tapPoint':
        return this.handleTapPoint(page, p, archetype, metrics)
      case 'tapElement':
        return this.handleTapElement(page, p, archetype, metrics)
      case 'swipe':
        return this.handleSwipe(page, p, archetype, metrics)
      case 'longPress':
        return this.handleLongPress(page, p, archetype, metrics)
      case 'doubleTap':
        return this.handleDoubleTap(page, p, archetype, metrics)
      case 'pinch':
        return this.handlePinch(page, p, metrics)
      case 'dragDrop':
        return this.handleDragDrop(page, p, metrics)

      // ── Sensor Actions ──────────────────────────────────────────────────
      case 'setLocation':
        return this.handleSetLocation(page, p, sensorState)
      case 'setAccelerometer':
        return this.handleSetAccelerometer(page, p, sensorState)
      case 'setGyroscope':
        return this.handleSetGyroscope(page, p, sensorState)
      case 'setBattery':
        return this.handleSetBattery(page, p, sensorState)
      case 'setNetworkInfo':
        return this.handleSetNetworkInfo(page, p, sensorState)

      // ── Device Control ──────────────────────────────────────────────────
      case 'rotateDevice':
        return this.handleRotateDevice(page, p)
      case 'setViewport':
        return this.handleSetViewport(page, p)

      // ── Passthrough to standard desktop actions ─────────────────────────
      case 'navigate':
        await page.goto(p.url, { waitUntil: p.waitUntil ?? 'networkidle2', timeout })
        return {}
      case 'wait':
        await this.sleep(p.ms ?? 1000)
        return {}
      case 'waitForSelector':
        await page.waitForSelector(p.selector, {
          visible: p.visible ?? true,
          timeout: p.timeout ?? 10000
        })
        return {}
      case 'type':
        await page.type(p.selector, p.text, { delay: p.delay ?? 50 })
        return {}
      case 'click':
        await page.click(p.selector)
        return {}
      case 'screenshot':
        await page.screenshot({ fullPage: p.fullPage ?? false })
        return {}
      case 'scroll':
        await page.evaluate((y: number) => window.scrollBy(0, y), p.y ?? 500)
        metrics.scrollCount++
        return {}
      case 'extractText': {
        const text = await page.$eval(p.selector, (el: Element) => el.textContent ?? '')
        return { extractedText: text } as any
      }

      default:
        throw new Error(`Unknown mobile action: ${step.action}`)
    }
  }

  // ── Gesture Handlers ──────────────────────────────────────────────────────

  private async handleTapPoint(
    page: Page,
    p: Record<string, any>,
    archetype: MobileBehaviorArchetype | null,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const jitter = p.jitterEnabled !== false ? 2 : 0
    const x = p.x + (Math.random() - 0.5) * jitter
    const y = p.y + (Math.random() - 0.5) * jitter

    // Simulate occasional miss if archetype demands it
    if (archetype && Math.random() < archetype.missRate) {
      const missX = x + (Math.random() - 0.5) * 20
      const missY = y + (Math.random() - 0.5) * 20
      await page.touchscreen.tap(missX, missY)
      const retapDelay = archetype ? randomInRange(archetype.tapDelayRange[0], archetype.tapDelayRange[1]) : 200
      await this.sleep(retapDelay)
    }

    await page.touchscreen.tap(x, y)

    if (p.duration) {
      await this.sleep(p.duration)
    }

    metrics.tapCount++
    return {}
  }

  private async handleTapElement(
    page: Page,
    p: Record<string, any>,
    archetype: MobileBehaviorArchetype | null,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const el = await page.$(p.selector)
    if (!el) throw new Error(`Element not found: ${p.selector}`)

    const box = await el.boundingBox()
    if (!box) throw new Error(`Element has no bounding box: ${p.selector}`)

    const x = box.x + box.width / 2 + (Math.random() - 0.5) * 4
    const y = box.y + box.height / 2 + (Math.random() - 0.5) * 4

    await page.touchscreen.tap(x, y)

    if (p.duration) await this.sleep(p.duration)

    metrics.tapCount++
    return {}
  }

  private async handleSwipe(
    page: Page,
    p: Record<string, any>,
    archetype: MobileBehaviorArchetype | null,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const duration = p.duration ?? (archetype
      ? randomInRange(archetype.swipeDurationRange[0], archetype.swipeDurationRange[1])
      : 500)
    const count = p.count ?? 1

    for (let i = 0; i < count; i++) {
      // Use CDP Input.synthesizeScrollGesture for reliable swipe
      const client = await page.createCDPSession()
      try {
        await client.send('Input.synthesizeScrollGesture', {
          x: p.fromX ?? 180,
          y: p.fromY ?? 400,
          xDistance: (p.toX ?? p.fromX ?? 180) - (p.fromX ?? 180),
          yDistance: (p.toY ?? 200) - (p.fromY ?? 400),
          speed: Math.round(1000 * Math.abs((p.fromY ?? 400) - (p.toY ?? 200)) / duration),
          gestureSourceType: 'touch'
        })
      } finally {
        await client.detach()
      }

      if (count > 1 && i < count - 1) {
        await this.sleep(archetype ? randomInRange(200, 600) : 300)
      }
    }

    metrics.swipeCount += count
    return {}
  }

  private async handleLongPress(
    page: Page,
    p: Record<string, any>,
    archetype: MobileBehaviorArchetype | null,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const duration = p.duration ?? 800
    const x = p.x ?? 180
    const y = p.y ?? 300

    // If selector provided, resolve to coords
    let tapX = x
    let tapY = y
    if (p.selector) {
      const el = await page.$(p.selector)
      if (el) {
        const box = await el.boundingBox()
        if (box) {
          tapX = box.x + box.width / 2
          tapY = box.y + box.height / 2
        }
      }
    }

    const client = await page.createCDPSession()
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: tapX, y: tapY }]
      })
      await this.sleep(duration)
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      })
    } finally {
      await client.detach()
    }

    metrics.longPressCount++
    return {}
  }

  private async handleDoubleTap(
    page: Page,
    p: Record<string, any>,
    archetype: MobileBehaviorArchetype | null,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const x = p.x ?? 180
    const y = p.y ?? 300

    await page.touchscreen.tap(x, y)
    await this.sleep(80 + Math.random() * 40)
    await page.touchscreen.tap(x, y)

    metrics.tapCount += 2
    return {}
  }

  private async handlePinch(
    page: Page,
    p: Record<string, any>,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const client = await page.createCDPSession()
    try {
      await client.send('Input.synthesizePinchGesture', {
        x: p.centerX ?? 180,
        y: p.centerY ?? 400,
        scaleFactor: p.scaleFactor ?? 2.0,
        relativeSpeed: p.speed ?? 300,
        gestureSourceType: 'touch'
      })
    } finally {
      await client.detach()
    }

    if (p.duration) await this.sleep(p.duration)

    metrics.pinchCount++
    return {}
  }

  private async handleDragDrop(
    page: Page,
    p: Record<string, any>,
    metrics: MobileExecutionMetrics
  ): Promise<Partial<MobileStepResult>> {
    const client = await page.createCDPSession()
    try {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: p.fromX ?? 100, y: p.fromY ?? 300 }]
      })

      // Interpolate
      const steps = 10
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps
        const cx = (p.fromX ?? 100) + ((p.toX ?? 250) - (p.fromX ?? 100)) * progress
        const cy = (p.fromY ?? 300) + ((p.toY ?? 500) - (p.fromY ?? 300)) * progress
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: cx, y: cy }]
        })
        await this.sleep((p.duration ?? 500) / steps)
      }

      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      })
    } finally {
      await client.detach()
    }
    return {}
  }

  // ── Sensor Handlers ───────────────────────────────────────────────────────

  private async handleSetLocation(
    page: Page,
    p: Record<string, any>,
    sensorState: SensorState
  ): Promise<Partial<MobileStepResult>> {
    sensorState.location = {
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy ?? 50,
      altitude: p.altitude
    }

    const client = await page.createCDPSession()
    try {
      await client.send('Emulation.setGeolocationOverride', {
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy: p.accuracy ?? 50
      })
    } finally {
      await client.detach()
    }
    return {}
  }

  private async handleSetAccelerometer(
    page: Page,
    p: Record<string, any>,
    sensorState: SensorState
  ): Promise<Partial<MobileStepResult>> {
    sensorState.accelerometer = { x: p.x ?? 0, y: p.y ?? -9.8, z: p.z ?? 0 }

    await page.evaluateOnNewDocument(`
      (function() {
        const accelData = { x: ${p.x ?? 0}, y: ${p.y ?? -9.8}, z: ${p.z ?? 0} };
        window.addEventListener('devicemotion', function() {}, { once: true });
        Object.defineProperty(DeviceMotionEvent.prototype, 'acceleration', {
          get() {
            return { x: accelData.x, y: accelData.y, z: accelData.z };
          }
        });
      })();
    `)
    return {}
  }

  private async handleSetGyroscope(
    page: Page,
    p: Record<string, any>,
    sensorState: SensorState
  ): Promise<Partial<MobileStepResult>> {
    sensorState.gyroscope = { x: p.alpha ?? 0, y: p.beta ?? 0, z: p.gamma ?? 0 }

    await page.evaluateOnNewDocument(`
      (function() {
        const gyroData = { alpha: ${p.alpha ?? 0}, beta: ${p.beta ?? 0}, gamma: ${p.gamma ?? 0} };
        Object.defineProperty(DeviceOrientationEvent.prototype, 'alpha', { get() { return gyroData.alpha; } });
        Object.defineProperty(DeviceOrientationEvent.prototype, 'beta', { get() { return gyroData.beta; } });
        Object.defineProperty(DeviceOrientationEvent.prototype, 'gamma', { get() { return gyroData.gamma; } });
      })();
    `)
    return {}
  }

  private async handleSetBattery(
    page: Page,
    p: Record<string, any>,
    sensorState: SensorState
  ): Promise<Partial<MobileStepResult>> {
    const level = (p.level ?? 80) / 100
    const charging = p.charging ?? false
    sensorState.battery = { level: p.level ?? 80, charging }

    await page.evaluateOnNewDocument(`
      (function() {
        if (navigator.getBattery) {
          const original = navigator.getBattery;
          navigator.getBattery = function() {
            return Promise.resolve({
              charging: ${charging},
              chargingTime: ${charging ? 3600 : 'Infinity'},
              dischargingTime: ${charging ? 'Infinity' : 14400},
              level: ${level},
              addEventListener: function() {},
              removeEventListener: function() {},
              dispatchEvent: function() { return true; },
              onchargingchange: null,
              onchargingtimechange: null,
              ondischargingtimechange: null,
              onlevelchange: null
            });
          };
        }
      })();
    `)
    return {}
  }

  private async handleSetNetworkInfo(
    page: Page,
    p: Record<string, any>,
    sensorState: SensorState
  ): Promise<Partial<MobileStepResult>> {
    const type = p.type ?? '4g'
    const downlink = p.downlink ?? 10
    const rtt = p.rtt ?? 50
    sensorState.networkInfo = { type, downlink, rtt }

    await page.evaluateOnNewDocument(`
      (function() {
        if (navigator.connection) {
          Object.defineProperties(navigator.connection, {
            effectiveType: { get: () => '${type}', configurable: true },
            downlink: { get: () => ${downlink}, configurable: true },
            rtt: { get: () => ${rtt}, configurable: true },
            saveData: { get: () => false, configurable: true }
          });
        }
      })();
    `)
    return {}
  }

  // ── Device Control ────────────────────────────────────────────────────────

  private async handleRotateDevice(
    page: Page,
    p: Record<string, any>
  ): Promise<Partial<MobileStepResult>> {
    const viewport = page.viewport()
    if (!viewport) return {}

    const isLandscape = p.orientation === 'landscape'
    const width = isLandscape ? Math.max(viewport.width, viewport.height) : Math.min(viewport.width, viewport.height)
    const height = isLandscape ? Math.min(viewport.width, viewport.height) : Math.max(viewport.width, viewport.height)

    await page.setViewport({
      ...viewport,
      width,
      height,
      isLandscape
    })
    return {}
  }

  private async handleSetViewport(
    page: Page,
    p: Record<string, any>
  ): Promise<Partial<MobileStepResult>> {
    await page.setViewport({
      width: p.width ?? 375,
      height: p.height ?? 812,
      deviceScaleFactor: p.deviceScaleFactor ?? 3,
      isMobile: true,
      hasTouch: true,
      isLandscape: p.isLandscape ?? false
    })
    return {}
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private resolveDeviceName(profileId: string): string {
    const db = Database.getInstance()
    const profile = db.getProfile(profileId)
    if (!profile) return 'Unknown Device'
    try {
      const fp = typeof profile.fingerprint === 'string'
        ? JSON.parse(profile.fingerprint)
        : profile.fingerprint
      return fp?.os?.name
        ? `${fp.os.name} ${fp.os.version ?? ''}`.trim()
        : profile.name
    } catch {
      return profile.name
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Step timed out after ${ms}ms`)), ms)
    )
  }
}
