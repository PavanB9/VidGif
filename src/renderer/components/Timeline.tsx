import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { clamp } from '@shared/geometry'
import { formatTime } from '../lib/format'

type Grab = 'start' | 'end' | 'seek'

interface Props {
  duration: number
  start: number
  end: number
  current: number
  onTrim: (start: number, end: number) => void
  onSeek: (t: number) => void
}

/** Minimum selectable clip, in seconds. */
const MIN_SPAN = 0.1

/**
 * Trim scrubber. Dragging either handle seeks the video to that handle so the
 * user sees the exact in/out frame while dragging, rather than trimming blind.
 */
export default function Timeline({
  duration,
  start,
  end,
  current,
  onTrim,
  onSeek
}: Props): React.JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)
  const grab = useRef<Grab | null>(null)

  const pct = (t: number): number => (duration > 0 ? (t / duration) * 100 : 0)

  function timeAt(clientX: number): number {
    const track = trackRef.current
    if (!track) return 0
    const bounds = track.getBoundingClientRect()
    if (bounds.width === 0) return 0
    return clamp(((clientX - bounds.left) / bounds.width) * duration, 0, duration)
  }

  function apply(kind: Grab, clientX: number): void {
    const t = timeAt(clientX)
    if (kind === 'start') {
      const next = clamp(t, 0, end - MIN_SPAN)
      onTrim(next, end)
      onSeek(next)
    } else if (kind === 'end') {
      const next = clamp(t, start + MIN_SPAN, duration)
      onTrim(start, next)
      onSeek(next)
    } else {
      onSeek(clamp(t, start, end))
    }
  }

  function begin(kind: Grab) {
    return (e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      grab.current = kind
      apply(kind, e.clientX)
    }
  }

  function onMove(e: ReactPointerEvent<HTMLElement>): void {
    if (!grab.current) return
    apply(grab.current, e.clientX)
  }

  function release(e: ReactPointerEvent<HTMLElement>): void {
    grab.current = null
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId)
  }

  const selected = Math.max(0, end - start)

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className="relative h-12 w-full cursor-pointer touch-none select-none rounded-lg border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900"
        onPointerDown={begin('seek')}
        onPointerMove={onMove}
        onPointerUp={release}
        onPointerCancel={release}
      >
        {/* Excluded regions */}
        <div
          className="absolute inset-y-0 left-0 rounded-l-lg bg-stone-200/70 dark:bg-stone-950/60"
          style={{ width: `${pct(start)}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-lg bg-stone-200/70 dark:bg-stone-950/60"
          style={{ width: `${100 - pct(end)}%` }}
        />

        {/* Kept region */}
        <div
          className="absolute inset-y-0 border-y-2 border-stone-400 bg-stone-300/40 dark:border-stone-600 dark:bg-stone-700/40"
          style={{ left: `${pct(start)}%`, width: `${pct(selected)}%` }}
        />

        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-1 w-0.5 rounded bg-stone-900 dark:bg-stone-100"
          style={{ left: `${pct(current)}%` }}
        />

        {/* Trim handles */}
        <div
          onPointerDown={begin('start')}
          onPointerMove={onMove}
          onPointerUp={release}
          onPointerCancel={release}
          className="absolute inset-y-0 -ml-2 flex w-4 cursor-ew-resize items-center justify-center"
          style={{ left: `${pct(start)}%` }}
        >
          <div className="h-8 w-1.5 rounded-full bg-stone-700 shadow-sm dark:bg-stone-300" />
        </div>
        <div
          onPointerDown={begin('end')}
          onPointerMove={onMove}
          onPointerUp={release}
          onPointerCancel={release}
          className="absolute inset-y-0 -ml-2 flex w-4 cursor-ew-resize items-center justify-center"
          style={{ left: `${pct(end)}%` }}
        >
          <div className="h-8 w-1.5 rounded-full bg-stone-700 shadow-sm dark:bg-stone-300" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs tabular-nums text-stone-500 dark:text-stone-400">
        <span>{formatTime(start)}</span>
        <span className="text-stone-700 dark:text-stone-300">{formatTime(selected)} selected</span>
        <span>{formatTime(end)}</span>
      </div>
    </div>
  )
}
