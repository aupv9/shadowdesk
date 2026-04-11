import { execSync } from 'child_process'
import type { Page } from 'puppeteer-core'

/**
 * Phase 18: ADB Connector
 *
 * Manages Android Debug Bridge connections for real Android device automation.
 * Handles device discovery, connectivity checks, port forwarding, and Chrome
 * remote debugging protocol (CDP) connections.
 */

export interface AndroidDevice {
  id: string
  name: string
  model: string
  androidVersion: string
  isConnected: boolean
  isEmulator: boolean
  webdriverPort: number
  lastHealthCheck?: number
  error?: string
}

export class AdbConnector {
  private static instance: AdbConnector
  private devices: Map<string, AndroidDevice> = new Map()
  private portMap: Map<string, number> = new Map() // device ID -> webdriver port

  static getInstance(): AdbConnector {
    if (!AdbConnector.instance) {
      AdbConnector.instance = new AdbConnector()
    }
    return AdbConnector.instance
  }

  /**
   * Discover all connected Android devices via `adb devices`.
   */
  async discoverDevices(): Promise<AndroidDevice[]> {
    try {
      const output = execSync('adb devices -l', { encoding: 'utf-8' })
      const devices: AndroidDevice[] = []

      const lines = output.split('\n').slice(1) // Skip header
      for (const line of lines) {
        if (!line.trim()) continue
        const match = line.match(/^(\S+)\s+device\s+(.*)/)
        if (!match) continue

        const [, deviceId, props] = match
        const info = this.parseDeviceProps(props)

        const device: AndroidDevice = {
          id: deviceId,
          name: info.name || deviceId,
          model: info.model || 'Unknown',
          androidVersion: info.release || 'Unknown',
          isConnected: true,
          isEmulator: deviceId.includes('emulator'),
          webdriverPort: this.getOrAllocatePort(deviceId),
          lastHealthCheck: Date.now()
        }

        devices.push(device)
        this.devices.set(deviceId, device)
      }

      return devices
    } catch (err: any) {
      console.warn('[AdbConnector] Device discovery failed:', err.message)
      return []
    }
  }

  /**
   * Check device health — can we connect and run basic commands.
   */
  async checkDeviceHealth(deviceId: string): Promise<boolean> {
    try {
      execSync(`adb -s ${deviceId} shell getprop ro.build.version.release`, {
        encoding: 'utf-8',
        timeout: 5000
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Enable Chrome WebDriver on device for CDP connections.
   */
  async enableWebDriver(deviceId: string): Promise<void> {
    try {
      // Set WebDriver flag in Chrome
      execSync(`adb -s ${deviceId} shell settings put global webdriver 1`, {
        timeout: 5000
      })

      // Get WebDriver port (usually 9222 on device, forward to local port)
      const localPort = this.getOrAllocatePort(deviceId)
      execSync(`adb -s ${deviceId} forward tcp:${localPort} tcp:9222`, {
        timeout: 5000
      })

      console.log(`[AdbConnector] WebDriver enabled on ${deviceId}:${localPort}`)
    } catch (err: any) {
      throw new Error(`Failed to enable WebDriver on ${deviceId}: ${err.message}`)
    }
  }

  /**
   * Launch Chrome on the device.
   */
  async launchChrome(deviceId: string, url?: string): Promise<void> {
    try {
      const chromeCmd = url
        ? `adb -s ${deviceId} shell am start -n com.android.chrome/com.google.android.apps.chrome.Main -d ${url}`
        : `adb -s ${deviceId} shell am start -n com.android.chrome/com.google.android.apps.chrome.Main`

      execSync(chromeCmd, { timeout: 10000 })
      console.log(`[AdbConnector] Chrome launched on ${deviceId}`)
    } catch (err: any) {
      throw new Error(`Failed to launch Chrome on ${deviceId}: ${err.message}`)
    }
  }

  /**
   * Close Chrome on the device.
   */
  async closeChrome(deviceId: string): Promise<void> {
    try {
      execSync(`adb -s ${deviceId} shell am force-stop com.android.chrome`, {
        timeout: 5000
      })
    } catch {
      // Ignore if already closed
    }
  }

  /**
   * Take screenshot from device.
   */
  async takeScreenshot(deviceId: string, outputPath: string): Promise<void> {
    try {
      const devicePath = '/sdcard/screenshot.png'
      execSync(`adb -s ${deviceId} shell screencap -p ${devicePath}`, {
        timeout: 10000
      })
      execSync(`adb -s ${deviceId} pull ${devicePath} ${outputPath}`, {
        timeout: 10000
      })
      execSync(`adb -s ${deviceId} shell rm ${devicePath}`, {
        timeout: 5000
      })
    } catch (err: any) {
      throw new Error(`Failed to take screenshot: ${err.message}`)
    }
  }

  /**
   * Get WebDriver port for device (used for CDP connection).
   */
  getWebDriverPort(deviceId: string): number {
    return this.getOrAllocatePort(deviceId)
  }

  /**
   * Get CDP endpoint URL for remote debugging.
   */
  getCdpEndpoint(deviceId: string): string {
    const port = this.getOrAllocatePort(deviceId)
    return `http://localhost:${port}`
  }

  /**
   * Disconnect all devices.
   */
  async disconnectAll(): Promise<void> {
    for (const [deviceId, device] of this.devices) {
      try {
        await this.closeChrome(deviceId)
      } catch {
        // Ignore
      }
    }
    this.devices.clear()
    this.portMap.clear()
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private parseDeviceProps(props: string): Record<string, string> {
    const result: Record<string, string> = {}
    const pairs = props.split(/\s+/)
    for (const pair of pairs) {
      const [key, value] = pair.split(':')
      if (key && value) {
        result[key] = value
      }
    }
    return result
  }

  private getOrAllocatePort(deviceId: string): number {
    if (!this.portMap.has(deviceId)) {
      // Allocate port: 9222 + hash of device ID
      const hash = deviceId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
      const port = 9222 + (hash % 100)
      this.portMap.set(deviceId, port)
    }
    return this.portMap.get(deviceId)!
  }
}
