import type * as THREE from 'three'
import { WORLD, type Collider } from '../config/town'

/**
 * Resolve the player's position against colliders and the world edge, in
 * place. Two collider shapes:
 *
 * - Circle (`{x,z,r}`) — buildings. If the player is inside the circle, shove
 *   them back out to its edge along the contact normal.
 * - Box/AABB (`{minX,maxX,minZ,maxZ}`) — the river banks and the construction
 *   sites, which are long or square and read badly as circles. If the player is
 *   inside the box, push them out along the axis of least penetration (the
 *   nearest edge — for a thin river band that's always back to the near bank).
 *
 * (Brief: start simple; only reach for a physics engine if this stops being
 * enough — it won't for a town this size.)
 */
export function resolveCollisions(pos: THREE.Vector3, colliders: Collider[]) {
  for (const c of colliders) {
    if ('minX' in c) {
      // Box: only act when the player is strictly inside.
      if (pos.x > c.minX && pos.x < c.maxX && pos.z > c.minZ && pos.z < c.maxZ) {
        const dLeft = pos.x - c.minX
        const dRight = c.maxX - pos.x
        const dNear = pos.z - c.minZ
        const dFar = c.maxZ - pos.z
        const m = Math.min(dLeft, dRight, dNear, dFar)
        if (m === dLeft) pos.x = c.minX
        else if (m === dRight) pos.x = c.maxX
        else if (m === dNear) pos.z = c.minZ
        else pos.z = c.maxZ
      }
    } else {
      const dx = pos.x - c.x
      const dz = pos.z - c.z
      const d = Math.hypot(dx, dz)
      if (d < c.r && d > 1e-4) {
        pos.x = c.x + (dx / d) * c.r
        pos.z = c.z + (dz / d) * c.r
      }
    }
  }
  // Square world edge (matches the square ground), not a circle: a circular
  // clamp cut through the open meadows this scattered forest leaves between the
  // town and the trees, reading as an invisible wall on open grass. Now the only
  // hard wall is at the ground's edge, screened by the outer forest; everything
  // in between is contained by the tree/rock/building colliders themselves.
  const b = WORLD.boundary
  pos.x = Math.max(-b, Math.min(b, pos.x))
  pos.z = Math.max(-b, Math.min(b, pos.z))
}
