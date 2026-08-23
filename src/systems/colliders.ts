import * as THREE from 'three'
import { WORLD, type BoxCollider, type Collider } from '../config/town'
import { MANUAL_COLLIDERS } from '../config/colliders.data'

/**
 * Collision is HAND-AUTHORED. The live registry the Player reads every frame is
 * the hand-drawn box set (config/colliders.data.ts), editable live in-browser
 * with `?edit` (see three/ColliderEditor.tsx). A `?edit` session persists its
 * work-in-progress to localStorage, which overrides the committed defaults so
 * edits survive a reload until they're exported back into the data file.
 *
 * The auto-derivation below (buildings + trees, boxed from the real town.glb
 * geometry) is kept ONLY as a seed source: the editor can pull it in as a
 * starting point via `derivedColliders`. It is no longer applied at runtime.
 */

const STORAGE_KEY = 'solomiles.manualColliders'

/** Load the hand-authored set: a live `?edit` draft in localStorage wins over
 *  the committed defaults, so in-browser edits survive reloads until exported. */
function loadManual(): BoxCollider[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as BoxCollider[]
    } catch {
      /* corrupt draft — fall back to the committed defaults */
    }
  }
  return MANUAL_COLLIDERS.map((b) => ({ ...b }))
}

// Top-level GLB group names whose walls block. Add a name here when its house is
// built, and drop the matching SITE_COLLIDERS entries at the same time.
// (The current town.glb names its structures Building / Garage / Cube; the old
// Home / Cafe names are kept in case an earlier export is loaded — a name that
// matches nothing just yields no box.)
const SOLID_GROUPS = ['Home', 'Cafe', 'Building', 'Garage', 'Cube']

// A mesh joins a building's footprint only if it is rooted to the ground (base
// near y=0) AND rises to roughly head height — i.e. a wall or post. This drops
// the floating roof/awning/sign and the low deck, steps, shrubs, chairs and
// sidewalk signs parented into the same group, all of which read as walkable.
// World-space (post the town's ×2 scale); walls sit at y≈0.7 and rise past 4,
// furniture and signs top out around 1.5, so the gate separates the two cleanly.
const GROUNDED_MAX_Y = 0.75
const TALL_MIN_Y = 2.0

// Grow each wall footprint outward by a small standoff so the player stops just
// shy of the wall instead of clipping into it. Far smaller than the old circle's
// overshoot, so corners stay tight.
const BUILDING_PAD = 0.35

// Node-name prefixes for the solid scatter (pines, tree stumps). `PineTree`
// covers both the tall pines and the short `PineTree_s*` variants; `Stump`
// covers the south-field stumps. River rocks sit inside the water collider and
// river grass / bushes are walkable ground cover, so neither gets a box. The
// old Pine_ / Round_ / Rock_ prefixes are retained harmlessly for older exports.
const TREE_PREFIXES = ['Pine_', 'Round_', 'Rock_', 'PineTree', 'Stump']

// Canopy boxes are generous; keep only the inner part of each so the sparse
// pointy tips don't block, and the player can tuck right up against the foliage.
const TREE_SHRINK = 0.72

// Box every tree/rock the player can reach (the whole square roam area, plus a
// margin so ones straddling the edge still block). The forest is now what
// contains the player, so it all needs colliders — a few hundred cheap boxes.
const TREE_REACH = WORLD.boundary + 2

/**
 * Live collider registry the Player reads every frame. Starts from the
 * hand-authored set (localStorage draft, else the committed defaults). Mutated
 * in place so the Player never needs to re-subscribe. The editor drives it via
 * setManualColliders on every change, so collision updates as you drag.
 */
export const colliders: Collider[] = [...loadManual()]

/**
 * Replace the whole live registry with a hand-authored box set and persist it as
 * the `?edit` draft. Called by the collider editor on every add/move/delete, so
 * you can walk into a box the moment you place it.
 */
export function setManualColliders(boxes: BoxCollider[]) {
  colliders.length = 0
  colliders.push(...boxes.map((b) => ({ ...b })))
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes))
    } catch {
      /* storage full / disabled — the in-memory registry still updates */
    }
  }
}

/**
 * The auto-derived boxes from the last town.glb load, captured by TownModel and
 * kept ONLY so the editor's "Seed from town.glb" button can offer them as a
 * starting point. Not applied to the live registry (collision is hand-authored).
 */
export let derivedColliders: BoxCollider[] = []

/** Called by TownModel once the model is in the scene graph. */
export function captureDerivedColliders(root: THREE.Object3D) {
  derivedColliders = buildSceneColliders(root)
}

const _box = new THREE.Box3()
const _mesh = new THREE.Box3()
const _center = new THREE.Vector3()
const _size = new THREE.Vector3()

/** Footprint box for a building group: the union of its grounded, tall walls. */
function buildingBox(group: THREE.Object3D): BoxCollider | null {
  _box.makeEmpty()
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    _mesh.setFromObject(mesh)
    if (_mesh.min.y <= GROUNDED_MAX_Y && _mesh.max.y >= TALL_MIN_Y) _box.union(_mesh)
  })
  if (_box.isEmpty()) return null
  return {
    minX: _box.min.x - BUILDING_PAD,
    maxX: _box.max.x + BUILDING_PAD,
    minZ: _box.min.z - BUILDING_PAD,
    maxZ: _box.max.z + BUILDING_PAD,
  }
}

/** Canopy box for a tree/rock: its full XZ extent, shrunk toward the centre. */
function treeBox(node: THREE.Object3D): BoxCollider | null {
  _box.setFromObject(node)
  if (_box.isEmpty()) return null
  _box.getCenter(_center)
  // Square reach, matching the square roam area — includes the corner forest.
  if (Math.abs(_center.x) > TREE_REACH || Math.abs(_center.z) > TREE_REACH) return null
  _box.getSize(_size)
  const hx = (_size.x / 2) * TREE_SHRINK
  const hz = (_size.z / 2) * TREE_SHRINK
  return {
    minX: _center.x - hx,
    maxX: _center.x + hx,
    minZ: _center.z - hz,
    maxZ: _center.z + hz,
  }
}

/**
 * Scan a loaded town.glb scene and return every derived box: one per building,
 * one per in-range tree/rock. World-space, so it already accounts for the
 * model's scale and placement.
 */
const isBuilding = (name: string) => SOLID_GROUPS.includes(name)
const isTree = (name: string) => TREE_PREFIXES.some((p) => name.startsWith(p))

/** True if an ancestor already matched — so this is a sub-mesh, not its own tree. */
function insideMatched(node: THREE.Object3D): boolean {
  for (let p = node.parent; p; p = p.parent) {
    if (isBuilding(p.name) || isTree(p.name)) return true
  }
  return false
}

export function buildSceneColliders(root: THREE.Object3D): BoxCollider[] {
  root.updateWorldMatrix(true, true)
  const out: BoxCollider[] = []
  root.traverse((node) => {
    // One box per tree/building: skip sub-meshes whose parent tree/group already
    // matched (setFromObject on the topmost node already covers the whole thing).
    if (insideMatched(node)) return
    if (isBuilding(node.name)) {
      const box = buildingBox(node)
      if (box) out.push(box)
    } else if (isTree(node.name)) {
      const box = treeBox(node)
      if (box) out.push(box)
    }
  })
  return out
}
