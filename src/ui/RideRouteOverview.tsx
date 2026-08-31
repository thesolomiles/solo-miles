import { useEffect, useMemo, useState } from 'react'
import { useRideHud } from '../state/rideHud'
import { useGame } from '../state/store'
import { ROUTES, type Route } from '../config/worlds'

const W = 156
const H = 92
const PAD = 14

interface Trace {
  pts: [number, number][]
  d: string
  at: (p: number) => [number, number]
}

/** Finish a trace from pixel-space points: an M/L path string plus an `at(p)`
 *  that returns the point at fraction p (0–1) along the polyline by arc length. */
function finishTrace(pts: [number, number][]): Trace {
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`
  const seg: number[] = [0]
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    seg.push(len)
  }
  const last = pts[pts.length - 1]
  const at = (p: number): [number, number] => {
    const target = Math.max(0, Math.min(1, p)) * len
    for (let i = 1; i < pts.length; i++) {
      if (seg[i] >= target) {
        const t = (target - seg[i - 1]) / (seg[i] - seg[i - 1] || 1)
        return [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t,
        ]
      }
    }
    return last
  }
  return { pts, d, at }
}

/** Fit raw (route-map) points into the frame, preserving aspect ratio + centred. */
function fitPoints(raw: [number, number][]): Trace {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of raw) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const bw = maxX - minX || 1
  const bh = maxY - minY || 1
  const scale = Math.min((W - 2 * PAD) / bw, (H - 2 * PAD) / bh)
  const ox = PAD + ((W - 2 * PAD) - bw * scale) / 2
  const oy = PAD + ((H - 2 * PAD) - bh * scale) / 2
  return finishTrace(raw.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale]))
}

/** Parse the M/L polyline points out of a route-map SVG's single <path d="…">. */
function parseRouteSvg(svg: string): [number, number][] | null {
  const m = svg.match(/ d="([^"]+)"/)
  if (!m) return null
  const nums = m[1].match(/-?\d+(?:\.\d+)?/g)
  if (!nums || nums.length < 4) return null
  const pts: [number, number][] = []
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([parseFloat(nums[i]), parseFloat(nums[i + 1])])
  return pts
}

/** Small deterministic RNG so the fallback trace looks the same every ride. */
function seeded(id: string) {
  let s = 0
  for (let i = 0; i < id.length; i++) s = (s * 31 + id.charCodeAt(i)) | 0
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fallback: a deterministic wandering squiggle keyed off the route id, used
 *  while the real route map loads or if it can't be fetched. */
function fallbackTrace(id: string): Trace {
  const rand = seeded(id)
  const N = 7
  const raw: [number, number][] = []
  let y = 0.5
  for (let i = 0; i < N; i++) {
    y += (rand() - 0.5) * 0.9
    raw.push([i / (N - 1), y])
  }
  return fitPoints(raw)
}

/**
 * Route overview — a little map trace in the top-right of the ride scene showing
 * the whole route as a line, with a dot creeping along it as your distance ticks
 * up. It draws the route's **real GPS trace** (public/routes/<id>.svg, the same
 * shape as the world-selector card), fitted into the frame; progress is
 * distance / route total. Falls back to a deterministic squiggle while the SVG
 * loads or if a route has no map.
 */
function useRouteTrace(route: Route | null): Trace | null {
  const [real, setReal] = useState<{ id: string; trace: Trace } | null>(null)
  useEffect(() => {
    if (!route?.map) return
    let alive = true
    fetch(route.map)
      .then((r) => r.text())
      .then((svg) => {
        if (!alive) return
        const pts = parseRouteSvg(svg)
        if (pts && pts.length > 1) setReal({ id: route.id, trace: fitPoints(pts) })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [route?.id, route?.map])
  const fallback = useMemo(() => (route ? fallbackTrace(route.id) : null), [route?.id])
  if (!route) return null
  return real && real.id === route.id ? real.trace : fallback
}

export function RideRouteOverview() {
  const ride = useGame((s) => s.ride)
  const route = ride ? ROUTES[ride] : null
  const distanceKm = useRideHud((s) => s.distanceKm)
  const trace = useRouteTrace(route)
  if (!route || !trace) return null

  const p = route.distanceKm > 0 ? distanceKm / route.distanceKm : 0
  const [mx, my] = trace.at(p)
  const start = trace.pts[0]
  const end = trace.pts[trace.pts.length - 1]

  return (
    <div className="ride-map">
      <div className="ride-map__title">Route</div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="ride-map__svg" aria-hidden>
        {/* full route (faint) then the ridden portion, drawn over it up to `p` */}
        <path d={trace.d} className="ride-map__line" />
        <path
          d={trace.d}
          className="ride-map__line ride-map__line--done"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - Math.max(0, Math.min(1, p))}
        />
        <circle cx={start[0]} cy={start[1]} r={3} className="ride-map__start" />
        <circle cx={end[0]} cy={end[1]} r={3} className="ride-map__end" />
        <circle cx={mx} cy={my} r={4.5} className="ride-map__dot" />
      </svg>
      <div className="ride-map__meta">
        {distanceKm.toFixed(1)} / {route.distanceKm} km
      </div>
    </div>
  )
}
