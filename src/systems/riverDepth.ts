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

/**
 * A coarse xz grid over the river — water surface height + depth per cell —
 * rasterised from the River triangles (with their baked `aDepth`). Lets swimmers
 * (the koi) ask "how deep is it here?" in O(1). Built once, module-cached.
 */
export interface RiverGrid {
  /** Water surface y and depth at (x, z), or null off the river / under the bank. */
  sample(x: number, z: number): { y: number; depth: number } | null
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const GRID_CELL = 0.25
let grid: RiverGrid | null = null

if (import.meta.hot) import.meta.hot.dispose(() => (grid = null))

export function getRiverGrid(river?: THREE.Mesh): RiverGrid | null {
  if (grid || !river) return grid
  const geo = river.geometry
  const depth = geo.getAttribute('aDepth')
  if (!depth) return null
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  const w = Math.ceil((bb.max.x - bb.min.x) / GRID_CELL) + 1
  const h = Math.ceil((bb.max.z - bb.min.z) / GRID_CELL) + 1
  const ys = new Float32Array(w * h).fill(NaN)
  const ds = new Float32Array(w * h).fill(-1)
  const p = geo.getAttribute('position')
  const index = geo.index
  const n = index ? index.count : p.count
  const at = (k: number) => (index ? index.getX(k) : k)
  for (let t = 0; t < n; t += 3) {
    const a = at(t)
    const b = at(t + 1)
    const c = at(t + 2)
    const ax = p.getX(a), az = p.getZ(a), bx = p.getX(b), bz = p.getZ(b), cx = p.getX(c), cz = p.getZ(c)
    const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
    if (Math.abs(d) < 1e-9) continue
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - bb.min.x) / GRID_CELL))
    const i1 = Math.min(w - 1, Math.ceil((Math.max(ax, bx, cx) - bb.min.x) / GRID_CELL))
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - bb.min.z) / GRID_CELL))
    const j1 = Math.min(h - 1, Math.ceil((Math.max(az, bz, cz) - bb.min.z) / GRID_CELL))
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = bb.min.x + i * GRID_CELL
        const z = bb.min.z + j * GRID_CELL
        const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d
        const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d
        const l3 = 1 - l1 - l2
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue
        const k = j * w + i
        ys[k] = l1 * p.getY(a) + l2 * p.getY(b) + l3 * p.getY(c)
        ds[k] = l1 * depth.getX(a) + l2 * depth.getX(b) + l3 * depth.getX(c)
      }
    }
  }
  grid = {
    minX: bb.min.x,
    maxX: bb.max.x,
    minZ: bb.min.z,
    maxZ: bb.max.z,
    sample(x, z) {
      const i = Math.round((x - bb.min.x) / GRID_CELL)
      const j = Math.round((z - bb.min.z) / GRID_CELL)
      if (i < 0 || j < 0 || i >= w || j >= h) return null
      const k = j * w + i
      return Number.isNaN(ys[k]) ? null : { y: ys[k], depth: ds[k] }
    },
  }
  return grid
}
