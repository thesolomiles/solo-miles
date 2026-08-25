import { WORLD, type Collider } from '../config/town'
import { colliders as townColliders } from './colliders'
import { CAFE } from '../config/cafe'

/**
 * Which set of colliders + which boundary the Player resolves against right now.
 * The town is the default; entering the café swaps in its walls-and-obstacles
 * set and its rectangular room bounds. InteriorController (three/Scene.tsx)
 * flips this whenever `interior` changes in the store.
 *
 * The boundary is either a number (the town's square ±half-extent, see
 * collision.ts) or an AABB (the café room). resolveCollisions handles both.
 */
export type Boundary = number | { minX: number; maxX: number; minZ: number; maxZ: number }

interface ActiveWorld {
  colliders: Collider[]
  boundary: Boundary
}

// townColliders is the live, mutable registry the ?edit editor drives — hold the
// reference, not a copy, so edits still apply in town.
let current: ActiveWorld = { colliders: townColliders, boundary: WORLD.boundary }

export function getActiveWorld(): ActiveWorld {
  return current
}

export function setActiveWorld(id: 'town' | 'cafe') {
  current =
    id === 'cafe'
      ? { colliders: CAFE.colliders, boundary: CAFE.bounds }
      : { colliders: townColliders, boundary: WORLD.boundary }
}
