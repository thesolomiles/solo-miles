import { RIDE } from '../../config/ride'
import { RIDECAM_ON } from '../../state/rideCam'

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
export const CURVE = { phase: 0, amp: 1 }

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
  return CURVE.amp * (curveRaw(z) - curveRaw(RIDE.runnerZ))
}

/** dx/dz of the road centre — numeric, tracks the full profile. Used to offset
 *  ribbons/props along the road normal so they keep width through sharp bends. */
export function curveSlope(z: number): number {
  const h = 0.6
  return (CURVE.amp * (curveRaw(z + h) - curveRaw(z - h))) / (2 * h)
}

// --- Elevation (PROTOTYPE, `?ridecam`) ----------------------------------------
// The road rises and falls with a climb profile instead of only slowing down.
// Like roadX, the height is anchored to ZERO at the riders' row, so the riders
// stay put and the hills flow past them; MotionDriver reads the same profile's
// gradient for the pace + HUD, so what you see and how fast you go agree.

export const ELEV = { on: RIDECAM_ON }

/** Metres of road per world unit: the cruise scroll speed IS the cruise km/h. */
export const M_PER_U = RIDE.baseSpeedKmh / 3.6 / RIDE.scrollSpeed
/** Vertical exaggeration so a real 6–10% climb reads at a glance on screen. */
const EXAG = 2.2

// Namsan × Bugaksan, hand-shaped and compressed into one loop (no GPX yet): the
// city run-in, Namsan's climb with its steep corner to the tower, a descent and
// valley, then Bugaksan's Skyway with its 10%+ pitch, and the long drop back.
// [length m, grade %]; the closing descent is solved so the loop meets itself.
const SEGS: [number, number][] = [
  [300, 0.5], [150, 2.5], // city, run-in
  [250, 5], [200, 7.5], [120, 10], [280, 6], [150, 4], // Namsan
  [120, 0], [350, -7], [200, -4], [250, 0.5], // tower, descent, valley
  [200, 6], [150, 10.5], [220, 8], [120, 3], // Bugaksan Skyway
  [100, 0], [450, -8], [300, -5], // top, descent
]
const STEP = 2 // metres per table sample
const PROFILE = (() => {
  const segs = SEGS.slice()
  const rise = segs.reduce((a, [l, g]) => a + (l * g) / 100, 0)
  const close = 600
  segs.push([close, (-rise / close) * 100])
  const raw: number[] = []
  for (const [l, g] of segs) for (let d = 0; d < l; d += STEP) raw.push(g)
  const n = raw.length
  // Ease the gradient changes (circular box blur ~80 m) so crests and dips roll.
  const W = 40 / STEP
  const grade = raw.map((_, i) => {
    let a = 0
    for (let k = -W; k <= W; k++) a += raw[(i + k + n) % n]
    return a / (2 * W + 1)
  })
  const elev = new Float32Array(n + 1)
  for (let i = 0; i < n; i++) elev[i + 1] = elev[i] + (grade[i] / 100) * STEP
  // Blur drift is tiny but remove it so the loop closes exactly.
  const drift = elev[n]
  for (let i = 0; i <= n; i++) elev[i] -= (drift * i) / n
  return { grade, elev, n, length: n * STEP }
})()

function sampleM(w: number): number {
  const d = ((w * M_PER_U) % PROFILE.length + PROFILE.length) % PROFILE.length
  const f = d / STEP
  const i = Math.floor(f)
  const t = f - i
  return PROFILE.elev[i] * (1 - t) + PROFILE.elev[i + 1] * t
}

/** Real road gradient (%) at route coordinate w (= z + phase). */
export function gradeAtW(w: number): number {
  const d = ((w * M_PER_U) % PROFILE.length + PROFILE.length) % PROFILE.length
  return PROFILE.grade[Math.floor(d / STEP) % PROFILE.n]
}

/** Height of the ground/road at world z, ZERO at the riders' row. */
export function elevY(z: number): number {
  if (!ELEV.on) return 0
  return ((sampleM(z + CURVE.phase) - sampleM(RIDE.runnerZ + CURVE.phase)) / M_PER_U) * EXAG
}

/** dy/dz of the (exaggerated) road — for pitching riders and dashes. */
export function elevSlope(z: number): number {
  if (!ELEV.on) return 0
  const h = 0.6
  return (elevY(z + h) - elevY(z - h)) / (2 * h)
}

/** Side-profile cut-away: props on the camera side of this x are hidden so they
 *  don't block the riders (−Infinity = off). Set by the ride camera. */
export const VIEW = { cutX: -Infinity, stagger: 0, clearX: 0, clearZ: 0, clearR: 0 }

/** Should a prop at (x, z) be hidden for the current shot? The side profile hides
 *  everything on the camera side of the cut; the roadside tripod clears a circle
 *  around itself so it isn't filming the inside of a tree. */
export function hiddenByView(x: number, z: number): boolean {
  if (x < VIEW.cutX) return true
  if (VIEW.clearR > 0) {
    const dx = x - VIEW.clearX, dz = z - VIEW.clearZ
    return dx * dx + dz * dz < VIEW.clearR * VIEW.clearR
  }
  return false
}
