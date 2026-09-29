import * as THREE from 'three'

/**
 * The rocks the river actually runs into, and a foam mask painted around them.
 *
 * Candidates are every mesh named `RiverRock*` — the ~45 `RiverRock_N` boulders
 * plus the merged `RiverRocks` mesh (split back into its ~15 stones by vertex
 * connectivity). A stone counts as "wet" when it sits in the channel (baked
 * `aDepth` > 0 under it) and reaches the waterline. Stones that break the
 * surface foam fully; ones just under it make a weaker riffle.
 *
 * The mask is one small canvas over the river's xz bounds (R = foam amount): a
 * collar hugging each rock, heavier on its east face where the E→W current
 * hits, and a V-wake + turbulent core trailing west. The water shader thresholds
 * it against noise that scrolls west, so the foam holds at the rock and breaks
 * into flowing flecks down the wake. One texture fetch per water fragment —
 * mobile-safe, no extra pass.
 *
 * Must run after bakeRiverDepth and BEFORE instanceScatter (which detaches the
 * named boulders). Module-cached: TownModel remounts after every interior, by
 * which point the boulders are instanced, so the first result is kept.
 */
export interface WetRock {
  x: number
  z: number
  /** Waterline radius (world units). */
  r: number
  /** Water surface height at the rock (before the ripple). */
  y: number
  /** 1 = breaks the surface, <1 = just under it. */
  s: number
}

export interface RiverFoam {
  rocks: WetRock[]
  mask: THREE.Texture
  /** minX, minZ, sizeX, sizeZ of the mask in world xz. */
  bounds: THREE.Vector4
}

const PX = 16 // mask pixels per world unit
let cached: RiverFoam | null = null

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cached?.mask.dispose()
    cached = null
  })
}

/** Split a mesh into its connected pieces (vertices welded by position). */
function components(mesh: THREE.Mesh): THREE.Vector3[][] {
  const pos = mesh.geometry.getAttribute('position')
  const index = mesh.geometry.index
  const n = pos.count
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]]
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  const seen = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    const j = seen.get(k)
    if (j === undefined) seen.set(k, i)
    else union(i, j)
  }
  const triVerts = index ? index.count : n
  for (let t = 0; t < triVerts; t += 3) {
    const a = index ? index.getX(t) : t
    union(a, index ? index.getX(t + 1) : t + 1)
    union(a, index ? index.getX(t + 2) : t + 2)
  }
  const groups = new Map<number, THREE.Vector3[]>()
  mesh.updateWorldMatrix(true, false)
  for (let i = 0; i < n; i++) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld))
  }
  return [...groups.values()]
}

function findWetRocks(scene: THREE.Object3D, river: THREE.Mesh): WetRock[] {
  const depth = river.geometry.getAttribute('aDepth')
  const ray = new THREE.Raycaster()
  const down = new THREE.Vector3(0, -1, 0)
  const rocks: WetRock[] = []

  const candidates: THREE.Mesh[] = []
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.name.startsWith('RiverRock')) candidates.push(m)
  })

  for (const mesh of candidates) {
    for (const pts of components(mesh)) {
      const box = new THREE.Box3().setFromPoints(pts)
      const x = (box.min.x + box.max.x) / 2
      const z = (box.min.z + box.max.z) / 2
      ray.set(new THREE.Vector3(x, 10, z), down)
      const hit = ray.intersectObject(river, false)[0]
      if (!hit?.face) continue
      const d = depth
        ? (depth.getX(hit.face.a) + depth.getX(hit.face.b) + depth.getX(hit.face.c)) / 3
        : 1
      const waterY = hit.point.y
      // In the channel, and reaching up to (or through) the waterline.
      if (d < 0.03 || box.max.y < waterY - 0.1 || box.min.y > waterY) continue
      const half = ((box.max.x - box.min.x) + (box.max.z - box.min.z)) / 4
      rocks.push({ x, z, r: half * 0.95, y: waterY, s: box.max.y > waterY + 0.05 ? 1 : 0.55 })
    }
  }
  return rocks
}

function paintMask(rocks: WetRock[], bounds: THREE.Vector4): THREE.Texture {
  const w = Math.ceil(bounds.z * PX)
  const h = Math.ceil(bounds.w * PX)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'lighter'
  const red = (a: number) => `rgba(255,0,0,${Math.min(1, Math.max(0, a))})`

  for (const { x, z, r: rw, s } of rocks) {
    const cx = (x - bounds.x) * PX
    const cz = (z - bounds.y) * PX
    const r = rw * PX

    // Collar: centred a touch upstream (east) so the pile-up is on the side the
    // current hits.
    const col = g.createRadialGradient(cx + r * 0.2, cz, r * 0.6, cx + r * 0.2, cz, r * 1.55)
    col.addColorStop(0, red(s))
    col.addColorStop(0.5, red(0.85 * s))
    col.addColorStop(1, red(0))
    g.fillStyle = col
    g.beginPath()
    g.arc(cx + r * 0.2, cz, r * 1.55, 0, Math.PI * 2)
    g.fill()

    // Turbulent core trailing west, fading with distance.
    const len = r * (4.5 + 2 * s)
    const core = g.createLinearGradient(cx, 0, cx - len, 0)
    core.addColorStop(0, red(0.75 * s))
    core.addColorStop(1, red(0))
    g.fillStyle = core
    g.beginPath()
    g.ellipse(cx - len / 2, cz, len / 2, r * 0.7, 0, 0, Math.PI * 2)
    g.fill()

    // V-wake: two tapered arms peeling off the flanks and spreading downstream.
    const arm = len * 1.3
    const spread = Math.tan((17 * Math.PI) / 180) * arm
    for (const side of [-1, 1]) {
      const vg = g.createLinearGradient(cx, 0, cx - arm, 0)
      vg.addColorStop(0, red(0.7 * s))
      vg.addColorStop(1, red(0))
      g.fillStyle = vg
      g.beginPath()
      g.moveTo(cx + r * 0.2, cz + side * r * 0.75)
      g.lineTo(cx - arm, cz + side * (r * 0.9 + spread))
      g.lineTo(cx - r * 0.2, cz + side * r * 1.2)
      g.closePath()
      g.fill()
    }
  }

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.NoColorSpace
  t.flipY = false // canvas row 0 = minZ, matching the shader's uv
  t.minFilter = THREE.LinearFilter
  t.generateMipmaps = false
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
  return t
}

/** The session's river foam, once TownModel has built it (else null). */
export function getRiverFoam(): RiverFoam | null {
  return cached
}

/** Find the wet rocks and paint their foam mask (once per session). */
export function buildRiverFoam(scene: THREE.Object3D, river: THREE.Mesh): RiverFoam {
  if (cached) return cached
  river.geometry.computeBoundingBox()
  const bb = river.geometry.boundingBox!
  const bounds = new THREE.Vector4(bb.min.x, bb.min.z, bb.max.x - bb.min.x, bb.max.z - bb.min.z)
  const rocks = findWetRocks(scene, river)
  cached = { rocks, mask: paintMask(rocks, bounds), bounds }
  return cached
}
