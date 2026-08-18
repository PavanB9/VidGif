/**
 * Pure ffmpeg argument construction — no I/O, no Electron imports, no spawning.
 * Kept side-effect free so the generated command can be reasoned about (and
 * tested) in isolation. This is where GIF quality actually comes from.
 */
import type { GifSettings } from '@shared/types'
import { cropPixels, outputDimensions, sourceDuration } from '@shared/geometry'

export { outputDuration } from '@shared/geometry'

const QUALITY = {
  small: { colors: 64, dither: 'bayer:bayer_scale=5' },
  balanced: { colors: 160, dither: 'bayer:bayer_scale=3' },
  high: { colors: 256, dither: 'sierra2_4a' }
} as const

/**
 * Filter order is deliberate:
 *   crop   — first, so everything downstream works on fewer pixels
 *   setpts — speed change before fps resampling, so fps means output fps
 *   fps    — drop frames before scaling, so we scale as few as possible
 *   scale  — lanczos gives noticeably crisper downscales than bilinear
 */
function baseChain(s: GifSettings): string {
  const parts: string[] = []
  const c = cropPixels(s)
  if (c) parts.push(`crop=${c.w}:${c.h}:${c.x}:${c.y}`)
  if (s.speed !== 1) parts.push(`setpts=${(1 / s.speed).toFixed(6)}*PTS`)
  parts.push(`fps=${s.fps}`)
  parts.push(`scale=${outputDimensions(s).width}:-2:flags=lanczos`)
  return parts.join(',')
}

/**
 * Produces the filtergraph up to a `[v]` label holding the finished frames.
 *
 * `reverse` buffers every frame in memory, so it runs last — after fps and
 * scale have already thrown most of the data away.
 *
 * Boomerang detail: the reversed half starts with a copy of the forward half's
 * final frame, so the loop visibly stutters at the turnaround. `trim=
 * start_frame=1` drops it, and `setpts=PTS-STARTPTS` rebases the timestamps
 * that trim leaves behind (concat requires them to start at zero).
 */
function videoGraph(s: GifSettings): string {
  const chain = baseChain(s)
  switch (s.direction) {
    case 'boomerang':
      return (
        `[0:v]${chain},split[fwd][pre];` +
        `[pre]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[rev];` +
        `[fwd][rev]concat=n=2:v=1:a=0[v]`
      )
    case 'reverse':
      return `[0:v]${chain},reverse[v]`
    default:
      return `[0:v]${chain}[v]`
  }
}

/** `-ss` before `-i` seeks by keyframe index (fast); modern ffmpeg is still
 *  frame-accurate in this position because it decodes forward to the target. */
function inputArgs(s: GifSettings): string[] {
  return ['-ss', s.start.toFixed(3), '-t', sourceDuration(s).toFixed(3), '-i', s.sourcePath]
}

const COMMON = ['-hide_banner', '-nostdin', '-y', '-loglevel', 'error']

/**
 * Pass 1 — analyse the clip and build an optimal colour table.
 * `stats_mode=diff` biases the palette toward pixels that actually change,
 * which is what stops moving subjects from banding.
 */
export function palettePassArgs(s: GifSettings, palettePath: string): string[] {
  const { colors } = QUALITY[s.quality]
  return [
    ...COMMON,
    ...inputArgs(s),
    '-an',
    '-sn',
    '-filter_complex',
    `${videoGraph(s)};[v]palettegen=max_colors=${colors}:stats_mode=diff[out]`,
    '-map',
    '[out]',
    '-frames:v',
    '1',
    palettePath
  ]
}

/**
 * Pass 2 — encode using that palette.
 * `diff_mode=rectangle` lets the encoder leave untouched regions alone between
 * frames, which is the single biggest file-size win available here.
 */
export function encodePassArgs(s: GifSettings, palettePath: string, outputPath: string): string[] {
  const { dither } = QUALITY[s.quality]
  return [
    ...COMMON,
    ...inputArgs(s),
    '-i',
    palettePath,
    '-an',
    '-sn',
    '-filter_complex',
    `${videoGraph(s)};[v][1:v]paletteuse=dither=${dither}:diff_mode=rectangle[out]`,
    '-map',
    '[out]',
    // gif muxer: 0 = loop forever, -1 = play once
    '-loop',
    s.loop === 'infinite' ? '0' : '-1',
    '-f',
    'gif',
    '-progress',
    'pipe:1',
    '-nostats',
    outputPath
  ]
}
