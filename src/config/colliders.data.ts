import type { BoxCollider } from './town'

/**
 * Hand-authored collision boxes — the single source of truth for what blocks
 * the player. Collision is authored by hand now: the auto-derived tree/building
 * boxes are still computed from town.glb (see systems/colliders.ts) but only as
 * a starting point the editor can pull in; they are NOT applied at runtime.
 *
 * Edit these live in the browser: open the app with `?edit`, add/drag/delete
 * boxes on the ground, then hit "Copy JSON" and paste the result over the array
 * below and commit. While editing, a localStorage draft overrides this list so
 * changes survive reloads until you export them here.
 *
 * The square world edge (WORLD.boundary) is applied separately in
 * systems/collision.ts and is not listed here.
 */
export const MANUAL_COLLIDERS: BoxCollider[] = [
  // Hand-drawn in ?edit (Leonard) — the two boxes by the west house.
  { minX: -12.8, maxX: -6.4, minZ: -8.2, maxZ: 2.1 },
  { minX: -17.1, maxX: -11.1, minZ: -6.8, maxZ: 0.1 },
]
