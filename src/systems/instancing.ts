import * as THREE from 'three'

/**
 * Collapse the scattered props (trees, rocks, grass, bushes, stumps) into one
 * `InstancedMesh` per source mesh, at load time.
 *
 * Why this is safe to do bluntly: every scattered item is a copy of one of a
 * handful of source meshes, so we group by geometry *content* (a hash of the
 * vertex positions + the shared material) — every copy of a given source lands
 * in one group regardless of whether it was a linked dup (`Alt+D`, shared
 * geometry) or a full copy (`Shift+D`, its own identical datablock). Each item's
 * own scale/rotation/position rides along as its node matrix, which we bake into
 * the instance matrix. Unique meshes (buildings, ground, river, bridge) hash to
 * their own group of one and are left completely alone.
 *
 * The point: the .glb still exports one object per item, so Blender editing
 * stays per-object (duplicate/move/delete a single tree, re-export — done). The
 * batching lives here, runs once, and turns hundreds of draw calls into a
 * handful without changing the authoring workflow.
 */

/** A stable key for a mesh's geometry content + material, so identical meshes
 *  group together whether or not they share a BufferGeometry instance. */
function contentKey(geom: THREE.BufferGeometry, mat: THREE.Material): string {
  const pos = geom.getAttribute('position')
  const arr = pos.array as ArrayLike<number>
  // Hash a fixed sampling of the positions — identical geometry hashes the same;
  // sampling keeps it cheap for hundreds of small meshes.
  let h = 2166136261 >>> 0
  const step = Math.max(1, Math.floor(arr.length / 256))
  for (let i = 0; i < arr.length; i += step) {
    h ^= (arr[i] * 1000) | 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return `${pos.count}|${h}|${mat.uuid}`
}
export function instanceScatter(scene: THREE.Object3D): number {
  if (scene.userData.__instanced) return 0
  scene.userData.__instanced = true

  scene.updateMatrixWorld(true)
  const sceneInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()

  interface Group {
    geom: THREE.BufferGeometry
    mat: THREE.Material | THREE.Material[]
    matrices: THREE.Matrix4[]
    meshes: THREE.Mesh[]
  }
  const groups = new Map<string, Group>()

  scene.traverse((o) => {
    const m = o as THREE.Mesh & { isInstancedMesh?: boolean }
    if (!m.isMesh || m.isInstancedMesh) return
    const mat0 = Array.isArray(m.material) ? m.material[0] : m.material
    if (!m.geometry.getAttribute('position') || !mat0) return
    const key = contentKey(m.geometry, mat0)
    let g = groups.get(key)
    if (!g) {
      g = { geom: m.geometry, mat: m.material, matrices: [], meshes: [] }
      groups.set(key, g)
    }
    // Node world transform, expressed relative to the glb root so the
    // InstancedMesh (added under that root) reproduces each item exactly.
    g.matrices.push(new THREE.Matrix4().multiplyMatrices(sceneInv, m.matrixWorld))
    g.meshes.push(m)
  })

  // Only worth batching sizeable groups; small ones stay as-is.
  const MIN_INSTANCES = 6
  let removed = 0

  for (const g of groups.values()) {
    if (g.matrices.length < MIN_INSTANCES) continue
    const inst = new THREE.InstancedMesh(g.geom, g.mat as THREE.Material, g.matrices.length)
    g.matrices.forEach((mtx, i) => inst.setMatrixAt(i, mtx))
    inst.instanceMatrix.needsUpdate = true
    inst.castShadow = true
    inst.receiveShadow = true
    // Bounding sphere from the instances, so the whole group can still be
    // frustum-culled when it's entirely off the follow-cam.
    inst.computeBoundingSphere()
    inst.name = 'Instanced'
    scene.add(inst)
    // The shared geometry lives on in the InstancedMesh; just detach the
    // now-redundant node meshes (never dispose — the geometry is shared).
    for (const mesh of g.meshes) mesh.removeFromParent()
    removed += g.meshes.length - 1
  }
  return removed
}
