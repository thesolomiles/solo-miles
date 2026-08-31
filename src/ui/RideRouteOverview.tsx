import { useMemo } from 'react'
import { useRideHud } from '../state/rideHud'
import { useGame } from '../state/store'
import { ROUTES } from '../config/worlds'

const W = 156
const H = 92
const PAD = 14

/** Small deterministic RNG so a route's trace looks the same every ride. */
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

/** Build a deterministic wandering trace for a route: a run of points that drift
 *  left→right across the box, jittered vertically, normalised to fit the frame. */
function buildTrace(id: string): { pts: [number, number][]; d: string; len: number; at: (p: number) => [number, number] } {
  const rand = seeded(id)
  const N = 7
  const raw: [number, number][] = []
  let y = 0.5
  for (let i = 0; i < N; i++) {
    y += (rand() - 0.5) * 0.9
    raw.push([i / (N - 1), y])
  }
  // Normalise Y into [0,1].
  const ys = raw.map((p) => p[1])
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const span = hi - lo || 1
  const pts: [number, number][] = raw.map(([x, yy]) => [
    PAD + x * (W - 2 * PAD),
    PAD + ((yy - lo) / span) * (H - 2 * PAD),
  ])
  // Smooth-ish path via quadratic segments through midpoints.
  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1]
    const [cx, cy] = pts[i]
    const mx = (px + cx) / 2
    const my = (py + cy) / 2
    d += ` Q ${px.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${last[0].toFixed(1)} ${last[1].toFixed(1)}`
  // Cumulative segment lengths, for placing the progress marker.
  const seg: number[] = [0]
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    seg.push(len)
  }
  const at = (p: number): [number, number] => {
    const target = Math.max(0, Math.min(1, p)) * len
    for (let i = 1; i < pts.length; i++) {
      if (seg[i] >= target) {
        const t = (target - seg[i - 1]) / (seg[i] - seg[i - 1] || 1)
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
      }
    }
    return last
  }
  return { pts, d, len, at }
}

/**
 * Route overview — a little map trace in the top-right of the ride scene showing
 * the whole route as a line, with a dot creeping along it as your distance ticks
 * up. The trace is a deterministic squiggle keyed off the route id (placeholder
 * until real route geometry lands); progress is distance / route total.
 */
export function RideRouteOverview() {
  const ride = useGame((s) => s.ride)
  const route = ride ? ROUTES[ride] : null
  const distanceKm = useRideHud((s) => s.distanceKm)
  const trace = useMemo(() => (route ? buildTrace(route.id) : null), [route?.id])
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
