import type * as THREE from 'three'
import { WORLD, type Collider } from '../config/town'

/**
 * Resolve the player's position against building colliders and the world
 * boundary, in place. Simple circle push-out: if the player is inside a
 * collider circle, shove them back out to its edge along the contact normal.
 * (Brief: start simple; only reach for a physics engine if this stops being
 * enough — it won't for a town this size.)
 */
export function resolveCollisions(pos: THREE.Vector3, colliders: Collider[]) {
  for (const c of colliders) {
    const dx = pos.x - c.x
    const dz = pos.z - c.z
    const d = Math.hypot(dx, dz)
    if (d < c.r && d > 1e-4) {
      pos.x = c.x + (dx / d) * c.r
      pos.z = c.z + (dz / d) * c.r
    }
  }
  const dc = Math.hypot(pos.x, pos.z)
  if (dc > WORLD.boundary) {
    pos.x *= WORLD.boundary / dc
    pos.z *= WORLD.boundary / dc
  }
}
