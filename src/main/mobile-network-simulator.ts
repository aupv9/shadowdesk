/**
 * Phase 18: Mobile Network Simulator
 *
 * Simulates different mobile network conditions (2G, 3G, 4G, 5G, WiFi)
 * with realistic latency, bandwidth, and packet loss characteristics.
 *
 * Used to:
 * - Match target region network patterns (4G in SEA, etc.)
 * - Simulate realistic page load times
 * - Evade detection based on unnaturally fast connections
 * - Test behavior under slow networks
 */

export type NetworkType = '2g' | '3g' | '4g' | '5g' | 'wifi' | 'ethernet'

export interface NetworkProfile {
  type: NetworkType
  downloadSpeed: number // Mbps
  uploadSpeed: number // Mbps
  latency: number // ms
  packetLoss: number // %
  jitterMs: number // variance in latency
}

/**
 * Realistic mobile network profiles based on real-world measurements.
 */
export const NETWORK_PROFILES: Record<NetworkType, NetworkProfile> = {
  '2g': {
    type: '2g',
    downloadSpeed: 0.4,
    uploadSpeed: 0.1,
    latency: 400,
    packetLoss: 5,
    jitterMs: 200
  },
  '3g': {
    type: '3g',
    downloadSpeed: 1.5,
    uploadSpeed: 0.5,
    latency: 200,
    packetLoss: 2,
    jitterMs: 100
  },
  '4g': {
    type: '4g',
    downloadSpeed: 10,
    uploadSpeed: 5,
    latency: 50,
    packetLoss: 0.5,
    jitterMs: 20
  },
  '5g': {
    type: '5g',
    downloadSpeed: 100,
    uploadSpeed: 50,
    latency: 20,
    packetLoss: 0.1,
    jitterMs: 5
  },
  wifi: {
    type: 'wifi',
    downloadSpeed: 30,
    uploadSpeed: 15,
    latency: 30,
    packetLoss: 0.2,
    jitterMs: 10
  },
  ethernet: {
    type: 'ethernet',
    downloadSpeed: 100,
    uploadSpeed: 100,
    latency: 10,
    packetLoss: 0,
    jitterMs: 2
  }
}

export class MobileNetworkSimulator {
  private static instance: MobileNetworkSimulator

  static getInstance(): MobileNetworkSimulator {
    if (!MobileNetworkSimulator.instance) {
      MobileNetworkSimulator.instance = new MobileNetworkSimulator()
    }
    return MobileNetworkSimulator.instance
  }

  /**
   * Apply network throttling via Chrome DevTools Protocol.
   */
  async applyNetworkProfile(page: any, profile: NetworkProfile | NetworkType): Promise<void> {
    const config = typeof profile === 'string' ? NETWORK_PROFILES[profile] : profile

    const client = await page.createCDPSession()
    try {
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: (config.downloadSpeed * 1024 * 1024) / 8, // Convert Mbps to bytes/sec
        uploadThroughput: (config.uploadSpeed * 1024 * 1024) / 8,
        latency: config.latency + (Math.random() - 0.5) * config.jitterMs
      })
    } finally {
      await client.detach()
    }
  }

  /**
   * Simulate network request delays realistic for the profile.
   */
  async simulateNetworkDelay(profile: NetworkProfile | NetworkType): Promise<void> {
    const config = typeof profile === 'string' ? NETWORK_PROFILES[profile] : profile

    // Simulate latency with jitter
    const latency = config.latency + (Math.random() - 0.5) * config.jitterMs
    await new Promise((r) => setTimeout(r, Math.max(0, latency)))

    // Simulate packet loss (retry)
    if (Math.random() * 100 < config.packetLoss) {
      // Simulate retry delay
      await new Promise((r) => setTimeout(r, latency * 2))
    }
  }

  /**
   * Get realistic effective bandwidth for region.
   * For SEA countries: typically 4G with 10-20 Mbps
   */
  getSeaRegionProfile(): NetworkProfile {
    // Blend of 4G and 5G with realistic SEA stats
    const isFast = Math.random() > 0.3 // 30% chance of 5G
    const baseProfile = isFast ? NETWORK_PROFILES['5g'] : NETWORK_PROFILES['4g']

    return {
      ...baseProfile,
      // Add regional variance
      downloadSpeed: baseProfile.downloadSpeed * (0.7 + Math.random() * 0.3),
      uploadSpeed: baseProfile.uploadSpeed * (0.7 + Math.random() * 0.3),
      latency: baseProfile.latency + (Math.random() - 0.5) * 30
    }
  }

  /**
   * Simulate bandwidth-limited file download.
   */
  async downloadWithBandwidth(
    url: string,
    profile: NetworkProfile | NetworkType,
    page: any
  ): Promise<Buffer> {
    const config = typeof profile === 'string' ? NETWORK_PROFILES[profile] : profile

    // Apply network profile
    await this.applyNetworkProfile(page, config)

    // Fetch with simulated delays
    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
    if (!response || !response.ok()) {
      throw new Error(`Failed to download: ${response?.status}`)
    }

    // Simulate bandwidth-limited reading
    const content = await response.buffer()
    const bytes = content.length
    const expectedTimeMs = (bytes * 8) / (config.downloadSpeed * 1024 * 1024) * 1000

    // Only sleep if expected time is significant
    if (expectedTimeMs > 100) {
      await new Promise((r) => setTimeout(r, expectedTimeMs * 0.5))
    }

    return content
  }

  /**
   * Get profile matching Android version + region.
   */
  getProfileForAndroidRegion(androidVersion: string, region: string = 'sea'): NetworkProfile {
    // SEA regions (Vietnam, Thailand, Indonesia) typically use 4G
    if (region.toLowerCase() === 'sea') {
      return this.getSeaRegionProfile()
    }

    // Default to balanced profile
    return NETWORK_PROFILES['4g']
  }
}
