/** Two-pass GIF conversion: palettegen → paletteuse, with progress and cancel. */
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ConvertProgress, ConvertResult, GifSettings } from '@shared/types'
import { encodePassArgs, outputDuration, palettePassArgs } from './filters'
import { FfmpegCanceled, runFfmpeg, type FfmpegRun } from './ffmpeg'

interface Job {
  current: FfmpegRun | null
  canceled: boolean
  tempDir: string | null
}

const jobs = new Map<string, Job>()

/** Best-effort cleanup of any temp dirs still around at quit. */
export async function cleanupAllJobs(): Promise<void> {
  await Promise.all(
    [...jobs.values()].map(async (job) => {
      job.canceled = true
      job.current?.cancel()
      if (job.tempDir) await rm(job.tempDir, { recursive: true, force: true }).catch(() => {})
    })
  )
  jobs.clear()
}

export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  job.canceled = true
  job.current?.cancel()
  return true
}

export async function convert(
  jobId: string,
  settings: GifSettings,
  outputPath: string,
  onProgress: (p: ConvertProgress) => void
): Promise<ConvertResult> {
  const job: Job = { current: null, canceled: false, tempDir: null }
  jobs.set(jobId, job)

  try {
    job.tempDir = await mkdtemp(join(tmpdir(), 'vidgif-'))
    const palettePath = join(job.tempDir, 'palette.png')

    // Pass 1. palettegen emits a single frame only at end-of-stream, so its
    // -progress output would jump straight from 0 to done — there is no honest
    // percentage to show. The UI renders this stage as indeterminate instead.
    onProgress({ jobId, stage: 'palette', percent: 0 })
    job.current = runFfmpeg(palettePassArgs(settings, palettePath))
    await job.current.done
    if (job.canceled) return { ok: false, canceled: true }

    // Pass 2 does have a real output timeline, so this stage is determinate.
    const total = outputDuration(settings)
    onProgress({ jobId, stage: 'encode', percent: 0 })
    job.current = runFfmpeg(encodePassArgs(settings, palettePath, outputPath), {
      onTime: (seconds) => {
        const percent = total > 0 ? Math.min(1, seconds / total) : 0
        onProgress({ jobId, stage: 'encode', percent })
      }
    })
    await job.current.done
    if (job.canceled) return { ok: false, canceled: true }

    onProgress({ jobId, stage: 'encode', percent: 1 })
    const { size } = await stat(outputPath)
    return { ok: true, outputPath, size }
  } catch (err) {
    if (err instanceof FfmpegCanceled || job.canceled) return { ok: false, canceled: true }
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    if (job.tempDir) await rm(job.tempDir, { recursive: true, force: true }).catch(() => {})
    jobs.delete(jobId)
  }
}
