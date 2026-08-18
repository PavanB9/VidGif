/**
 * Pure geometry/duration maths shared by the ffmpeg command builder (main) and
 * the size/frame readouts (renderer). Single source of truth so the numbers
 * shown in the UI always match what ffmpeg is actually told to do.
 */
import type { GifSettings, QualityPreset } from './types'

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** GIF dimensions must be even for most scalers/encoders to behave. */
export const even = (n: number): number => Math.max(2, Math.floor(n / 2) * 2)

export function cropPixels(s: GifSettings): { x: number; y: number; w: number; h: number } | null {
  if (!s.crop) return null
  const sw = s.sourceWidth
  const sh = s.sourceHeight
  const w = clamp(even(Math.round(s.crop.width * sw)), 2, even(sw))
  const h = clamp(even(Math.round(s.crop.height * sh)), 2, even(sh))
  const x = clamp(Math.round(s.crop.x * sw), 0, sw - w)
  const y = clamp(Math.round(s.crop.y * sh), 0, sh - h)
  return { x, y, w, h }
}

/** Width is clamped to the (possibly cropped) source width — upscaling a GIF
 *  only inflates the file without adding any detail. */
export function outputDimensions(s: GifSettings): { width: number; height: number } {
  const c = cropPixels(s)
  const srcW = c ? c.w : s.sourceWidth
  const srcH = c ? c.h : s.sourceHeight
  if (srcW <= 0 || srcH <= 0) return { width: 2, height: 2 }
  const width = even(clamp(s.width, 16, srcW))
  const height = even(Math.round((width * srcH) / srcW))
  return { width, height }
}

/** Span of SOURCE footage handed to ffmpeg, before the speed filter. */
export function sourceDuration(s: GifSettings): number {
  return Math.max(0.05, s.end - s.start)
}

/** Wall-clock length of the finished GIF. Drives the encode progress bar. */
export function outputDuration(s: GifSettings): number {
  const d = sourceDuration(s) / s.speed
  return s.direction === 'boomerang' ? d * 2 : d
}

export function frameCount(s: GifSettings): number {
  const forward = Math.max(1, Math.round((sourceDuration(s) / s.speed) * s.fps))
  // Boomerang appends the reversed half minus the duplicated turnaround frame.
  return s.direction === 'boomerang' ? forward * 2 - 1 : forward
}

/** Rough bytes-per-pixel-per-frame after palette reduction + LZW. */
const BPP: Record<QualityPreset, number> = { small: 0.06, balanced: 0.1, high: 0.15 }

/**
 * GIF size cannot be known without actually encoding, so this is explicitly an
 * estimate — the UI labels it with a "~". The real size replaces it once the
 * render finishes.
 */
export function estimateBytes(s: GifSettings): number {
  const { width, height } = outputDimensions(s)
  return Math.round(width * height * frameCount(s) * BPP[s.quality])
}
