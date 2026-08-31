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
