'use client'

import { geoMercator } from 'd3-geo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import type { ProjectionFunction } from 'react-simple-maps'
import worldTopo from 'world-atlas/countries-50m.json'
import { RIDES, type Ride } from '@/lib/rides'
import { cn } from '@/lib/utils'

// Keep these in sync with the card panel's own width/offset in
// cycling-split.tsx — the "fit all rides" view is centered in the leftover
// space to the right of the panel, not the full (partly obscured) viewport.
const SM_BREAKPOINT = 640
const PANEL_OFFSET = 32 // matches main's sm:px-8
const PANEL_WIDTH = 420
const MAP_MARGIN = 64

// How long the cluster-click zoom transition runs — kept in sync with the
// `.cycling-cluster-zoom` transition-duration in globals.css so the
// animating class gets cleared right as the CSS transition finishes.
const CLUSTER_ZOOM_DURATION_MS = 650

// Markers within this many screen pixels of each other collapse into one
// cluster dot — recomputed against the live zoom level, so they split back
// apart automatically once zooming in spreads them out again.
const CLUSTER_THRESHOLD_PX = 56

// vectorEffect: 'non-scaling-stroke' keeps this stroke a constant width in
// screen pixels regardless of the ZoomableGroup's zoom transform — without
// it, the outline scales down (and vanishes) along with everything else
// when zoomed out.
const GEOGRAPHY_STYLE = {
  default: { fill: 'none', stroke: 'rgba(253,252,247,.22)', strokeWidth: 0.6, outline: 'none', vectorEffect: 'non-scaling-stroke' as const },
  hover: { fill: 'none', stroke: 'rgba(253,252,247,.22)', strokeWidth: 0.6, outline: 'none', vectorEffect: 'non-scaling-stroke' as const },
  pressed: { fill: 'none', stroke: 'rgba(253,252,247,.22)', strokeWidth: 0.6, outline: 'none', vectorEffect: 'non-scaling-stroke' as const },
}

const RIDE_POINTS = {
  type: 'FeatureCollection' as const,
  features: RIDES.map((ride) => ({
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Point' as const, coordinates: [ride.lon, ride.lat] as [number, number] },
  })),
}

// The visible (non-panel) region the map is fit into, in pixels.
function getVisibleExtent(width: number, height: number): [[number, number], [number, number]] {
  const leftInset = width >= SM_BREAKPOINT ? PANEL_OFFSET + PANEL_WIDTH + MAP_MARGIN : MAP_MARGIN
  const right = Math.max(leftInset + 1, width - MAP_MARGIN)
  const bottom = Math.max(MAP_MARGIN + 1, height - MAP_MARGIN)
  return [
    [leftInset, MAP_MARGIN],
    [right, bottom],
  ]
}

