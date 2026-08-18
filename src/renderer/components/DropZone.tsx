import { Button } from './ui'

export default function DropZone({
  dragging,
  onChoose
}: {
  dragging: boolean
  onChoose: () => void
}): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className={
          'flex w-full max-w-lg flex-col items-center gap-5 rounded-2xl border-2 border-dashed p-14 text-center transition-colors ' +
          (dragging
            ? 'border-stone-400 bg-stone-100 dark:border-stone-600 dark:bg-stone-900'
            : 'border-stone-300 dark:border-stone-800')
        }
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth="1.5"
          className="h-12 w-12 stroke-stone-400 dark:stroke-stone-600"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V6m0 0L8.25 9.75M12 6l3.75 3.75"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 15.75v1.5A3 3 0 006.75 20.25h10.5a3 3 0 003-3v-1.5"
          />
        </svg>

        <div className="space-y-1.5">
          <div className="text-lg font-medium text-stone-800 dark:text-stone-100">
            Drop a video here
          </div>
          <div className="text-sm text-stone-500 dark:text-stone-400">
            MP4, MOV, WebM, MKV or AVI
          </div>
        </div>

        <Button onClick={onChoose}>Choose file…</Button>
      </div>
    </div>
  )
}
