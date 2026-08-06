'use client'

import { useEffect, useRef, useState } from 'react'
import { useTopoActiveIndex } from './topo-active-context'

export type TopoMountain = {
  slug: string
  svg: string
}

// Kept in sync with the .topo-line / .topo-zoom animation-delay and
// animation-duration values in app/globals.css — see the comment there for
// the full 0s-10s sequence: old fades out completely, THEN the new one draws
// in, THEN it zooms continuously until the next swap. The fade-out and the
// draw-in never overlap in time, so two different mountains are never
// visible at once.
const FADE_OUT_MS = 1200

export function TopoCycle({ mountains }: { mountains: TopoMountain[] }) {
  const activeIndex = useTopoActiveIndex()
  const [fadingOutIndex, setFadingOutIndex] = useState<number | null>(null)
  // Per-mountain "draw tick": null until a mountain has had its first turn.
  // Only bumped when a mountain BECOMES active, never when it stops being
  // active — so its fully-drawn content is preserved while it fades out,
  // instead of resetting to blank mid-fade.
  const [drawTick, setDrawTick] = useState<(number | null)[]>(() => mountains.map((_, i) => (i === 0 ? 0 : null)))

  const prevActiveRef = useRef(0)
  const tickRef = useRef(0)

  useEffect(() => {
    const prev = prevActiveRef.current
    if (activeIndex === prev) return
    prevActiveRef.current = activeIndex
    tickRef.current += 1
    const nextTick = tickRef.current

    setFadingOutIndex(prev)
    setDrawTick((ticks) => {
      const copy = ticks.slice()
      copy[activeIndex] = nextTick
      return copy
    })
  }, [activeIndex])

  return (
    <>
      {mountains.map((mountain, i) => {
        const isActive = i === activeIndex
        const isFadingOut = i === fadingOutIndex
        const tick = drawTick[i]
        return (
          <div
            key={mountain.slug}
            aria-hidden
            className="absolute inset-0 overflow-hidden"
            style={{
              opacity: isActive ? 1 : 0,
              transition: isFadingOut ? `opacity ${FADE_OUT_MS}ms ease-in-out` : 'none',
            }}
          >
            {tick !== null && (
              <div
                key={`${mountain.slug}-${tick}`}
                className="topo-zoom h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: mountain.svg }}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
