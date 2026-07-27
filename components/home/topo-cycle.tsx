'use client'

import { useEffect, useState } from 'react'

export type TopoMountain = {
  slug: string
  svg: string
}

const CYCLE_MS = 10000
const FADE_MS = 2200

export function TopoCycle({ mountains }: { mountains: TopoMountain[] }) {
  const [index, setIndex] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % mountains.length)
      setTick((t) => t + 1)
    }, CYCLE_MS)
    return () => clearInterval(id)
  }, [mountains.length])

  return (
    <>
      {mountains.map((mountain, i) => (
        <div
          key={mountain.slug}
          aria-hidden
          className="absolute inset-0 overflow-hidden transition-opacity ease-in-out"
          style={{ opacity: i === index ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
          <div
            key={i === index ? `${mountain.slug}-${tick}` : mountain.slug}
            className="topo-zoom h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: mountain.svg }}
          />
        </div>
      ))}
    </>
  )
}
