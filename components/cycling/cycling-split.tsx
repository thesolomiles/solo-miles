'use client'

import { useState } from 'react'
import { RIDES } from '@/lib/rides'
import { cn } from '@/lib/utils'
import { CyclingMap } from './cycling-map'
import { RideCard } from './ride-card'

export function CyclingSplit() {
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  return (
    <div className="w-full">
      <div className="mb-5 flex gap-2 lg:hidden">
        {(['list', 'map'] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => setMobileView(view)}
            className={cn(
              'flex-1 rounded-[10px] border border-white/[0.14] py-2.5 text-[11px] tracking-[0.2em] uppercase transition-colors',
              mobileView === view ? 'bg-hivis-400 text-void' : 'text-paper-000 hover:bg-white/[0.06]',
            )}
          >
            {view === 'list' ? 'List' : 'Map'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className={cn('flex flex-col gap-3.5', mobileView === 'map' && 'hidden lg:flex')}>
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

        <div
          className={cn(
            'h-[65vh] min-h-[420px] lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]',
            mobileView === 'list' && 'hidden lg:block',
          )}
        >
          <CyclingMap
            activeSlug={activeSlug}
            onActivate={(slug) => setActiveSlug(slug)}
            onDeactivate={() => setActiveSlug(null)}
          />
        </div>
      </div>
    </div>
  )
}