function useViewportSize() {
  const [size, setSize] = useState({ width: 1280, height: 800 })

  useEffect(() => {
    function update() {
      setSize({ width: window.innerWidth, height: window.innerHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return size
}

type Cluster = { rides: Ride[]; raw: [number, number] }

// Simple single-pass, distance-threshold clustering — fine for a handful of
// ride markers; merges anything within CLUSTER_THRESHOLD_PX of an existing
// cluster's running centroid, at the current zoom scale.
function clusterPoints(points: { ride: Ride; raw: [number, number] }[], zoom: number): Cluster[] {
  const clusters: Cluster[] = []
  for (const point of points) {
    const nearby = clusters.find((cluster) => {
      const dx = (cluster.raw[0] - point.raw[0]) * zoom
      const dy = (cluster.raw[1] - point.raw[1]) * zoom
      return Math.hypot(dx, dy) < CLUSTER_THRESHOLD_PX
    })
    if (nearby) {
      const n = nearby.rides.length
      nearby.raw = [(nearby.raw[0] * n + point.raw[0]) / (n + 1), (nearby.raw[1] * n + point.raw[1]) / (n + 1)]
      nearby.rides.push(point.ride)
    } else {
      clusters.push({ rides: [point.ride], raw: point.raw })
    }
  }
  return clusters
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
  const { width, height } = useViewportSize()
  const [zoom, setZoom] = useState(1)
  // Controlled center/zoom for the ZoomableGroup — only ever set explicitly
  // (cluster clicks, or synced back from the user's own pan/zoom via
  // onMoveEnd), so re-renders don't snap the map back to a stale position.
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [0, 0],
    zoom: 1,
  })
  // Only cluster-click jumps get the CSS transition (below) — manual drags/
  // scroll-zoom stay 1:1 with the gesture, so this flips on right before the
  // jump and off again once the transition has had time to finish.
  const [animatingZoom, setAnimatingZoom] = useState(false)
  const animatingZoomTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (animatingZoomTimeout.current) clearTimeout(animatingZoomTimeout.current)
    }
  }, [])

  // Fits every ride marker into the viewport, offset into the space that's
  // actually visible next to the card panel (rather than the full, partly
  // obscured, viewport) — this becomes the map's resting zoom/pan state.
  const projection = useMemo(() => geoMercator().fitExtent(getVisibleExtent(width, height), RIDE_POINTS), [width, height])

  // How far the ZoomableGroup's own zoom multiplier can shrink that resting
  // view before the whole world (not just the fitted ride cluster) fills the
  // same visible extent — i.e. the floor stops at "world visible", not
  // an arbitrarily small speck.
  const minZoom = useMemo(() => {
    const worldScale = geoMercator().fitExtent(getVisibleExtent(width, height), { type: 'Sphere' }).scale()
    return worldScale / projection.scale()
  }, [width, height, projection])

  const points = useMemo(
    () => RIDES.map((ride) => ({ ride, raw: projection([ride.lon, ride.lat]) as [number, number] })),
    [projection],
  )

  const clusters = useMemo(() => clusterPoints(points, zoom), [points, zoom])

  return (
    <div className="relative h-full w-full cursor-grab overflow-hidden bg-[radial-gradient(120%_100%_at_50%_15%,rgba(24,26,24,1)_0%,rgba(2,3,3,1)_75%)] active:cursor-grabbing">
      <ComposableMap
        // react-simple-maps accepts a live GeoProjection instance at runtime
        // (it just checks typeof === 'function'), but @types/react-simple-maps
        // only models the string-name factory shape — hence the cast.
        projection={projection as unknown as ProjectionFunction}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="ride-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D8F250" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#D8F250" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#D8F250" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          minZoom={minZoom}
          maxZoom={8}
          onMove={({ zoom: z }) => setZoom(z)}
          onMoveEnd={(pos) => setPosition(pos)}
          className={cn(animatingZoom && 'cycling-cluster-zoom')}
        >
          <Geographies geography={worldTopo}>
            {({ geographies }) =>
              geographies.map((geo) => <Geography key={geo.rsmKey} geography={geo} style={GEOGRAPHY_STYLE} />)
            }
          </Geographies>

          {clusters.map((cluster) => {
            const isSingle = cluster.rides.length === 1
            const ride = cluster.rides[0]
            const active = isSingle ? activeSlug === ride.slug : cluster.rides.some((r) => r.slug === activeSlug)
            const key = isSingle ? ride.slug : cluster.rides.map((r) => r.slug).join('+')

            return (
              <g
                key={key}
                transform={`translate(${cluster.raw[0]} ${cluster.raw[1]})`}
                onMouseEnter={() => isSingle && onActivate(ride.slug)}
                onMouseLeave={() => isSingle && onDeactivate()}
                onClick={() => {
                  if (isSingle) return
                  const coordinates = projection.invert?.(cluster.raw)
                  if (!coordinates) return
                  // Programmatic center/zoom changes bypass the ZoomableGroup's
                  // own move events, so `zoom` (normally kept live by onMove
                  // during manual drags) has to be synced by hand here too —
                  // otherwise a second cluster click reuses a stale multiplier
                  // and appears to do nothing.
                  const nextZoom = Math.min(zoom * 2.5, 8)
                  setZoom(nextZoom)
                  setAnimatingZoom(true)
                  setPosition({ coordinates, zoom: nextZoom })
                  if (animatingZoomTimeout.current) clearTimeout(animatingZoomTimeout.current)
                  animatingZoomTimeout.current = setTimeout(() => setAnimatingZoom(false), CLUSTER_ZOOM_DURATION_MS)
                }}
                className="cursor-pointer outline-none"
              >
                {/* Counter-scales against the ZoomableGroup's own zoom so
                    marker size stays constant on screen instead of shrinking
                    to invisibility when zoomed out. */}
                <g transform={`scale(${1 / zoom})`}>
                  {isSingle ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <circle r={active ? 26 : 20} fill="url(#ride-glow)" className="transition-[r] duration-300 ease-out" />
                      <circle r={10} fill="#D8F250" stroke="#020303" strokeWidth={1.5} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="pointer-events-none select-none font-mono text-[10px] font-bold"
                        fill="#020303"
                      >
                        {cluster.rides.length}
                      </text>
                    </>
                  )}
                </g>
              </g>
            )
          })}
        </ZoomableGroup>
      </ComposableMap>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(2,3,3,.85) 0%, rgba(2,3,3,.35) 22%, rgba(2,3,3,.15) 45%, rgba(2,3,3,.35) 75%, rgba(2,3,3,.85) 100%)',
        }}
      />
    </div>
  )
}
