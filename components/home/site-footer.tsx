'use client'

import { formatCoords, MOUNTAINS } from '@/lib/mountains'
import { useTopoActiveIndex } from './topo-active-context'

export function SiteFooter({ showCoords = true }: { showCoords?: boolean } = {}) {
  const activeIndex = useTopoActiveIndex()
  const mountain = MOUNTAINS[activeIndex]

  return (
    <footer className="relative flex justify-center px-5 pb-13 sm:px-8">
      <div className="flex w-full max-w-page items-center text-[11px] tracking-[0.2em] text-ink-300 uppercase">
        {showCoords && (
          <span>
            {formatCoords(mountain)} — {mountain.place}
          </span>
        )}
      </div>
    </footer>
  )
}
