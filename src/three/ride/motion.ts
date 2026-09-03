import { RIDE } from '../../config/ride'

/**
 * Shared motion primitives for the ride scene and its kits. The world scrolls at
 * a live speed (eased by the simulated gradient in RideWorld's MotionDriver);
 * everything that moves — the roadside fields, the road curve, and the scenery
 * kits — reads `MOTION.speed` so they all march in lockstep.
 */
export const MOTION = { speed: RIDE.scrollSpeed, grade: 0 }

/** Length of the recycle band along Z: props spawn at `spawnZ` (up-screen) and
 *  wrap forward by one span once they pass it. */
export const SPAN = RIDE.recycleZ - RIDE.spawnZ

// The land side alternates ALONG the road between tidy farm stretches and small
// wild tree-grove stretches, so crops and trees never share ground. Intervals are
// in u-space = the instance's ORIGINAL offset from spawnZ, in [0, SPAN) — stable
// per instance because every field/prop scrolls and wraps by exactly SPAN, so a
// cell's membership decided at creation holds forever. Groves are a small minority
// (farmland dominates); trees live in the grove CORE while the fields skip a wider
// zone (core + GROVE_MARGIN each side) so tree canopies never overhang the crops.
export const LAND_GROVES: readonly [number, number][] = [
  [18, 23],
  [49, 53],
]
/** Bare buffer (world units) the fields leave around each grove so tree canopies
 *  never touch a crop plot. */
export const GROVE_MARGIN = 3.2

/** Is a base z (creation-time) inside the buffered no-crops zone around a grove?
 *  (Used by the farmland to keep a clear margin; trees themselves stay in the raw
 *  grove core, LAND_GROVES.) */
export function inGrove(baseZ: number): boolean {
  const u = (((baseZ - RIDE.spawnZ) % SPAN) + SPAN) % SPAN
  return LAND_GROVES.some(([a, b]) => u >= a - GROVE_MARGIN && u < b + GROVE_MARGIN)
}

/** Small deterministic RNG so scenery lays out the same every ride. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- The winding road ---------------------------------------------------------
// The road meanders left/right. `roadX(z)` is the road centre's x at world z,
// anchored to zero at the riders' row so they sit still and centred while the
// bends flow past. `CURVE.phase` (integrated from MOTION.speed by MotionDriver)
// slides the bends up-screen in lockstep with the scenery. Everything anchored to
// the road — the ribbon, the dashes, the roadside props, and the scenery kits —
// reads its x from `roadX`, so the whole scene bends together.
export const CURVE = { phase: 0 }

/** Road-centre x as a function of the along-route coordinate w = z + phase.
 *  Varied over distance: long near-straight runs, gentler curves, the occasional
 *  sharp switchback. */
export function curveRaw(z: number): number {
  const w = z + CURVE.phase
  const regime = 0.5 + 0.5 * Math.sin(w * 0.008 + 0.6)
  const b = Math.max(0, Math.sin(w * 0.017 + 1.2))
  const burst = b * b * b
  const gentle = 2.4 * Math.sin(w * 0.042) + 1.0 * Math.sin(w * 0.026 + 1.1)
  const switchback = 5.4 * Math.sin(w * 0.1 + 0.4)
  return regime * gentle + burst * switchback
}

/** Road-centre x at world z, anchored so it's ZERO at the riders' row. */
export function roadX(z: number): number {
  return curveRaw(z) - curveRaw(RIDE.runnerZ)
}

/** dx/dz of the road centre — numeric, tracks the full profile. Used to offset
 *  ribbons/props along the road normal so they keep width through sharp bends. */
export function curveSlope(z: number): number {
  const h = 0.6
  return (curveRaw(z + h) - curveRaw(z - h)) / (2 * h)
}
