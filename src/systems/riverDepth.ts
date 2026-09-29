import * as THREE from 'three'

/**
 * Bake how deep the water is under every vertex of the `River` mesh into an
 * `aDepth` attribute (water surface y − riverbed y), so the water shader can
 * shade by depth: clear turquoise over the shallow banks, denser blue down the
 * middle of the channel. No depth pre-pass needed — mobile-safe.
 *
 * The bed is the `Ground` mesh. Only its triangles inside the river band are
 * tested, bucketed by x, so the bake is a few ms once per load. Negative depth
 * means the vertex sits under the bank (the water mesh is a full-width strip the
 * ground clips) — those fragments are hidden anyway. Both meshes have identity
 * world transforms in town.glb, so local coords are world coords.
 *
 * Idempotent: TownModel remounts on every return from an interior, but the
 * cached glTF scene keeps the attribute, so a second call is a no-op.
 */
const BAND_PAD = 1.5 // extra z around the river's bounds when picking bed triangles
const BUCKET = 2 // x-bucket width for the bed triangle lookup

export function bakeRiverDepth(river: THREE.Mesh, ground: THREE.Mesh): void {
  const geo = river.geometry
  if (geo.getAttribute('aDepth')) return

  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const z0 = bb.min.z - BAND_PAD
  const z1 = bb.max.z + BAND_PAD

  const gp = ground.geometry.getAttribute('position')
  const gi = ground.geometry.index
  const triCount = (gi ? gi.count : gp.count) / 3
  const idx = (n: number) => (gi ? gi.getX(n) : n)

  // Bed triangles as flat [ax,ay,az, bx,by,bz, cx,cy,cz], bucketed by x.
  const buckets = new Map<number, number[][]>()
  for (let t = 0; t < triCount; t++) {
    const tri: number[] = []
    for (let k = 0; k < 3; k++) {
      const i = idx(t * 3 + k)
      tri.push(gp.getX(i), gp.getY(i), gp.getZ(i))
    }
    if (Math.max(tri[2], tri[5], tri[8]) < z0 || Math.min(tri[2], tri[5], tri[8]) > z1) continue
    const b0 = Math.floor(Math.min(tri[0], tri[3], tri[6]) / BUCKET)
    const b1 = Math.floor(Math.max(tri[0], tri[3], tri[6]) / BUCKET)
    for (let b = b0; b <= b1; b++) {
      if (!buckets.has(b)) buckets.set(b, [])
      buckets.get(b)!.push(tri)
    }
  }

  // Highest bed point straight below (x, z), by barycentric test in the xz plane.
  const bedY = (x: number, z: number): number => {
    let best = -Infinity
    for (const t of buckets.get(Math.floor(x / BUCKET)) ?? []) {
      const d = (t[5] - t[8]) * (t[0] - t[6]) + (t[6] - t[3]) * (t[2] - t[8])
      if (Math.abs(d) < 1e-9) continue
      const l1 = ((t[5] - t[8]) * (x - t[6]) + (t[6] - t[3]) * (z - t[8])) / d
      const l2 = ((t[8] - t[2]) * (x - t[6]) + (t[0] - t[6]) * (z - t[8])) / d
      const l3 = 1 - l1 - l2
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue
      best = Math.max(best, l1 * t[1] + l2 * t[4] + l3 * t[7])
    }
    return best
  }

  const p = geo.getAttribute('position')
  const depth = new Float32Array(p.count)
  for (let i = 0; i < p.count; i++) {
    const y = bedY(p.getX(i), p.getZ(i))
    // No bed found (off the ground tile) → treat as deep water.
    depth[i] = Number.isFinite(y) ? p.getY(i) - y : 1
  }
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1))
}
