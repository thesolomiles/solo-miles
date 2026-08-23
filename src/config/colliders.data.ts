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
  // Hand-drawn in ?edit (Leonard), saved straight from the browser editor.
  { minX: -28.6, maxX: -23, minZ: -7.3, maxZ: 28.6 },
  { minX: -23.4, maxX: -15.4, minZ: 14.1, maxZ: 27.7 },
  { minX: -15.6, maxX: -7.8, minZ: 16.1, maxZ: 28.1 },
  { minX: -8.3, maxX: 29.8, minZ: 21.3, maxZ: 28.3 },
  { minX: 9.7, maxX: 27.8, minZ: 14.3, maxZ: 20.9 },
  { minX: -2.3, maxX: 3.5, minZ: 18.2, maxZ: 22.4 },
  { minX: 21.4, maxX: 27.4, minZ: 0.6, maxZ: 15.4 },
  { minX: 18.9, maxX: 22.9, minZ: 10.3, maxZ: 14.3 },
  { minX: 16.7, maxX: 20.3, minZ: -7.9, maxZ: -4.5 },
  { minX: 19.9, maxX: 29.2, minZ: -5.6, maxZ: 0.8 },
  { minX: 19.4, maxX: 28.5, minZ: -9.4, maxZ: -4.1 },
  { minX: 13, maxX: 20.5, minZ: -11.5, maxZ: -7.9 },
  { minX: 6.7, maxX: 13.2, minZ: -8.9, maxZ: 0.5 },
  { minX: 2.1, maxX: 14.2, minZ: -22.3, maxZ: -7 },
  { minX: 5.9, maxX: 9.9, minZ: -3.5, maxZ: 0.5 },
  { minX: 3.6, maxX: 15.2, minZ: -30.6, maxZ: -19.7 },
  { minX: -5.3, maxX: -1.3, minZ: -22, maxZ: -5.4 },
  { minX: -13, maxX: -5.8, minZ: -6.1, maxZ: 1.8 },
  { minX: -18.3, maxX: -4.6, minZ: -9.3, maxZ: -5.3 },
  { minX: -5.3, maxX: -3.2, minZ: -7, maxZ: -0.3 },
  { minX: -19, maxX: -11.6, minZ: -6.6, maxZ: 0.2 },
  { minX: -28.4, maxX: -17.6, minZ: -10.2, maxZ: -6.2 },
  { minX: -7.2, maxX: -3.2, minZ: -29.3, maxZ: -21.4 },
  { minX: -18.5, maxX: -14.5, minZ: 11.2, maxZ: 15.2 },
  { minX: -25.1, maxX: -21.3, minZ: 8.5, maxZ: 16.7 },
  { minX: -25.4, maxX: -21.3, minZ: -7.2, maxZ: 3 },
  { minX: -23.9, maxX: -19.9, minZ: -7.7, maxZ: -3.7 },
  { minX: 1.9, maxX: 2.9, minZ: -14.7, maxZ: -4.9 },
  { minX: -2.3, maxX: -1.1, minZ: -14.5, maxZ: -5.4 },
  { minX: -9.9, maxX: -6.7, minZ: -1, maxZ: 2.5 },
]
