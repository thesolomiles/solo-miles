const TONES = {
  neutral: { bg: 'transparent', fg: 'var(--text-body)', bd: 'var(--line-hairline)' },
  solid: { bg: 'var(--control-solid-bg)', fg: 'var(--control-solid-fg)', bd: 'var(--control-solid-bg)' },
  accent: { bg: 'var(--hivis-400)', fg: 'var(--ink-900)', bd: 'var(--hivis-400)' },
  clay: { bg: 'rgba(224,85,43,.16)', fg: 'var(--clay-300)', bd: 'rgba(224,85,43,.45)' },
} as const

export function Tag({
  children,
  tone = 'neutral',
  size = 'md',
}: {
  children?: React.ReactNode
  tone?: keyof typeof TONES
  size?: 'sm' | 'md'
}) {
  const t = TONES[tone]
  const sm = size === 'sm'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: sm ? '3px 8px' : '5px 10px',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid ' + t.bd,
        background: t.bg,
        color: t.fg,
        fontFamily: 'var(--font-mono)',
        fontSize: sm ? 'var(--mono-xs)' : 'var(--mono-sm)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
