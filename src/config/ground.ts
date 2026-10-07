import { SOUTH_TRAIL } from './forest'

/**
 * The town ground, painted in code (three/groundPaint.ts) instead of UV-painted
 * into the Blender `Ground` mesh. Blender only needs one grass swatch; the grass
 * variation and every dirt path here are drawn by a shader on top of it.
 *
 * Coordinates are town (x, z). Everything snaps to a `cell` grid, so path edges
 * and grass tones step like pixel art.
 */
export type GroundPath =
  | { id: string; style: PathStyle; width: number; line: [number, number][] }
  | { id: string; style: PathStyle; rect: [minX: number, maxX: number, minZ: number, maxZ: number]; round?: number }

export type PathStyle = 'dirt' | 'overgrown'

export const GROUND = {
  /** The "pixel" size (u) everything snaps to. */
  cell: 0.25,
  /** Area the path map covers (the Ground tile is ±27.6). */
  extent: 28,

  grass: {
    base: '#4d7c46', // the palette swatch the Blender ground uses
    dark: '#48743f',
    light: '#5a8a4b',
    dry: '#6f8a47', // rare warm patches
    /** Noise frequency (1/u) — lower = bigger blotches. */
    scale: 0.16,
    /** Noise thresholds: below `darkAt` → dark, above `lightAt` → light, above `dryAt` → dry. */
    darkAt: 0.36,
    lightAt: 0.64,
    dryAt: 0.76,
    /** Per-cell brightness jitter (±fraction) so flat areas aren't dead. */
    jitter: 0.035,
  },

  dirt: {
    mid: '#8d755d',
    light: '#947e66',
    dark: '#6b5d51',
    pale: '#b19b77',
    /** Solid dirt starts this far in from the edge (u)… */
    rim: 0.35,
    /** …and fades out to grass over this far beyond it (u). */
    fringe: 0.7,
    /** Fillet radius (u) where dirt shapes meet — bigger = rounder corners. */
    round: 1.2,
    /** Chance of a grass tile inside the path. */
    tufts: 0.012,
  },

  /** Paths. Dirt shapes merge into one surface, so joints are seamless. */
  paths: [
    // Driveway out of the garage.
    { id: 'driveway', style: 'dirt', width: 2.4, line: [[-14, -1.4], [-14, 2.6]] },
    // The walk along the front of the houses to the café.
    { id: 'front-walk', style: 'dirt', width: 1.4, line: [[-15.2, 3.5], [-6, 3.6], [1, 3.4], [9.5, 3.5]] },
    // Spur up to the house's front step (step spans x −9.72…−6.86, front edge z 1.99).
    { id: 'porch', style: 'dirt', rect: [-9.7, -6.9, 1.7, 3.6], round: 0.3 },
    // The café forecourt, up to its steps.
    { id: 'cafe-forecourt', style: 'dirt', rect: [8.8, 13.4, 1.4, 4.2], round: 0.6 },
    // Apron under the road's south end (TownRoad stops at z 2.7), so the tarmac
    // runs onto dirt: shoulders show either side and fillet into the walk.
    { id: 'road-apron', style: 'dirt', rect: [-2.3, 3.1, 0.4, 3.6], round: 0.5 },
    // Secret trail south into the forest.
    { id: 'south-trail', style: 'overgrown', width: SOUTH_TRAIL.width, line: SOUTH_TRAIL.line },
  ] as GroundPath[],

  /** Faces of the old painted ground are only repainted outside the river band
   *  (z), so its banks and bed keep their Blender colours. */
  riverBand: [-14.8, -4.2] as [number, number],
}
