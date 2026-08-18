/** Types shared between the Electron main process and the React renderer. */

export type QualityPreset = 'small' | 'balanced' | 'high'
export type Direction = 'forward' | 'reverse' | 'boomerang'
export type LoopMode = 'infinite' | 'once'

/** Crop rectangle in NORMALISED coordinates (0–1) relative to the source video.
 *  Normalised rather than pixels so resizing the preview window can never
 *  invalidate a crop the user already set. */
export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface VideoInfo {
  path: string
  name: string
  /** seconds */
  duration: number
  /** source pixels */
  width: number
  height: number
}

export interface GifSettings {
  sourcePath: string
  /** seconds */
  start: number
  end: number
  fps: number
  /** requested output width in px; clamped to never upscale */
  width: number
  quality: QualityPreset
  direction: Direction
  /** playback multiplier, 1 = normal */
  speed: number
  loop: LoopMode
  crop: CropRect | null
  sourceWidth: number
  sourceHeight: number
}

export type ConvertStage = 'palette' | 'encode'

export interface ConvertProgress {
  jobId: string
  stage: ConvertStage
  /** 0–1, only meaningful when stage === 'encode' */
  percent: number
}

export type ConvertResult =
  | { ok: true; outputPath: string; size: number }
  | { ok: false; canceled: true }
  | { ok: false; canceled?: false; error: string }

export const QUALITY_LABELS: Record<QualityPreset, string> = {
  small: 'Small file',
  balanced: 'Balanced',
  high: 'High quality'
}
