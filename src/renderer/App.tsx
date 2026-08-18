import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type {
  ConvertProgress,
  ConvertStage,
  CropRect,
  Direction,
  GifSettings,
  LoopMode,
  QualityPreset,
  VideoInfo
} from '@shared/types'
import { estimateBytes, frameCount, outputDimensions } from '@shared/geometry'
import DropZone from './components/DropZone'
import ExportBar from './components/ExportBar'
import SettingsPanel, { ASPECT_PRESETS, type AspectId } from './components/SettingsPanel'
import Timeline from './components/Timeline'
import VideoPreview from './components/VideoPreview'
import { Button } from './components/ui'
import { formatTime } from './lib/format'

type Status = 'idle' | 'converting' | 'done' | 'error'

/** crypto.randomUUID needs a secure context; this keeps job ids working anywhere. */
function makeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `job-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Centred starting crop, honouring a locked aspect if one is active. */
function initialCrop(ratio: number | null, sourceAspect: number): CropRect {
  if (ratio === null) return { x: 0.1, y: 0.1, width: 0.8, height: 0.8 }
  const norm = ratio / sourceAspect
  let width = 0.8
  let height = width / norm
  if (height > 0.8) {
    height = 0.8
    width = height * norm
  }
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height }
}

export default function App(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const jobIdRef = useRef<string | null>(null)

  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [previewFailed, setPreviewFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)

  const [fps, setFps] = useState(15)
  const [width, setWidth] = useState(480)
  const [quality, setQuality] = useState<QualityPreset>('balanced')
  const [direction, setDirection] = useState<Direction>('forward')
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState<LoopMode>('infinite')
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [aspect, setAspect] = useState<AspectId>('free')

  const [status, setStatus] = useState<Status>('idle')
  const [stage, setStage] = useState<ConvertStage>('palette')
  const [percent, setPercent] = useState(0)
  const [result, setResult] = useState<{ outputPath: string; size: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const maxWidth = crop && video ? Math.round(crop.width * video.width) : (video?.width ?? 0)

  /**
   * `width` holds the user's PREFERENCE; `effectiveWidth` is what actually gets
   * used. Cropping lowers the ceiling, but overwriting the preference would
   * ratchet it down permanently — remove the crop and you'd be stuck at the
   * cropped width. Deriving it means the choice comes back when the crop goes.
   */
  const effectiveWidth = maxWidth > 0 ? Math.min(width, maxWidth) : width

  const settings: GifSettings | null = useMemo(() => {
    if (!video) return null
    return {
      sourcePath: video.path,
      start,
      end,
      fps,
      width: effectiveWidth,
      quality,
      direction,
      speed,
      loop,
      crop,
      sourceWidth: video.width,
      sourceHeight: video.height
    }
  }, [video, start, end, fps, effectiveWidth, quality, direction, speed, loop, crop])

  const loadVideo = useCallback(async (path: string) => {
    try {
      setLoadError(null)
      setPreviewFailed(false)
      // ffmpeg is the source of truth for duration/dimensions — see probeVideo.
      const info = await window.vidgif.probe(path)
      const url = await window.vidgif.mediaUrl(path)
      setVideo(info)
      setVideoUrl(url)
      setStart(0)
      setEnd(info.duration)
      setCurrent(0)
      setPlaying(false)
      setCrop(null)
      setAspect('free')
      setWidth(Math.min(480, info.width))
      setStatus('idle')
      setResult(null)
      setError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const chooseFile = useCallback(async () => {
    const path = await window.vidgif.openVideo()
    if (path) await loadVideo(path)
  }, [loadVideo])

  // Menu item File → Open Video…
  useEffect(() => window.vidgif.onRequestOpen(() => void chooseFile()), [chooseFile])

  useEffect(
    () =>
      window.vidgif.onProgress((p: ConvertProgress) => {
        if (jobIdRef.current !== p.jobId) return
        setStage(p.stage)
        setPercent(p.percent)
      }),
    []
  )

  // Drive play/pause from state so the button and spacebar stay in sync.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (playing) void el.play().catch(() => setPlaying(false))
    else el.pause()
  }, [playing, videoUrl])

  // rAF rather than the `timeupdate` event, which only fires ~4×/second and
  // makes the playhead visibly stutter.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = (): void => {
      const el = videoRef.current
      if (el) {
        if (el.currentTime >= end) el.currentTime = start
        setCurrent(el.currentTime)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, start, end])

  const seek = useCallback((t: number) => {
    const el = videoRef.current
    if (el) el.currentTime = t
    setCurrent(t)
  }, [])

  const lockedRatio = ASPECT_PRESETS.find((p) => p.id === aspect)?.ratio ?? null
  const sourceAspect = video && video.height > 0 ? video.width / video.height : 16 / 9

  const applyAspect = useCallback(
    (id: AspectId) => {
      setAspect(id)
      const ratio = ASPECT_PRESETS.find((p) => p.id === id)?.ratio ?? null
      if (ratio !== null) setCrop(initialCrop(ratio, sourceAspect))
    },
    [sourceAspect]
  )

  const toggleCrop = useCallback(() => {
    if (crop) {
      setCrop(null)
      setAspect('free')
    } else {
      setCrop(initialCrop(lockedRatio, sourceAspect))
    }
  }, [crop, lockedRatio, sourceAspect])

  const createGif = useCallback(async () => {
    if (!video || !settings) return
    const suggested = await window.vidgif.suggestOutput(video.path)
    const outputPath = await window.vidgif.chooseOutput(suggested)
    if (!outputPath) return

    const id = makeId()
    jobIdRef.current = id
    setStatus('converting')
    setStage('palette')
    setPercent(0)
    setError(null)
    setResult(null)
    setPlaying(false)

    const res = await window.vidgif.convert(id, settings, outputPath)
    jobIdRef.current = null

    if (res.ok) {
      setResult({ outputPath: res.outputPath, size: res.size })
      setStatus('done')
    } else if (res.canceled) {
      setStatus('idle')
    } else {
      setError(res.error)
      setStatus('error')
    }
  }, [video, settings])

  const cancel = useCallback(() => {
    const id = jobIdRef.current
    if (id) void window.vidgif.cancel(id)
  }, [])

  // Keyboard shortcuts. Ignored while focus is in a control so that arrow keys
  // and space still operate selects normally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape' && status === 'converting') {
        e.preventDefault()
        cancel()
      } else if (e.key === 'Enter' && video && status !== 'converting') {
        e.preventDefault()
        void createGif()
      } else if (e.key === ' ' && video && !previewFailed) {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, video, previewFailed, cancel, createGif])

  function onDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    // Electron 32+ removed File.path; webUtils resolves it in the preload.
    const path = window.vidgif.getPathForFile(file)
    if (path) void loadVideo(path)
  }

  const dims = settings ? outputDimensions(settings) : { width: 0, height: 0 }
  const frames = settings ? frameCount(settings) : 0
  const estimate = settings ? estimateBytes(settings) : 0

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <header className="drag-region flex h-12 shrink-0 items-center justify-between border-b border-stone-200 px-5 dark:border-stone-800">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="text-sm font-semibold tracking-tight text-stone-800 dark:text-stone-100">
            VidGif
          </span>
          {video && (
            <span className="truncate text-xs text-stone-500 dark:text-stone-400">
              {video.name} · {video.width}×{video.height} · {formatTime(video.duration)}
            </span>
          )}
        </div>
        {video && (
          <Button variant="ghost" onClick={() => void chooseFile()}>
            Open…
          </Button>
        )}
      </header>

      {loadError && (
        <div className="shrink-0 border-b border-stone-200 bg-stone-100 px-5 py-2 text-xs text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
          {loadError}
        </div>
      )}

      {!video ? (
        <div className="min-h-0 flex-1">
          <DropZone dragging={dragging} onChoose={() => void chooseFile()} />
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <main className="flex min-w-0 flex-1 flex-col gap-4 p-5">
              <VideoPreview
                videoRef={videoRef}
                url={videoUrl}
                sourceWidth={video.width}
                sourceHeight={video.height}
                crop={crop}
                onCropChange={setCrop}
                lockedAspect={lockedRatio}
                playing={playing}
                onTogglePlay={() => setPlaying((p) => !p)}
                previewFailed={previewFailed}
                onPreviewError={() => {
                  setPreviewFailed(true)
                  setPlaying(false)
                }}
              />
              <Timeline
                duration={video.duration}
                start={start}
                end={end}
                current={current}
                onTrim={(s, e) => {
                  setStart(s)
                  setEnd(e)
                }}
                onSeek={seek}
              />
            </main>

            <SettingsPanel
              fps={fps}
              onFps={setFps}
              width={effectiveWidth}
              onWidth={setWidth}
              maxWidth={maxWidth}
              quality={quality}
              onQuality={setQuality}
              direction={direction}
              onDirection={setDirection}
              speed={speed}
              onSpeed={setSpeed}
              loop={loop}
              onLoop={setLoop}
              crop={crop}
              onCropToggle={toggleCrop}
              aspect={aspect}
              onAspect={applyAspect}
            />
          </div>

          <ExportBar
            status={status}
            stage={stage}
            percent={percent}
            width={dims.width}
            height={dims.height}
            frames={frames}
            estimate={estimate}
            result={result}
            error={error}
            onCreate={() => void createGif()}
            onCancel={cancel}
            onReveal={() => result && void window.vidgif.revealFile(result.outputPath)}
            onOpen={() => result && void window.vidgif.openFile(result.outputPath)}
          />
        </>
      )}
    </div>
  )
}
