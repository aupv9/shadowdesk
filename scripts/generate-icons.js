#!/usr/bin/env node
/**
 * Generates resources/icon.{png,ico,icns} for electron-builder.
 *
 * Written against Node's stdlib only (zlib + Buffer) on purpose: the build
 * machine has no ImageMagick, and pulling sharp/jimp in just to draw one mark
 * would add a native dependency to a packaging step that runs in CI.
 *
 * The mark is drawn analytically at every output size rather than downscaled
 * from one bitmap, so the 16px favicon stays as crisp as the 1024px one.
 *
 *   node scripts/generate-icons.js
 */

const zlib = require('zlib')
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

// ── Brand palette (tailwind.config.js `ghost` scale) ─────────────────────────
const GRAD_TOP = [0x81, 0x8c, 0xf8] // ghost-400
const GRAD_BOTTOM = [0x43, 0x38, 0xca] // ghost-700
const MARK = [0xff, 0xff, 0xff]

/** Supersampling factor per axis. 4 => 16 samples/pixel. */
const SS = 4

// ── Shape definition, in a 0..1 unit square ──────────────────────────────────

const DOME_CY = 0.48
const DOME_R = 0.265
const SKIRT_MID = 0.745
const SKIRT_AMP = 0.042
const EYE_R = 0.046
const EYE_Y = 0.445
const EYE_DX = 0.105
const CORNER_R = 0.22

/** Lower edge of the ghost's skirt at a given x — three scalloped humps. */
function skirtY(x) {
  const t = (x - (0.5 - DOME_R)) / (2 * DOME_R)
  return SKIRT_MID - SKIRT_AMP * Math.cos(t * 6 * Math.PI)
}

function inGhost(x, y) {
  const dx = x - 0.5
  if (Math.abs(dx) > DOME_R) return false
  if (y < DOME_CY) {
    const dy = y - DOME_CY
    return dx * dx + dy * dy <= DOME_R * DOME_R
  }
  return y <= skirtY(x)
}

function inEye(x, y) {
  const dy = y - EYE_Y
  for (const cx of [0.5 - EYE_DX, 0.5 + EYE_DX]) {
    const dx = x - cx
    if (dx * dx + dy * dy <= EYE_R * EYE_R) return true
  }
  return false
}

/** Rounded-square backplate covering the full canvas. */
function inPlate(x, y) {
  const r = CORNER_R
  const cx = Math.min(Math.max(x, r), 1 - r)
  const cy = Math.min(Math.max(y, r), 1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

// ── Rasteriser ───────────────────────────────────────────────────────────────

/** Renders the icon at `size` px and returns a raw RGBA buffer. */
function render(size) {
  const px = Buffer.alloc(size * size * 4)
  const step = 1 / (size * SS)
  const half = step / 2

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let plateHits = 0
      let markHits = 0

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (pxi * SS + sx) * step + half
          const y = (py * SS + sy) * step + half
          if (!inPlate(x, y)) continue
          plateHits++
          if (inGhost(x, y) && !inEye(x, y)) markHits++
        }
      }

      const samples = SS * SS
      const i = (py * size + pxi) * 4
      if (plateHits === 0) continue // fully transparent corner

      // Vertical gradient across the plate.
      const g = (py + 0.5) / size
      const bg = [
        Math.round(GRAD_TOP[0] + (GRAD_BOTTOM[0] - GRAD_TOP[0]) * g),
        Math.round(GRAD_TOP[1] + (GRAD_BOTTOM[1] - GRAD_TOP[1]) * g),
        Math.round(GRAD_TOP[2] + (GRAD_BOTTOM[2] - GRAD_TOP[2]) * g)
      ]

      // Composite the mark over the gradient, then the plate over transparency.
      const markCov = markHits / samples
      const plateCov = plateHits / samples
      px[i] = Math.round(bg[0] + (MARK[0] - bg[0]) * markCov)
      px[i + 1] = Math.round(bg[1] + (MARK[1] - bg[1]) * markCov)
      px[i + 2] = Math.round(bg[2] + (MARK[2] - bg[2]) * markCov)
      px[i + 3] = Math.round(255 * plateCov)
    }
  }

  return px
}

// ── PNG encoding ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const src = y * size * 4
    const dst = y * (size * 4 + 1)
    raw[dst] = 0
    rgba.copy(raw, dst + 1, src, src + size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ── Container formats ────────────────────────────────────────────────────────

/** Vista-era .ico: a directory of embedded PNGs. */
function encodeIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)

  const dir = Buffer.alloc(16 * entries.length)
  let offset = header.length + dir.length

  entries.forEach(({ size, png }, i) => {
    const o = i * 16
    dir[o] = size >= 256 ? 0 : size // 0 means 256
    dir[o + 1] = size >= 256 ? 0 : size
    dir[o + 2] = 0 // palette size
    dir[o + 3] = 0 // reserved
    dir.writeUInt16LE(1, o + 4) // colour planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += png.length
  })

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

/** .icns: 'icns' magic, total length, then OSType-tagged PNG members. */
function encodeIcns(members) {
  const blocks = members.map(({ ostype, png }) => {
    const head = Buffer.alloc(8)
    head.write(ostype, 0, 4, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })

  const body = Buffer.concat(blocks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 4, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

// ── Main ─────────────────────────────────────────────────────────────────────

const OUT = join(__dirname, '..', 'resources')
mkdirSync(OUT, { recursive: true })

const cache = new Map()
const pngAt = (size) => {
  if (!cache.has(size)) cache.set(size, encodePng(size, render(size)))
  return cache.get(size)
}

writeFileSync(join(OUT, 'icon.png'), pngAt(1024))

writeFileSync(
  join(OUT, 'icon.ico'),
  encodeIco([16, 32, 48, 64, 128, 256].map((size) => ({ size, png: pngAt(size) })))
)

writeFileSync(
  join(OUT, 'icon.icns'),
  encodeIcns([
    { ostype: 'ic11', png: pngAt(32) },
    { ostype: 'ic12', png: pngAt(64) },
    { ostype: 'ic07', png: pngAt(128) },
    { ostype: 'ic13', png: pngAt(256) },
    { ostype: 'ic08', png: pngAt(256) },
    { ostype: 'ic14', png: pngAt(512) },
    { ostype: 'ic09', png: pngAt(512) },
    { ostype: 'ic10', png: pngAt(1024) }
  ])
)

console.log('Wrote resources/icon.png, icon.ico, icon.icns')
