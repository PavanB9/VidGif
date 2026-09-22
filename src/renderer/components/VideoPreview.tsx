import type { RefObject } from 'react'
import type { CropRect } from '@shared/types'
import CropOverlay from './CropOverlay'

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>
  url: string
  sourceWidth: number
  sourceHeight: number
  crop: CropRect | null
  onCropChange: (r: CropRect) => void
  lockedAspect: number | null
  playing: boolean
  onTogglePlay: () => void
  previewFailed: boolean
  onPreviewError: () => void
}

export default function VideoPreview({
  videoRef,
  url,
  sourceWidth,
  sourceHeight,
  crop,
  onCropChange,
  lockedAspect,
  playing,
  onTogglePlay,
  previewFailed,
  onPreviewError
}: Props): React.JSX.Element {
  const aspect = sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9

  return (
    <div className="relative min-h-0 flex-1">
      {/*
        The box must end up EXACTLY the size of the rendered video, because the
        crop overlay is positioned against it. `width: 100%` + `max-height`
        could not do that: for a portrait clip the width stayed at 100% while
        max-height clamped the height, so the box was far wider than the
        letterboxed video and crop coordinates mapped to the wrong region.
        `position: absolute; inset: 0; margin: auto` with only max-width /
        max-height constraints shrinks the aspect box to fit and centres it.
      */}
      <div
        className="absolute inset-0 m-auto overflow-hidden rounded-xl bg-stone-900 shadow-sm ring-1 ring-stone-200 dark:ring-stone-800"
        style={{ aspectRatio: String(aspect), maxWidth: '100%', maxHeight: '100%' }}
      >
        {previewFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
            <div className="text-sm font-medium text-stone-200">Preview unavailable</div>
            <div className="max-w-sm text-xs leading-relaxed text-stone-400">
              This system can&apos;t play this file&apos;s codec, but ffmpeg reads it fine —
              trimming, cropping and converting all still work.
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={url}
            className="h-full w-full"
            onError={onPreviewError}
            onClick={onTogglePlay}
            playsInline
            muted
          />
        )}

        {crop && !previewFailed && (
          <CropOverlay
            rect={crop}
            onChange={onCropChange}
            lockedAspect={lockedAspect}
            sourceAspect={aspect}
          />
        )}

        {!previewFailed && (
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-full bg-stone-950/60 text-stone-50 backdrop-blur transition-colors hover:bg-stone-950/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
                <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
