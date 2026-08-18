import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium tracking-wide text-stone-500 dark:text-stone-400">
        {label}
      </div>
      {children}
    </div>
  )
}

export interface Option<T> {
  value: T
  label: string
}

/** Segmented control — used where the options are few and worth showing at once. */
export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <div className="flex gap-1 rounded-lg border border-stone-200 bg-stone-100 p-1 dark:border-stone-800 dark:bg-stone-900">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ' +
              (active
                ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-50'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100')
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Select<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T
  options: Option<T>[]
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const picked = options.find((o) => String(o.value) === e.target.value)
        if (picked) onChange(picked.value)
      }}
      className="w-full appearance-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 transition-colors hover:border-stone-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-stone-700"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  className = ''
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  className?: string
}): React.JSX.Element {
  const base =
    'no-drag inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:cursor-not-allowed disabled:opacity-40'
  const variants = {
    primary:
      'bg-stone-900 text-stone-50 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white',
    secondary:
      'border border-stone-200 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800',
    ghost: 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
