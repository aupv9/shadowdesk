/**
 * Gathers the four realms the coherence rules compare.
 *
 * Kept apart from `coherence.ts` on purpose: the rules stay pure and
 * unit-testable, and everything that needs a live page lives here.
 */
import { createHash } from 'crypto'
import type { Page } from 'puppeteer-core'
import type { MainSnapshot, RealmSnapshot, RenderHashes } from './coherence'

/** How long ICE gathering and realm probes get before we give up on them. */
const REALM_TIMEOUT_MS = 4000

export async function collectMain(page: Page): Promise<MainSnapshot> {
  return page.evaluate(() => {
    const nav = navigator as any
    let webglVendor: string | undefined
    let webglRenderer: string | undefined
    try {
      const gl = document.createElement('canvas').getContext('webgl') as WebGLRenderingContext | null
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
      if (gl && dbg) {
        webglVendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL))
        webglRenderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      }
    } catch { /* no WebGL — leave undefined so R2 reports unavailable */ }

    return {
      userAgent: nav.userAgent,
      platform: nav.platform,
      language: nav.language,
      languages: Array.from(nav.languages ?? []).map(String),
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      uachPlatform: nav.userAgentData?.platform,
      uaBrands: nav.userAgentData?.brands?.map((b: any) => ({ brand: b.brand, version: b.version })),
      webglVendor,
      webglRenderer,
      maxTouchPoints: nav.maxTouchPoints ?? 0,
      hasTouchStart: 'ontouchstart' in window,
      pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        pixelRatio: window.devicePixelRatio
      }
    }
  })
}

/**
 * Reads identity out of a dedicated worker.
 *
 * Overrides installed with `evaluateOnNewDocument` do not automatically reach
 * worker scope, which is exactly why this is worth checking.
 */
export async function collectWorker(page: Page): Promise<RealmSnapshot | null> {
  return page.evaluate((timeout) => {
    return new Promise<RealmSnapshot | null>((resolve) => {
      try {
        const src = `self.onmessage = () => postMessage({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          languages: Array.from(navigator.languages || []),
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: navigator.deviceMemory
        })`
        const url = URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))
        const worker = new Worker(url)
        const done = (v: RealmSnapshot | null) => {
          clearTimeout(timer)
          worker.terminate()
          URL.revokeObjectURL(url)
          resolve(v)
        }
        const timer = setTimeout(() => done(null), timeout)
        worker.onmessage = (e) => done(e.data)
        worker.onerror = () => done(null)
        worker.postMessage('go')
      } catch {
        resolve(null)
      }
    })
  }, REALM_TIMEOUT_MS)
}

/**
 * Reads identity out of a same-origin `about:blank` iframe — the other realm
 * injection commonly misses.
 */
export async function collectIframe(page: Page): Promise<RealmSnapshot | null> {
  return page.evaluate(() => {
    try {
      const frame = document.createElement('iframe')
      frame.style.display = 'none'
      document.documentElement.appendChild(frame)
      const win = frame.contentWindow as any
      if (!win) {
        frame.remove()
        return null
      }
      const nav = win.navigator
      const snapshot: RealmSnapshot = {
        userAgent: nav.userAgent,
        platform: nav.platform,
        languages: Array.from(nav.languages ?? []).map(String),
        hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemory: nav.deviceMemory
      }
      frame.remove()
      return snapshot
    } catch {
      return null
    }
  })
}

/**
 * Hashes what the profile actually paints and plays.
 *
 * These are the rendered outputs, not the configured seeds — R11/R12 compare
 * pixels precisely because two different configs can still produce one image.
 */
export async function collectRenderHashes(page: Page): Promise<RenderHashes> {
  const raw = await page.evaluate(() => {
    const out = { canvas: '', webgl: '', audio: '' }

    try {
      const c = document.createElement('canvas')
      c.width = 240
      c.height = 60
      const ctx = c.getContext('2d')!
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(0, 0, 100, 30)
      ctx.fillStyle = '#069'
      ctx.fillText('ShadowDesk coherence', 2, 15)
      out.canvas = c.toDataURL()
    } catch { /* leave empty — rule treats it as nothing to compare */ }

    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl') as WebGLRenderingContext | null
      if (gl) {
        const buf = new Uint8Array(4 * 64)
        gl.clearColor(0.2, 0.4, 0.6, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.readPixels(0, 0, 8, 8, gl.RGBA, gl.UNSIGNED_BYTE, buf)
        out.webgl = Array.from(buf).join(',')
      }
    } catch { /* no WebGL */ }

    return out
  })

  // Audio is measured out-of-band: OfflineAudioContext needs its own await and
  // throws on some headless configurations.
  let audio = ''
  try {
    audio = await page.evaluate(() => {
      return new Promise<string>((resolve) => {
        try {
          const OfflineCtx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext
          const ctx = new OfflineCtx(1, 4410, 44100)
          const osc = ctx.createOscillator()
          osc.type = 'triangle'
          osc.frequency.value = 10000
          const comp = ctx.createDynamicsCompressor()
          osc.connect(comp)
          comp.connect(ctx.destination)
          osc.start(0)
          ctx.startRendering()
          ctx.oncomplete = (e: any) => {
            const data = e.renderedBuffer.getChannelData(0)
            let sum = 0
            for (let i = 0; i < data.length; i++) sum += Math.abs(data[i])
            resolve(String(sum))
          }
          setTimeout(() => resolve(''), 2000)
        } catch {
          resolve('')
        }
      })
    })
  } catch { /* leave empty */ }

  const digest = (s: string) => (s ? createHash('sha256').update(s).digest('hex').slice(0, 32) : '')
  return { canvas: digest(raw.canvas), webgl: digest(raw.webgl), audio: digest(audio) }
}

/** Public IPs that ICE candidate gathering exposes. */
export async function collectWebrtcPublicIps(page: Page): Promise<string[]> {
  return page.evaluate((timeout) => {
    return new Promise<string[]>((resolve) => {
      const found = new Set<string>()
      try {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
        pc.createDataChannel('probe')
        pc.onicecandidate = (e) => {
          if (!e.candidate) return
          const m = /([0-9]{1,3}(?:\.[0-9]{1,3}){3})/.exec(e.candidate.candidate)
          if (!m) return
          const ip = m[1]
          // Skip RFC1918 / loopback / link-local — only a public IP is a leak.
          if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return
          found.add(ip)
        }
        pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {})
        setTimeout(() => {
          pc.close()
          resolve([...found])
        }, timeout)
      } catch {
        resolve([])
      }
    })
  }, REALM_TIMEOUT_MS)
}
