import * as THREE from 'three'
import { SOUTH_TRAIL } from '../config/forest'

/**
 * The south trail is cut in code rather than in home-town.blend: at load, drop
 * the pines / stumps / bushes standing on SOUTH_TRAIL.line, before colliders and
 * instancing read the scene. Bigger pines need a wider berth (their skirts
 * spread with scale). Bake it into Blender later if the trail settles.
 */
const CLEARED = /^(PineTree|Stump|Bush)/

/** Distance from (x, z) to the trail's centre line. */
export function trailDistance(x: number, z: number): number {
  const line = SOUTH_TRAIL.line
  let best = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i]
    const [bx, bz] = line[i + 1]
    const vx = bx - ax
    const vz = bz - az
    const t = THREE.MathUtils.clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1)
    best = Math.min(best, Math.hypot(x - ax - t * vx, z - az - t * vz))
  }
  return best
}

export function clearSouthTrail(scene: THREE.Object3D): number {
  const doomed: THREE.Object3D[] = []
  for (const o of scene.children) {
    if (!CLEARED.test(o.name)) continue
    const reach = SOUTH_TRAIL.clearBase + SOUTH_TRAIL.clearPerScale * o.scale.y
    if (trailDistance(o.position.x, o.position.z) < reach) doomed.push(o)
  }
  for (const o of doomed) o.removeFromParent()
  return doomed.length
}
