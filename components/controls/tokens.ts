import { cva } from 'class-variance-authority'

// Shared surface treatment for small interactive picker controls
// (segmented options, option tiles, etc.) that sit on top of the site's
// animated topo background: translucent panel, hairline border, backdrop
// blur so the topo shows through frosted, and the lime accent border on
// hover/active. Centralised here so every picker across the site stays
// visually consistent and in sync with a single set of tokens.
export const interactiveSurface = cva('border font-mono uppercase backdrop-blur-sm transition-colors', {
  variants: {
    state: {
      default: 'border-white/20 bg-white/[0.02] text-paper-000 hover:border-hivis-400',
      active: 'border-hivis-400 bg-hivis-400 text-void',
      disabled: 'cursor-not-allowed border-dashed border-white/15 bg-white/[0.02] text-white/25',
    },
  },
  defaultVariants: {
    state: 'default',
  },
})
