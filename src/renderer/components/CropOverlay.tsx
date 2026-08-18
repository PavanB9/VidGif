import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { CropRect } from '@shared/types'
import { clamp } from '@shared/geometry'

type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN = 0.05

interface Props {
  rect: CropRect
  onChange: (r: CropRect) => void
  /** Output pixel aspect (w/h) to lock to, or null for free-form. */
  lockedAspect: number | null
  /** Source video aspect (w/h) — converts a pixel aspect into normalised space. */
  sourceAspect: number
}

/**
 * Crop box drawn over the preview. Coordinates are normalised (0–1) against the
 * source frame, so resizing the window can never invalidate a crop.
 *
 * Aspect locking happens in normalised space: a 1:1 output crop is NOT a square
 * in normalised units unless the source is also square, hence dividing the
 * requested pixel aspect by the source aspect.
 */
export default function CropOverlay({
  rect,
  onChange,
  lockedAspect,
  sourceAspect
}: Props): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Handle; startRect: CropRect; x: number; y: number } | null>(null)

  const normAspect = lockedAspect === null ? null : lockedAspect / sourceAspect

  function begin(handle: Handle) {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      drag.current = { handle, startRect: rect, x: e.clientX, y: e.clientY }
    }
  }

  function onMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const state = drag.current
    const box = ref.current
    if (!state || !box) return

    const bounds = box.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return

    const dx = (e.clientX - state.x) / bounds.width
    const dy = (e.clientY - state.y) / bounds.height
    const s = state.startRect

    if (state.handle === 'move') {
      onChange({
        ...s,
        x: clamp(s.x + dx, 0, 1 - s.width),
        y: clamp(s.y + dy, 0, 1 - s.height)
      })
      return
    }

    const h = state.handle
    let { x, y, width, height } = s
    const right = s.x + s.width
    const bottom = s.y + s.height

    if (h.includes('w')) {
      x = clamp(s.x + dx, 0, right - MIN)
      width = right - x
    }
    if (h.includes('e')) {
      width = clamp(s.width + dx, MIN, 1 - s.x)
    }
    if (h.includes('n')) {
      y = clamp(s.y + dy, 0, bottom - MIN)
      height = bottom - y
    }
    if (h.includes('s')) {
      height = clamp(s.height + dy, MIN, 1 - s.y)
    }

    if (normAspect !== null) {
      // Derive the dependent edge, then fall back if that overflows the frame.
      const horizontal = h === 'e' || h === 'w'
      if (horizontal) {
        height = width / normAspect
        if (y + height > 1) {
          height = 1 - y
          width = height * normAspect
        }
      } else {
        width = height * normAspect
        if (x + width > 1) {
          width = 1 - x
          height = width / normAspect
        }
      }
      // Re-anchor the edges the user is NOT dragging.
      if (h.includes('n')) y = bottom - height
      if (h.includes('w')) x = right - width
      x = clamp(x, 0, 1 - width)
      y = clamp(y, 0, 1 - height)
    }

    onChange({ x, y, width, height })
  }

  function end(e: ReactPointerEvent<HTMLDivElement>): void {
    drag.current = null
    const target = e.target as HTMLElement
    if (target.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId)
  }

  const handles: { id: Handle; className: string; cursor: string }[] = [
    { id: 'nw', className: '-left-1 -top-1', cursor: 'nwse-resize' },
    { id: 'n', className: 'left-1/2 -top-1 -translate-x-1/2', cursor: 'ns-resize' },
    { id: 'ne', className: '-right-1 -top-1', cursor: 'nesw-resize' },
    { id: 'e', className: '-right-1 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
    { id: 'se', className: '-right-1 -bottom-1', cursor: 'nwse-resize' },
    { id: 's', className: 'left-1/2 -bottom-1 -translate-x-1/2', cursor: 'ns-resize' },
    { id: 'sw', className: '-left-1 -bottom-1', cursor: 'nesw-resize' },
    { id: 'w', className: '-left-1 top-1/2 -translate-y-1/2', cursor: 'ew-resize' }
  ]

  return (
    <div
      ref={ref}
      className="absolute inset-0 touch-none"
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute cursor-move"
        style={{
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
          // Dims everything outside the crop without needing four extra nodes.
          boxShadow: '0 0 0 9999px rgba(12, 10, 9, 0.55)',
          outline: '1.5px solid rgba(250, 250, 249, 0.95)'
        }}
        onPointerDown={begin('move')}
      >
        {/* Rule-of-thirds guides */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-0 h-full w-px bg-stone-50/25" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-stone-50/25" />
          <div className="absolute top-1/3 left-0 w-full h-px bg-stone-50/25" />
          <div className="absolute top-2/3 left-0 w-full h-px bg-stone-50/25" />
        </div>

        {handles.map((handle) => (
          <div
            key={handle.id}
            onPointerDown={begin(handle.id)}
            style={{ cursor: handle.cursor }}
            className={`absolute h-3 w-3 rounded-full border border-stone-400 bg-stone-50 shadow-sm ${handle.className}`}
          />
        ))}
      </div>
    </div>
  )
}
