import type { CropRect, Direction, LoopMode, QualityPreset } from '@shared/types'
import { Button, Field, Segmented, Select, type Option } from './ui'

export const ASPECT_PRESETS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', ratio: 9 / 16 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 }
] as const

export type AspectId = (typeof ASPECT_PRESETS)[number]['id']

const FPS_OPTIONS: Option<number>[] = [10, 12, 15, 20, 24, 30].map((v) => ({
  value: v,
  label: `${v} fps`
}))

const SPEED_OPTIONS: Option<number>[] = [0.25, 0.5, 1, 1.5, 2, 3].map((v) => ({
  value: v,
  label: v === 1 ? 'Normal' : `${v}×`
}))

const WIDTH_CHOICES = [240, 320, 480, 640, 720, 960]

interface Props {
  fps: number
  onFps: (v: number) => void
  width: number
  onWidth: (v: number) => void
  /** Largest useful width — the source (or cropped) width. */
  maxWidth: number
  quality: QualityPreset
  onQuality: (v: QualityPreset) => void
  direction: Direction
  onDirection: (v: Direction) => void
  speed: number
  onSpeed: (v: number) => void
  loop: LoopMode
  onLoop: (v: LoopMode) => void
  crop: CropRect | null
  onCropToggle: () => void
  aspect: AspectId
  onAspect: (v: AspectId) => void
}

export default function SettingsPanel(props: Props): React.JSX.Element {
  // Offering widths larger than the source would silently clamp and confuse, so
  // the list stops at the (possibly cropped) source width — and always offers
  // that exact width as the top entry, otherwise cropping can leave the menu
  // with a single stale-looking choice.
  const max = Math.max(16, props.maxWidth)
  const widthOptions: Option<number>[] = [
    ...WIDTH_CHOICES.filter((w) => w < max).map((w) => ({ value: w, label: `${w} px` })),
    { value: max, label: `${max} px (max)` }
  ]

  return (
    <aside className="thin-scroll w-[320px] shrink-0 space-y-6 overflow-y-auto border-l border-stone-200 bg-white/60 p-5 dark:border-stone-800 dark:bg-stone-900/40">
      <Field label="WIDTH">
        <Select value={props.width} options={widthOptions} onChange={props.onWidth} />
      </Field>

      <Field label="FRAME RATE">
        <Select value={props.fps} options={FPS_OPTIONS} onChange={props.onFps} />
      </Field>

      <Field label="QUALITY">
        <Segmented<QualityPreset>
          value={props.quality}
          onChange={props.onQuality}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'balanced', label: 'Balanced' },
            { value: 'high', label: 'High' }
          ]}
        />
      </Field>

      <div className="h-px bg-stone-200 dark:bg-stone-800" />

      <Field label="DIRECTION">
        <Segmented<Direction>
          value={props.direction}
          onChange={props.onDirection}
          options={[
            { value: 'forward', label: 'Forward' },
            { value: 'reverse', label: 'Reverse' },
            { value: 'boomerang', label: 'Boomerang' }
          ]}
        />
      </Field>

      <Field label="SPEED">
        <Select value={props.speed} options={SPEED_OPTIONS} onChange={props.onSpeed} />
      </Field>

      <Field label="LOOP">
        <Segmented<LoopMode>
          value={props.loop}
          onChange={props.onLoop}
          options={[
            { value: 'infinite', label: 'Forever' },
            { value: 'once', label: 'Once' }
          ]}
        />
      </Field>

      <div className="h-px bg-stone-200 dark:bg-stone-800" />

      <Field label="CROP">
        <Button onClick={props.onCropToggle} className="w-full">
          {props.crop ? 'Remove crop' : 'Add crop'}
        </Button>
        {props.crop && (
          <div className="pt-2">
            <Segmented<AspectId>
              value={props.aspect}
              onChange={props.onAspect}
              options={ASPECT_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            />
          </div>
        )}
      </Field>
    </aside>
  )
}
