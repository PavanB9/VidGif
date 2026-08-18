/**
 * Generates resources/icon.png — a 512×512 app icon in the Stone palette.
 * electron-builder derives the .ico and .icns from it at package time.
 *
 * Written with only Node's stdlib (zlib) so the repo needs no image tooling.
 * Edges are antialiased by 4×4 supersampling each pixel.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 512
const SS = 4 // supersample factor per axis

const STONE_700 = [68, 64, 60]
const STONE_950 = [12, 10, 9]
const STONE_50 = [250, 250, 249]

const lerp = (a, b, t) => a + (b - a) * t

function inRoundedRect(x, y, size, radius) {
  const min = radius
  const max = size - radius
  const cx = x < min ? min : x > max ? max : x
  const cy = y < min ? min : y > max ? max : y
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius
}

/** Right-pointing play triangle, with the corners visually rounded off. */
function inTriangle(x, y) {
  const verts = [
    [196, 142],
    [196, 370],
    [378, 256]
  ]
  let inside = true
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = verts[i]
    const [bx, by] = verts[(i + 1) % 3]
    // Cross product sign tells us which side of the edge the point is on.
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) > 0) inside = false
  }
  return inside
}

const rgba = Buffer.alloc(SIZE * SIZE * 4)

for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    let bgHits = 0
    let fgHits = 0
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) / SS
        const y = py + (sy + 0.5) / SS
        if (inRoundedRect(x, y, SIZE, 112)) bgHits++
        if (inTriangle(x, y)) fgHits++
      }
    }
    const total = SS * SS
    const bgA = bgHits / total
    const fgA = fgHits / total

    // Vertical gradient, stone-700 down to stone-950.
    const t = py / (SIZE - 1)
    const base = [
      lerp(STONE_700[0], STONE_950[0], t),
      lerp(STONE_700[1], STONE_950[1], t),
      lerp(STONE_700[2], STONE_950[2], t)
    ]

    // Composite the play mark over the gradient, then the whole thing over
    // transparency using the rounded-rect coverage as the alpha.
    const r = lerp(base[0], STONE_50[0], fgA)
    const g = lerp(base[1], STONE_50[1], fgA)
    const b = lerp(base[2], STONE_50[2], fgA)

    const i = (py * SIZE + px) * 4
    rgba[i] = Math.round(r)
    rgba[i + 1] = Math.round(g)
    rgba[i + 2] = Math.round(b)
    rgba[i + 3] = Math.round(255 * bgA)
  }
}

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // colour type: RGBA
// bytes 10–12 stay zero: deflate, adaptive filtering, no interlace

// Each scanline is prefixed with its filter type (0 = none).
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`Wrote ${out} (${SIZE}×${SIZE}, ${(png.length / 1024).toFixed(1)} KB)`)
