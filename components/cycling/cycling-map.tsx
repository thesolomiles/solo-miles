'use client'

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import worldTopo from 'world-atlas/countries-50m.json'
import { RIDES } from '@/lib/rides'
import { cn } from '@/lib/utils'

// Centered + scaled to frame Japan, the Korean peninsula, Taiwan and the
// East China coast, with room around the current dot cluster for more rides
// in the same region later.
const PROJECTION_CONFIG = { center: [128, 33] as [number, number], scale: 1500 }

const GEOGRAPHY_STYLE = {
  default: { fill: 'none', stroke: 'rgba(253,252,247,.22)', strokeWidth: 0.6, outline: 'none' },
  hover: { fill: 'none', stroke: 'rgba(253,252,247,.22)', strokeWidth: 0.6, outline: 'none' },
  pressed: { fill: 'none', stroke: 'rgba(253,252,247,.22)', strokeWidth: 0.6, outline: 'none' },
}

export function CyclingMap({
  activeSlug,
  onActivate,
  onDeactivate,
}: {
  activeSlug: string | null
  onActivate: (slug: string) => void
  onDeactivate: () => void
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-card border border-white/[0.1] bg-[radial-gradient(120%_100%_at_50%_15%,rgba(24,26,24,1)_0%,rgba(2,3,3,1)_75%)] shadow-[inset_0_1px_0_rgba(255,255,255,.07)]">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={PROJECTION_CONFIG}
        width={800}
        height={800}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="ride-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D8F250" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#D8F250" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#D8F250" stopOpacity="0" />
          </radialGradient>
        </defs>

        <Geographies geography={worldTopo}>
          {({ geographies }) =>
            geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} style={GEOGRAPHY_STYLE} />)
          }
        </Geographies>

        {RIDES.map((ride) => {
          const active = activeSlug === ride.slug
          return (
            <Marker
              key={ride.slug}
              coordinates={[ride.lon, ride.lat]}
              onMouseEnter={() => onActivate(ride.slug)}
              onMouseLeave={onDeactivate}
              className="cursor-pointer outline-none"
            >
              <circle
                r={active ? 20 : 13}
                fill="url(#ride-glow)"
                className={cn('transition-[r] duration-300 ease-out', !active && 'cycling-marker-pulse')}
              />
              <circle r={active ? 5 : 3.5} fill="#D8F250" stroke="#020303" strokeWidth={1.25} className="transition-all duration-300" />
              {active && <circle r={9} fill="none" stroke="#D8F250" strokeWidth={1.5} opacity={0.85} />}
              {active && (
                <text
                  textAnchor="middle"
                  y={-16}
                  className="pointer-events-none select-none font-mono text-[10px] tracking-[0.08em] uppercase"
                  fill="#FDFCF7"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,.8)' }}
                >
                  {ride.place}
                </text>
              )}
            </Marker>
          )
        })}
      </ComposableMap>
    </div>
  )
}
