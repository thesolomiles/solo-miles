import * as THREE from 'three'

/**
 * The main-map pine, captured for reuse in the ride scene.
 *
 * The town's pines are single meshes named `Pine_*` sharing the one palette
 * material. At town load they get baked into an InstancedMesh and detached from
 * the scene (systems/instancing.ts), so by the time a ride runs the named pine
 * is gone. TownModel calls `capturePineAsset` just BEFORE that batching to stash
 * the pine's geometry + material here; the ride's roadside pines then reuse them
 * (see three/ride/RideWorld.tsx) so they read identical to the map.
 */
export interface PineAsset {
  geometry: THREE.BufferGeometry
  material: THREE.Material
}

let pine: PineAsset | null = null

/** Grab the first `Pine_*` mesh's geometry + material. Idempotent + cheap; a
 *  no-op once captured or if the town has no pines. Call before instancing. */
export function capturePineAsset(scene: THREE.Object3D): void {
  if (pine) return
  let found: THREE.Mesh | null = null
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!found && m.isMesh && /^Pine_/.test(m.name)) found = m
  })
  if (!found) return
  const mesh = found as THREE.Mesh
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  pine = { geometry: mesh.geometry, material }
}

export function getPineAsset(): PineAsset | null {
  return pine
}
