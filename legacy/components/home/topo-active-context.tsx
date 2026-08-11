'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'

// Kept in sync with CYCLE_MS's role in components/home/topo-cycle.tsx / the
// .topo-line / .topo-zoom timings in app/globals.css.
const CYCLE_MS = 10000

const TopoActiveIndexContext = createContext(0)

export function TopoActiveMountainProvider({ count, children }: { count: number; children: React.ReactNode }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => {
      const next = (activeIndexRef.current + 1) % count
      activeIndexRef.current = next
      setActiveIndex(next)
    }, CYCLE_MS)
    return () => clearInterval(id)
  }, [count])

  return <TopoActiveIndexContext.Provider value={activeIndex}>{children}</TopoActiveIndexContext.Provider>
}

export function useTopoActiveIndex() {
  return useContext(TopoActiveIndexContext)
}
