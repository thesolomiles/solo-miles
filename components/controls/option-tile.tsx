'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { interactiveSurface } from './tokens'

export function OptionTile({
  glyph,
  title,
  subtitle,
  disabled,
  onClick,
  className,
}: {
  glyph: ReactNode
  title: string
  subtitle: string
  disabled?: boolean
  onClick?: () => void
  className?: string
}) {
  const content = (
    <>
      <span className="flex w-full items-baseline justify-between gap-3">
        <span className="font-display text-2xl leading-none font-extrabold tracking-[-0.02em]">{glyph}</span>
        {!disabled && <span className="text-[13px]">→</span>}
      </span>
      <span className="text-[11px] tracking-[0.16em] uppercase">{title}</span>
      <span className="text-[10px] tracking-[0.14em] tabular-nums uppercase opacity-60">{subtitle}</span>
    </>
  )

  const sizing = 'flex flex-col items-start gap-2.5 rounded p-4 text-left'

  if (disabled) {
    return (
      <div aria-disabled className={cn(interactiveSurface({ state: 'disabled' }), sizing, className)}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(interactiveSurface({ state: 'default' }), sizing, 'cursor-pointer hover:bg-white/[0.06]', className)}
    >
      {content}
    </button>
  )
}
