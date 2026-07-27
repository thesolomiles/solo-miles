'use client'

import { ArrowUpRight, X } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'

const ICONS = { 'arrow-up-right': ArrowUpRight, x: X } as const
type IconName = keyof typeof ICONS

const SIZES = {
  sm: { pad: '7px 12px', font: 13, gap: 6, icon: 14 },
  md: { pad: '11px 18px', font: 14, gap: 8, icon: 16 },
  lg: { pad: '15px 26px', font: 16, gap: 10, icon: 18 },
} as const

const VARIANTS = {
  primary: { bg: 'var(--control-solid-bg)', fg: 'var(--control-solid-fg)', bd: 'var(--control-solid-bg)', hoverBg: 'var(--control-solid-hover)' },
  accent: { bg: 'var(--hivis-400)', fg: 'var(--ink-900)', bd: 'var(--hivis-400)', hoverBg: 'var(--hivis-500)' },
  secondary: { bg: 'transparent', fg: 'var(--text-strong)', bd: 'var(--line-strong)', hoverBg: 'var(--control-solid-bg)', hoverFg: 'var(--control-solid-fg)' },
  ghost: { bg: 'transparent', fg: 'var(--text-body)', bd: 'transparent', hoverBg: 'var(--control-ghost-hover)' },
} as const

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  disabled,
  onClick,
  style,
}: {
  children?: ReactNode
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  icon?: IconName
  iconRight?: IconName
  block?: boolean
  disabled?: boolean
  onClick?: () => void
  style?: CSSProperties
}) {
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const s = SIZES[size]
  const v = VARIANTS[variant]
  const IconEl = icon ? ICONS[icon] : null
  const IconRightEl = iconRight ? ICONS[iconRight] : null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setDown(false)
      }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.pad,
        fontFamily: 'var(--font-ui)',
        fontSize: s.font,
        fontWeight: 600,
        letterSpacing: '0.01em',
        lineHeight: 1.1,
        textDecoration: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        borderRadius: 'var(--radius-control)',
        border: '1px solid ' + v.bd,
        background: disabled ? 'var(--control-disabled-bg)' : (hover && 'hoverBg' in v ? v.hoverBg : v.bg),
        color: disabled ? 'var(--text-faint)' : (hover && 'hoverFg' in v ? v.hoverFg : v.fg),
        opacity: disabled ? 0.75 : 1,
        transform: down && !disabled ? 'translateY(1px)' : 'none',
        transition: 'var(--transition-control)',
        ...style,
      }}
    >
      {IconEl ? <IconEl size={s.icon} /> : null}
      {children}
      {IconRightEl ? <IconRightEl size={s.icon} /> : null}
    </button>
  )
}
