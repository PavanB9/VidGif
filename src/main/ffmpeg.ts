/** Locating the bundled ffmpeg binary, and running it with progress + cancel. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { app } from 'electron'

const require = createRequire(import.meta.url)

/**
 * ffmpeg-static exports the absolute path to its binary as a bare string.
 *
 * In a packaged build that path lands inside app.asar — and a binary CANNOT be
 * executed from inside an asar archive. electron-builder.yml therefore lists
 * ffmpeg-static under `asarUnpack`, which puts the real file in
 * app.asar.unpacked; rewriting the path here is the other half of that pair.
 * Change one without the other and `npm run dev` still works while the
 * installed app fails at the first conversion.
 */
function resolveFfmpegPath(): string {
  const raw = require('ffmpeg-static') as string | null
  if (!raw) {
    throw new Error(
      'ffmpeg-static did not resolve a binary path. Run `npm install` to download it.'
    )
  }
  // Handles both path separators, so this works on macOS and Windows alike.
  const resolved = app.isPackaged ? raw.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1') : raw

  if (!existsSync(resolved)) {
    throw new Error(
      `Bundled ffmpeg is missing at:\n${resolved}\n\n` +
        'If this is a packaged build, check the `asarUnpack` entry in electron-builder.yml.'
    )
  }
  return resolved
}

let cached: string | null = null
export function ffmpegPath(): string {
  if (!cached) cached = resolveFfmpegPath()
  return cached
}

/** Parses `out_time=00:00:01.234000` from ffmpeg's -progress stream. */
function parseOutTime(line: string): number | null {
  const m = /^out_time=(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(line.trim())
  if (!m) return null
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

export interface FfmpegRun {
  /** Resolves on clean exit; rejects on non-zero exit or spawn failure. */
  done: Promise<void>
  cancel: () => void
}

export interface RunOptions {
  /** Called with output-stream position in seconds (requires -progress pipe:1). */
  onTime?: (seconds: number) => void
}

export class FfmpegError extends Error {}
export class FfmpegCanceled extends Error {}

export interface ProbeResult {
  duration: number
  width: number
  height: number
}

/**
 * Reads duration and dimensions straight from ffmpeg.
 *
 * We deliberately do NOT rely on the renderer's <video> element for this.
 * Chromium refuses to decode some codecs (HEVC from iPhones being the common
 * case on Windows), and if metadata came from <video> those files would be
 * unconvertible rather than merely unpreviewable. ffmpeg reads them all.
 *
 * Invoking ffmpeg with an input and no output makes it print the stream summary
 * and exit non-zero immediately — far cheaper than decoding, and it avoids
 * taking on ffprobe as a second dependency.
 */
export function probeVideo(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ['-hide_banner', '-nostdin', '-i', filePath], {
      windowsHide: true
    })
    let out = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (c: string) => {
      out += c
    })
    child.on('error', (err) => reject(new FfmpegError(err.message)))
    child.on('close', () => {
      const dur = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(out)
      const videoLine = /Video:.*/.exec(out)
      const size = videoLine ? /\b(\d{2,5})x(\d{2,5})\b/.exec(videoLine[0]) : null

      if (!dur || !size) {
        return reject(new FfmpegError('Could not read video information from this file.'))
      }

      const duration = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])
      let width = Number(size[1])
      let height = Number(size[2])

      // ffmpeg auto-rotates on decode, so a portrait clip recorded by a phone
      // reports its pre-rotation (landscape) dimensions here. Swap them, or the
      // crop rectangle would be mapped against the wrong aspect ratio.
      const rotation = /rotation of (-?[\d.]+) degrees/.exec(out)
      if (rotation) {
        const deg = Math.abs(Number(rotation[1])) % 180
        if (deg === 90) [width, height] = [height, width]
      }

      resolve({ duration, width, height })
    })
  })
}

export function runFfmpeg(args: string[], opts: RunOptions = {}): FfmpegRun {
  // No `shell: true` — we want a direct handle to ffmpeg so kill() actually
  // terminates it rather than an intermediate shell that leaves it orphaned.
  const child: ChildProcessWithoutNullStreams = spawn(ffmpegPath(), args, {
    windowsHide: true
  }) as ChildProcessWithoutNullStreams

  let canceled = false
  let stderr = ''
  let stdoutBuf = ''

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    if (!opts.onTime) return
    stdoutBuf += chunk
    const lines = stdoutBuf.split(/\r?\n/)
    stdoutBuf = lines.pop() ?? ''
    for (const line of lines) {
      const t = parseOutTime(line)
      if (t !== null) opts.onTime(t)
    }
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    // -loglevel error keeps this small; retained for the failure message.
    stderr += chunk
    if (stderr.length > 8000) stderr = stderr.slice(-8000)
  })

  const done = new Promise<void>((resolve, reject) => {
    child.on('error', (err) => reject(new FfmpegError(err.message)))
    child.on('close', (code) => {
      if (canceled) return reject(new FfmpegCanceled('Canceled'))
      if (code === 0) return resolve()
      reject(new FfmpegError(stderr.trim() || `ffmpeg exited with code ${code}`))
    })
  })

  return {
    done,
    cancel: () => {
      canceled = true
      child.kill('SIGKILL')
    }
  }
}
