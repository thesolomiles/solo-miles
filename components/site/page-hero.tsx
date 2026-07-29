import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Standard page-hero typography (kicker + heading + description), established
// on the My Career page. Use this by default for any new page's hero unless
// told otherwise.
export function PageHero({
  eyebrow,
  heading,
  description,
  headingClassName,
  descriptionClassName,
  className,
  children,
}: {
  eyebrow: string
  heading: ReactNode
  description: ReactNode
  headingClassName?: string
  descriptionClassName?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 pt-8 pb-10 text-center sm:pt-16', className)}>
      <span className="text-[11px] tracking-[0.22em] text-hivis-400 uppercase">{eyebrow}</span>
      <h1
        className={cn(
          'm-0 max-w-[16ch] font-display text-[42px] leading-[0.92] font-extrabold tracking-[-0.03em] text-paper-000 uppercase sm:text-[54px] md:text-[64px]',
          headingClassName,
        )}
      >
        {heading}
      </h1>
      <p
        className={cn(
          'm-0 mt-1 max-w-[60ch] font-display text-[15px] leading-[1.6] text-ink-200 text-pretty sm:text-base',
          descriptionClassName,
        )}
      >
        {description}
      </p>
      {children}
    </div>
  )
}
