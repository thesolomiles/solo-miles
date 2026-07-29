'use client'

import { RIDES } from '@/lib/rides'
import { useCyclingActiveRide } from './cycling-active-ride-context'
import { RideCard } from './ride-card'

export function CyclingSplit() {
  const { activeSlug, setActiveSlug } = useCyclingActiveRide()

  return (
    <div className="pointer-events-auto sticky top-0 flex h-full w-full flex-col gap-3.5 overflow-y-auto sm:w-[420px] sm:gap-4">
      {RIDES.map((ride) => (
        <RideCard
          key={ride.slug}
          ride={ride}
          active={activeSlug === ride.slug}
          onActivate={() => setActiveSlug(ride.slug)}
          onDeactivate={() => setActiveSlug((current) => (current === ride.slug ? null : current))}
        />
      ))}
    </div>
  )
}
