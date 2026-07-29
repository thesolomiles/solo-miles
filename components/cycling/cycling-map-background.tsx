'use client'

import { useCyclingActiveRide } from './cycling-active-ride-context'
import { CyclingMap } from './cycling-map'

export function CyclingMapBackground() {
  const { activeSlug, setActiveSlug } = useCyclingActiveRide()

  return (
    <div className="fixed inset-0">
      <CyclingMap activeSlug={activeSlug} onActivate={setActiveSlug} onDeactivate={() => setActiveSlug(null)} />
    </div>
  )
}
