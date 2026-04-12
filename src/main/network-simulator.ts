import { Database } from './database'
import { BrowserManager } from './browser-manager'
import type {
  NetworkCondition,
  NetworkConditionPreset,
  NetworkSimulationConfig,
  NetworkSimulationResult
} from '../shared/types'

/**
 * Phase 19.4 — Network Condition Simulation
 *
 * Applies realistic network conditions (2G-5G, WiFi, satellite) to
 * browser profiles via Chrome DevTools Protocol. Tests workflow robustness
 * under constrained network environments typical of SEA markets.
 *
 * Parameters are based on real-world measurements:
 * - Throughput in bytes/sec
 * - Latency in milliseconds
 * - Packet loss as a percentage (0-100)
 * - Jitter as additional random latency variation in ms
 */
export class NetworkSimulator {
  private static instance: NetworkSimulator
  private activeSimulations = new Map<string, NetworkSimulationConfig>()

  static getInstance(): NetworkSimulator {
    if (!NetworkSimulator.instance) {
      NetworkSimulator.instance = new NetworkSimulator()
    }
    return NetworkSimulator.instance
  }

  /** Apply network conditions to a running profile's browser session */
  async apply(profileId: string, preset: NetworkConditionPreset): Promise<NetworkSimulationResult> {
    const condition = this.getPreset(preset)
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions?.get(profileId)

    if (!session) {
      throw new Error(`Profile ${profileId} is not running — launch it first`)
    }

    try {
      const pages = await session.browser.pages()
      const page = pages[0]
      if (!page) throw new Error('No page available')

      const cdpSession = await page.createCDPSession()

      // Apply network emulation via CDP
      await cdpSession.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: condition.downloadThroughput,
        uploadThroughput: condition.uploadThroughput,
        latency: condition.latency + Math.random() * condition.jitter
      })

      this.activeSimulations.set(profileId, {
        profileId,
        condition,
        enabled: true
      })

      return {
        profileId,
        preset,
        applied: true,
        effectiveLatency: condition.latency,
        effectiveThroughput: condition.downloadThroughput
      }
    } catch (err: any) {
      return {
        profileId,
        preset,
        applied: false,
        effectiveLatency: 0,
        effectiveThroughput: 0
      }
    }
  }

  /** Remove network throttling from a profile */
  async clear(profileId: string): Promise<void> {
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions?.get(profileId)

    if (session) {
      try {
        const pages = await session.browser.pages()
        const page = pages[0]
        if (page) {
          const cdpSession = await page.createCDPSession()
          await cdpSession.send('Network.emulateNetworkConditions', {
            offline: false,
            downloadThroughput: -1,
            uploadThroughput: -1,
            latency: 0
          })
        }
      } catch {
        // Session may have closed
      }
    }

    this.activeSimulations.delete(profileId)
  }

  /** Get current simulation status for a profile */
  getStatus(profileId: string): NetworkSimulationConfig | null {
    return this.activeSimulations.get(profileId) ?? null
  }

  /** List all active simulations */
  listActive(): NetworkSimulationConfig[] {
    return Array.from(this.activeSimulations.values())
  }

  /** Get all available presets */
  listPresets(): NetworkCondition[] {
    return NETWORK_PRESETS.map((p) => ({ ...p }))
  }

  /** Get a specific preset by name */
  getPreset(preset: NetworkConditionPreset): NetworkCondition {
    const found = NETWORK_PRESETS.find((p) => p.preset === preset)
    if (!found) throw new Error(`Unknown network preset: ${preset}`)
    return { ...found }
  }
}

// ── Network Condition Presets ──────────────────────────────────────────────

const NETWORK_PRESETS: NetworkCondition[] = [
  {
    preset: '2g',
    label: '2G (GPRS)',
    downloadThroughput: 6_250,      // 50 kbps
    uploadThroughput: 2_500,        // 20 kbps
    latency: 500,
    packetLoss: 2,
    jitter: 200
  },
  {
    preset: '3g',
    label: '3G (HSPA+)',
    downloadThroughput: 187_500,    // 1.5 Mbps
    uploadThroughput: 93_750,       // 750 kbps
    latency: 100,
    packetLoss: 0.5,
    jitter: 50
  },
  {
    preset: '4g',
    label: '4G LTE',
    downloadThroughput: 2_500_000,  // 20 Mbps
    uploadThroughput: 1_250_000,    // 10 Mbps
    latency: 30,
    packetLoss: 0.1,
    jitter: 10
  },
  {
    preset: '5g',
    label: '5G',
    downloadThroughput: 12_500_000, // 100 Mbps
    uploadThroughput: 6_250_000,    // 50 Mbps
    latency: 5,
    packetLoss: 0.01,
    jitter: 2
  },
  {
    preset: 'wifi',
    label: 'Wi-Fi (Home)',
    downloadThroughput: 3_750_000,  // 30 Mbps
    uploadThroughput: 1_875_000,    // 15 Mbps
    latency: 15,
    packetLoss: 0.05,
    jitter: 5
  },
  {
    preset: 'satellite',
    label: 'Satellite',
    downloadThroughput: 625_000,    // 5 Mbps
    uploadThroughput: 125_000,      // 1 Mbps
    latency: 600,
    packetLoss: 1,
    jitter: 100
  },
  {
    preset: 'custom',
    label: 'Custom',
    downloadThroughput: 2_500_000,
    uploadThroughput: 1_250_000,
    latency: 50,
    packetLoss: 0,
    jitter: 0
  }
]
