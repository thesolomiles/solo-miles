'use client'

import { cn } from '@/lib/utils'
import { interactiveSurface } from './tokens'

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  note?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              interactiveSurface({ state: active ? 'active' : 'default' }),
              'inline-flex items-center gap-2 rounded-[2px] px-4 py-2.5 text-[11px] tracking-[0.18em]',
            )}
          >
            <span className="font-semibold">{option.label}</span>
            {option.note ? <span className="opacity-60">{option.note}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
