import * as THREE from 'three'
import { WORLD } from '../config/town'

/**
 * Densify the forest by cloning existing trees into the empty grass between
 * them. Runs on the loaded town.glb scene before colliders are built, so the
 * filler trees pick up canopy colliders for free (they keep the `Pine_`/`Round_`
 * names the collider system keys off). Purely additive scatter — the town core,
 * the path corridor, the river and the meadow right around the plaza stay open.
 *
 * Only pines and round trees are cloned; rocks aren't (repeated identical rocks
 * read as copies, repeated trees read as forest).
 */
const CLONE_RE = /^(Pine_|Round_)/

const BOUND = WORLD.boundary - 2 // keep fillers inside the roam square
const TOWN_CLEAR = 16 // leave the plaza / near-town meadow open
const PATH_HALF = 5 // keep the central north–south path corridor clear
const RIVER_Z = [-25, -11] as const // keep the river band clear
const PAD_CLEAR = 8 // keep clear around the four house/site pads
const PADS: [number, number][] = [
  [-22, -4],
  [22, -4],
  [-22, 20],
  [22, 20],
]

const MIN_GAP = 2.3 // min spacing between any two trees (avoids overlap/clumping)
const OFFSET = [2.6, 5.5] as const // how far a filler sits from its source tree
const TRIES = 4 // placement attempts per source tree
const MAX_ADD = 260 // cap, for perf and so it never turns into a solid slab

function blocked(x: number, z: number, taken: [number, number][]): boolean {
  if (Math.abs(x) > BOUND || Math.abs(z) > BOUND) return true
  if (Math.hypot(x, z) < TOWN_CLEAR) return true
  if (Math.abs(x) < PATH_HALF) return true
  if (z > RIVER_Z[0] && z < RIVER_Z[1]) return true
  for (const [px, pz] of PADS) if (Math.hypot(px - x, pz - z) < PAD_CLEAR) return true
  for (const [px, pz] of taken) {
    const dx = px - x
    const dz = pz - z
    if (dx * dx + dz * dz < MIN_GAP * MIN_GAP) return true
  }
  return false
}

/** True if an ancestor is also a clonable tree — i.e. this is a sub-mesh. */
function isSubTree(node: THREE.Object3D): boolean {
  for (let p = node.parent; p; p = p.parent) if (CLONE_RE.test(p.name)) return true
  return false
}

export function densifyForest(root: THREE.Object3D): { existing: number; added: number } {
  root.updateWorldMatrix(true, true)

  // Idempotent: drop a previous fill (StrictMode/HMR re-runs) before rebuilding.
  const prev = root.getObjectByName('ForestFill')
  if (prev) root.remove(prev)

  const sources: THREE.Object3D[] = []
  const taken: [number, number][] = []
  const wp = new THREE.Vector3()
  root.traverse((n) => {
    if (!CLONE_RE.test(n.name) || isSubTree(n)) return
    n.getWorldPosition(wp)
    taken.push([wp.x, wp.z])
    sources.push(n)
  })
  const existing = sources.length

  const group = new THREE.Group()
  group.name = 'ForestFill'
  const local = new THREE.Vector3()
  let added = 0

  for (const src of sources) {
    if (added >= MAX_ADD) break
    src.getWorldPosition(wp)
    if (Math.hypot(wp.x, wp.z) < TOWN_CLEAR) continue // don't seed from the town core
    for (let t = 0; t < TRIES; t++) {
      const ang = Math.random() * Math.PI * 2
      const r = OFFSET[0] + Math.random() * (OFFSET[1] - OFFSET[0])
      const x = wp.x + Math.cos(ang) * r
      const z = wp.z + Math.sin(ang) * r
      if (blocked(x, z, taken)) continue
      const clone = src.clone(true)
      local.set(x, 0, z)
      root.worldToLocal(local) // account for the scene's ×2 scale
      clone.position.x = local.x
      clone.position.z = local.z // keep the source's local y so it stays grounded
      clone.rotation.y = Math.random() * Math.PI * 2
      clone.scale.multiplyScalar(0.85 + Math.random() * 0.4)
      group.add(clone)
      taken.push([x, z])
      added++
      break // one filler per source per pass keeps the spread even
    }
  }

  root.add(group)
  return { existing, added }
}
