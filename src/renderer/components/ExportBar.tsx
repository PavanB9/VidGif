import type { ConvertStage } from '@shared/types'
import { formatBytes } from '../lib/format'
import { Button } from './ui'

interface Props {
  status: 'idle' | 'converting' | 'done' | 'error'
  stage: ConvertStage
  percent: number
  width: number
  height: number
  frames: number
  estimate: number
  result: { outputPath: string; size: number } | null
  error: string | null
  onCreate: () => void
  onCancel: () => void
  onReveal: () => void
  onOpen: () => void
}

export default function ExportBar(props: Props): React.JSX.Element {
  const { status } = props

  return (
    <div className="shrink-0 border-t border-stone-200 bg-white/70 px-5 py-3.5 dark:border-stone-800 dark:bg-stone-900/50">
      {status === 'converting' ? (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-400">
              <span>{props.stage === 'palette' ? 'Analysing colours…' : 'Rendering GIF…'}</span>
              {props.stage === 'encode' && (
                <span className="tabular-nums">{Math.round(props.percent * 100)}%</span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
              {props.stage === 'palette' ? (
                // Pass 1 has no honest percentage to report (palettegen emits a
                // single frame at end-of-stream), so this stage is indeterminate.
                <div className="indeterminate-bar h-full w-1/4 rounded-full bg-stone-500 dark:bg-stone-400" />
              ) : (
                <div
                  className="h-full rounded-full bg-stone-800 transition-[width] duration-150 dark:bg-stone-200"
                  style={{ width: `${Math.max(2, props.percent * 100)}%` }}
                />
              )}
            </div>
          </div>
          <Button onClick={props.onCancel}>Cancel</Button>
        </div>
      ) : status === 'done' && props.result ? (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 text-sm">
            <span className="font-medium text-stone-800 dark:text-stone-100">GIF saved</span>
            <span className="text-stone-500 dark:text-stone-400">
              {' · '}
              {props.width}×{props.height} · {props.frames} frames ·{' '}
              {formatBytes(props.result.size)}
            </span>
          </div>
          <Button onClick={props.onReveal}>Show in folder</Button>
          <Button onClick={props.onOpen}>Open</Button>
          <Button variant="primary" onClick={props.onCreate}>
            Create another
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1 text-xs text-stone-500 dark:text-stone-400">
            {status === 'error' && props.error ? (
              <span className="text-stone-700 dark:text-stone-200">{props.error}</span>
            ) : (
              <span className="tabular-nums">
                {props.width}×{props.height} · {props.frames} frames · ~
                {formatBytes(props.estimate)}
              </span>
            )}
          </div>
          <Button variant="primary" onClick={props.onCreate}>
            Create GIF
          </Button>
        </div>
      )}
    </div>
  )
}
