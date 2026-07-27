'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

const ICONS = { x: X } as const
type IconName = keyof typeof ICONS

const BOX = { sm: 28, md: 36, lg: 44 } as const

export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  active,
  onClick,
}: {
  icon: IconName
  label: string
  size?: keyof typeof BOX
  variant?: 'ghost' | 'outline' | 'solid'
  active?: boolean
  onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  const box = BOX[size]
  const solid = variant === 'solid'
  const outline = variant === 'outline'
  const IconEl = ICONS[icon]

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: box,
        height: box,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-control)',
        cursor: 'pointer',
        transition: 'var(--transition-control)',
        border: '1px solid ' + (outline ? 'var(--line-strong)' : 'transparent'),
        background: solid ? (hover ? 'var(--control-solid-hover)' : 'var(--control-solid-bg)') : active || hover ? 'var(--control-ghost-hover)' : 'transparent',
        color: solid ? 'var(--control-solid-fg)' : 'var(--text-strong)',
      }}
    >
      <IconEl size={size === 'sm' ? 14 : size === 'lg' ? 20 : 17} />
    </button>
  )
}
