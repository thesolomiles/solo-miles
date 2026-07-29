'use client'

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'

type CyclingActiveRideContextValue = {
  activeSlug: string | null
  setActiveSlug: Dispatch<SetStateAction<string | null>>
}

const CyclingActiveRideContext = createContext<CyclingActiveRideContextValue | null>(null)

export function CyclingActiveRideProvider({ children }: { children: ReactNode }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  return (
    <CyclingActiveRideContext.Provider value={{ activeSlug, setActiveSlug }}>
      {children}
    </CyclingActiveRideContext.Provider>
  )
}

export function useCyclingActiveRide() {
  const ctx = useContext(CyclingActiveRideContext)
  if (!ctx) throw new Error('useCyclingActiveRide must be used within CyclingActiveRideProvider')
  return ctx
}
