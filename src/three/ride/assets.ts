import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from './motion'
import { RIDE_COLORS } from '../../config/ride'

/**
 * Reusable low-poly asset library for the ride scene (and the asset-gallery page).
 * Each generator returns a plain THREE.BufferGeometry pivoted to the ground, so it
 * can be instanced into a scrolling field or dropped into a viewer. Keep new
 * assets here so both the scene and the gallery pick them up from one place.
 */

/** Paint every vertex of a geometry one flat colour, so merged parts can carry a
 *  per-part colour under a single vertex-coloured material. */
export function tinted(g: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  // Normalise to non-indexed so parts of a tree (indexed cones/cylinders and
  // non-indexed icospheres) share a layout and can be merged together.
  const geo = g.index ? g.toNonIndexed() : g
  const c = new THREE.Color(color)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

// --- Trees: one East-Asian family --------------------------------------------
// Every tree is built from the same small grammar so they read as one set:
//  · a tapered trunk in a shared warm-brown bark palette,
//  · flat-shaded foliage from two primitives — cones (conifer spires) and faceted
//    blobs (pine pads + broadleaf canopies),
//  · each foliage part shaded a touch darker toward the base for depth.
// Variety comes from the SILHOUETTE (spire / pads / canopy), not from random
// tweaks — so a sugi, a matsu and a keyaki plainly belong together.

/** Shared bark tones — one warm-brown family for every trunk. */
const BARK = { red: 0x7a4b2b, brown: 0x664527, grey: 0x6a5a49 }

type TreeForm = 'spire' | 'pine' | 'pads' | 'canopy'

export interface TreeSpec {
  id: string
  name: string
  form: TreeForm
  bark: number
  /** Base foliage colour; parts darken toward the trunk. */
  green: number
  /** Clear trunk height before the foliage starts. */
  trunkH: number
  trunkR: number
  /** Overall foliage height above the trunk. */
  crownH: number
  /** Foliage half-width. */
  crownR: number
  /** Cone tiers / pads / canopy blobs. */
  layers: number
}

/** A tapered trunk pivoted to the ground. */
function makeTrunk(h: number, r: number, color: number): THREE.BufferGeometry {
  const t = new THREE.CylinderGeometry(r * 0.6, r, h, 6)
  t.translate(0, h / 2, 0)
  return tinted(t, color)
}

/** A faceted foliage blob (low-poly icosphere), squashable into a flat pad. */
function makeBlob(r: number, squashY: number): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(r, 0).scale(1, squashY, 1)
}

/** base·(0.78→1.06) darker at the crown's foot, lighter toward its top. */
function shadeAt(base: THREE.Color, t: number): THREE.Color {
  return base.clone().multiplyScalar(0.78 + t * 0.28)
}

/** A stable per-spec seed so a tree's organic jitter is deterministic (every
 *  instance of a variant shares one geometry, but variants differ from each other). */
function specSeed(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A dense conifer spire (sugi / hinoki): stacked cones narrowing to a point. The
 *  tiers are jittered — width, height, lift, a random yaw and a slight tilt/nudge —
 *  so the crown reads as organic foliage, not a perfectly concentric stack of cones. */
function buildSpire(spec: TreeSpec): THREE.BufferGeometry[] {
  const parts = [makeTrunk(spec.trunkH, spec.trunkR, spec.bark)]
  const base = new THREE.Color(spec.green)
  const rand = mulberry32(specSeed(spec.id))
  const n = spec.layers
  const foot = spec.trunkH * 0.55 // overlap the foliage down over the trunk top
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const r = spec.crownR * (1 - t * 0.72) * (0.84 + rand() * 0.3) // jittered width
    const h = (spec.crownH / n) * 2.0 * (0.82 + rand() * 0.34) // jittered height
    const y = foot + (spec.crownH - h) * (i / n) + (rand() - 0.5) * spec.crownH * 0.07
    const cone = new THREE.ConeGeometry(r, h, 7)
    cone.rotateY(rand() * Math.PI * 2) // spin so facets never line up tier-to-tier
    cone.rotateZ((rand() - 0.5) * 0.16) // slight lean
    cone.rotateX((rand() - 0.5) * 0.16)
    const off = spec.crownR * 0.14
    cone.translate((rand() - 0.5) * off, y + h / 2, (rand() - 0.5) * off)
    parts.push(tinted(cone, shadeAt(base, t)))
  }
  return parts
}

/** A classic conifer — a short clear trunk under 2–3 distinct stacked cones, the
 *  iconic low-poly pine. The cones overlap as layered skirts (not the dense fused
 *  spire), with just a touch of yaw so it isn't machine-perfect. */
function buildPine(spec: TreeSpec): THREE.BufferGeometry[] {
  const parts = [makeTrunk(spec.trunkH, spec.trunkR, spec.bark)]
  const base = new THREE.Color(spec.green)
  const rand = mulberry32(specSeed(spec.id))
  const n = spec.layers
  const step = spec.crownH / n
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const r = spec.crownR * (1 - t * 0.5) * (0.93 + rand() * 0.14)
    const h = step * 1.6 // taller than the step → tiers overlap as layered skirts
    const y = spec.trunkH * 0.8 + i * step
    const cone = new THREE.ConeGeometry(r, h, 7)
    cone.rotateY(rand() * Math.PI * 2)
    cone.translate(0, y + h / 2, 0)
    parts.push(tinted(cone, shadeAt(base, t)))
  }
  return parts
}

/** Layered foliage pads on a taller clear trunk — the niwaki matsu silhouette. */
function buildPads(spec: TreeSpec): THREE.BufferGeometry[] {
  const parts = [makeTrunk(spec.trunkH, spec.trunkR, spec.bark)]
  const base = new THREE.Color(spec.green)
  const n = spec.layers
  const foot = spec.trunkH * 0.7
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const r = spec.crownR * (1 - t * 0.34)
    const pad = makeBlob(r, 0.52) // a little more domed so pads read as soft pine tiers
    // stagger the pads a little so the tiers read as an irregular cloud-pruned pine
    const off = (i % 2 === 0 ? 1 : -1) * spec.crownR * 0.22
    pad.translate(off, foot + (spec.crownH * t), off * 0.5)
    parts.push(tinted(pad, shadeAt(base, t)))
  }
  return parts
}

/** A rounded broadleaf canopy — a cluster of blobs on a visible trunk (keyaki / momiji). */
function buildCanopy(spec: TreeSpec): THREE.BufferGeometry[] {
  const parts = [makeTrunk(spec.trunkH, spec.trunkR, spec.bark)]
  const base = new THREE.Color(spec.green)
  const cy = spec.trunkH + spec.crownH * 0.42
  // a crown blob on top, a ring of blobs around the middle
  const crown = makeBlob(spec.crownR * 0.78, 0.92)
  crown.translate(0, cy + spec.crownH * 0.22, 0)
  parts.push(tinted(crown, shadeAt(base, 1)))
  const ring = spec.layers
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + 0.4
    const r = spec.crownR * 0.62
    const blob = makeBlob(r, 0.88)
    blob.translate(Math.cos(a) * spec.crownR * 0.52, cy - spec.crownH * 0.06, Math.sin(a) * spec.crownR * 0.52)
    parts.push(tinted(blob, shadeAt(base, 0.35 + (i % 2) * 0.25)))
  }
  return parts
}

/** Build one tree geometry from its spec — flat-shaded, vertex-coloured, pivoted
 *  to the ground, ready to instance or drop into the gallery. */
export function makeTree(spec: TreeSpec): THREE.BufferGeometry {
  const parts =
    spec.form === 'spire'
      ? buildSpire(spec)
      : spec.form === 'pine'
        ? buildPine(spec)
        : spec.form === 'pads'
          ? buildPads(spec)
          : buildCanopy(spec)
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

/** The East-Asian roadside tree set — cedars, pines and broadleaves that share a
 *  visual language but each carry a distinct silhouette. */
export const TREE_SPECS: TreeSpec[] = [
  { id: 'cedar', name: 'Japanese cedar', form: 'spire', bark: BARK.red, green: 0x486a3c,
    trunkH: 0.6, trunkR: 0.16, crownH: 3.1, crownR: 1.25, layers: 6 },
  { id: 'hinoki', name: 'Hinoki cypress', form: 'spire', bark: BARK.brown, green: 0x577544,
    trunkH: 0.5, trunkR: 0.16, crownH: 2.7, crownR: 1.45, layers: 6 },
  { id: 'pine', name: 'Pine', form: 'pine', bark: BARK.brown, green: 0x40693a,
    trunkH: 0.75, trunkR: 0.14, crownH: 2.8, crownR: 1.3, layers: 3 },
  { id: 'red-pine', name: 'Red pine', form: 'pads', bark: BARK.red, green: 0x627a3a,
    trunkH: 1.35, trunkR: 0.16, crownH: 1.8, crownR: 1.45, layers: 3 },
  { id: 'black-pine', name: 'Black pine', form: 'pads', bark: BARK.grey, green: 0x3c5836,
    trunkH: 1.6, trunkR: 0.17, crownH: 2.4, crownR: 1.55, layers: 4 },
  { id: 'zelkova', name: 'Zelkova', form: 'canopy', bark: BARK.grey, green: 0x5c7d3e,
    trunkH: 1.55, trunkR: 0.18, crownH: 2.5, crownR: 1.75, layers: 5 },
  { id: 'maple', name: 'Japanese maple', form: 'canopy', bark: BARK.brown, green: 0xb0563a,
    trunkH: 1.0, trunkR: 0.14, crownH: 1.7, crownR: 1.4, layers: 5 },
]

// --- Undergrowth --------------------------------------------------------------

/** A low-poly grass tuft — a few flat blades fanned out from the base. */
export function makeGrassTuft(): THREE.BufferGeometry {
  const rand = mulberry32(0x9a55)
  const blades: THREE.BufferGeometry[] = []
  for (let i = 0; i < 5; i++) {
    const h = 0.38 + rand() * 0.28
    const b = new THREE.ConeGeometry(0.045, h, 3)
    b.translate(0, h / 2, 0)
    b.rotateZ((rand() - 0.5) * 0.6)
    b.rotateY(rand() * Math.PI * 2)
    b.translate((rand() - 0.5) * 0.28, 0, (rand() - 0.5) * 0.28)
    blades.push(b)
  }
  return mergeGeometries(blades, false)!
}

/** A low rounded shrub — a couple of clustered flat-shaded icospheres. */
export function makeShrub(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const add = (r: number, x: number, y: number, z: number) => {
    const s = new THREE.IcosahedronGeometry(r, 1)
    s.translate(x, y, z)
    parts.push(s)
  }
  add(0.5, 0, 0.42, 0)
  add(0.34, 0.34, 0.3, 0.06)
  add(0.32, -0.3, 0.32, -0.08)
  return mergeGeometries(parts, false)!
}

/** A tapered limb spanning two points, base radius `r0` → tip radius `r1`. Used to
 *  grow branches so every segment is anchored to its parent (no floating pieces). */
function makeLimb(from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(to, from)
  const len = dir.length()
  const g = new THREE.CylinderGeometry(r1, r0, len, 4)
  g.translate(0, len / 2, 0) // base at origin, growing +Y
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_UP, dir.normalize()))
  g.translate(from.x, from.y, from.z)
  return g
}
const _UP = new THREE.Vector3(0, 1, 0)

/** A bare, weathered dead tree — a tapered trunk with a few angular leafless
 *  branches (and the odd fork), each grown from a point on its parent so nothing
 *  floats. Randomised per `seed` so variants differ. */
export function makeDeadTree(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed)
  const parts: THREE.BufferGeometry[] = []
  const H = 2.2 + rand() * 1.4
  // a trunk that leans slightly; the crown top is where the highest branches meet
  const top = new THREE.Vector3((rand() - 0.5) * 0.5, H, (rand() - 0.5) * 0.5)
  parts.push(makeLimb(new THREE.Vector3(0, 0, 0), top, 0.19, 0.05))
  const nb = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < nb; i++) {
    const t = 0.4 + rand() * 0.55 // fraction up the trunk (embedded root → no gap)
    const base = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), top, t)
    const az = rand() * Math.PI * 2
    const elev = 0.55 + rand() * 0.55 // upward tilt
    const len = 0.5 + rand() * 1.0
    const reach = new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev))
    const end = base.clone().addScaledVector(reach, len)
    parts.push(makeLimb(base, end, 0.06, 0.02))
    if (rand() < 0.6) {
      // a fork springing from partway along the branch, toward a fresh tip
      const mid = base.clone().lerp(end, 0.55)
      const az2 = az + (rand() - 0.5) * 1.4
      const elev2 = 0.7 + rand() * 0.4
      const len2 = 0.3 + rand() * 0.5
      const reach2 = new THREE.Vector3(Math.cos(az2) * Math.cos(elev2), Math.sin(elev2), Math.sin(az2) * Math.cos(elev2))
      parts.push(makeLimb(mid, mid.clone().addScaledVector(reach2, len2), 0.03, 0.015))
    }
  }
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

/** A faceted boulder, pivoted to sit on the ground. */
export function makeRock(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(1, 0).translate(0, 0.4, 0)
}

/** A chunk of black volcanic basalt (Jeju hyeonmuam): a craggy dark rock pitted
 *  with vesicle pores. The icosphere is indexed first so each corner is displaced
 *  once (watertight) — most pushed out for a jagged crag, some pushed deep in to
 *  form pores — then split into flat faces mottled in near-black tones (the darker
 *  facets read as pore shadows). Randomised per `seed`. */
export function makeVolcanicRock(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed)
  const ico = mergeVertices(new THREE.IcosahedronGeometry(1, 2)) // indexed → shared corners
  const pos = ico.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    let r = 0.84 + rand() * 0.3 // jagged crag
    if (rand() < 0.16) r *= 0.55 // a deep vesicle pore
    v.copy(n).multiplyScalar(r)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  const g = ico.toNonIndexed() // split for flat shading + per-face colour
  ico.dispose()
  const cp = g.attributes.position.count
  const colors = new Float32Array(cp * 3)
  const base = new THREE.Color(0x2b292d)
  const pore = new THREE.Color(0x131215)
  for (let f = 0; f < cp; f += 3) {
    const c = rand() < 0.3 ? pore : base.clone().multiplyScalar(0.82 + rand() * 0.4)
    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3] = c.r
      colors[(f + k) * 3 + 1] = c.g
      colors[(f + k) * 3 + 2] = c.b
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeVertexNormals()
  g.computeBoundingBox()
  g.translate(0, -g.boundingBox!.min.y, 0) // rest base on the ground
  return g
}

// --- Farmland ----------------------------------------------------------------
// Self-contained field plots for the East-Asian roadside — each a small square
// tile (soil/water base + planting) that reads on its own and can be repeated
// into a larger field. Same flat-shaded, vertex-coloured grammar as the trees.

/** A flooded rice paddy: a wet plot ringed by a low earthen bund, planted with a
 *  grid of bright young rice shoots. */
export function makeRicePaddy(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const S = 3.2
  parts.push(tinted(new THREE.BoxGeometry(S, 0.08, S).translate(0, 0.05, 0), 0x5f9b86)) // wet mud/water
  const half = S / 2, t = 0.2, H = 0.18, bund = 0x6d5236
  const bar = (w: number, d: number, x: number, z: number) =>
    parts.push(tinted(new THREE.BoxGeometry(w, H, d).translate(x, H / 2, z), bund))
  bar(t, S + t, half, 0); bar(t, S + t, -half, 0) // side bunds
  bar(S + t, t, 0, half); bar(S + t, t, 0, -half) // end bunds
  const green = new THREE.Color(0x8ac850)
  const rows = 6, cols = 8, m = S * 0.78
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const shoot = new THREE.ConeGeometry(0.075, 0.36, 4)
      shoot.translate(0, 0.18, 0)
      shoot.translate(-m / 2 + ((c + 0.5) / cols) * m, 0.08, -m / 2 + ((r + 0.5) / rows) * m)
      parts.push(tinted(shoot, green.clone().multiplyScalar(r % 2 ? 0.9 : 1)))
    }
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

/** A tea plantation: neat parallel rows of clipped rounded hedges on dark soil —
 *  the classic terraced-hillside tea look. */
export function makeTeaPlantation(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const S = 3.4
  parts.push(tinted(new THREE.BoxGeometry(S, 0.08, S).translate(0, 0.04, 0), 0x5b4632)) // soil
  const rows = 5, tea = new THREE.Color(0x4f7d3c), rr = 0.3, len = S * 0.94
  for (let i = 0; i < rows; i++) {
    const x = -S / 2 + ((i + 0.5) / rows) * S
    const hedge = new THREE.CylinderGeometry(rr, rr, len, 6)
    hedge.rotateX(Math.PI / 2) // lay the hedge along z (rows recede toward the road)
    hedge.translate(x, rr * 0.72, 0)
    parts.push(tinted(hedge, tea.clone().multiplyScalar(i % 2 ? 0.9 : 1)))
  }
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

/** A vegetable field: raised soil ridges lined with leafy crop clumps. */
export function makeCrops(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const S = 3.2
  parts.push(tinted(new THREE.BoxGeometry(S, 0.08, S).translate(0, 0.04, 0), 0x6b4f34)) // field soil
  const rows = 5, perRow = 6, leaf = new THREE.Color(0x77b23f), zLen = S * 0.9
  for (let i = 0; i < rows; i++) {
    const x = -S / 2 + ((i + 0.5) / rows) * S
    parts.push(tinted(new THREE.BoxGeometry(0.32, 0.12, zLen).translate(x, 0.1, 0), 0x7a5c3d)) // ridge
    for (let j = 0; j < perRow; j++) {
      const clump = makeBlob(0.2, 0.72)
      clump.translate(x, 0.22, -zLen / 2 + ((j + 0.5) / perRow) * zLen)
      parts.push(tinted(clump, leaf.clone().multiplyScalar(j % 2 ? 1 : 0.88)))
    }
  }
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

// --- Roadside: lit street furniture ------------------------------------------
// Poles and housings are matte (vertex-coloured, like everything else); the
// glowing parts — the lamp and the signal lenses — come back as a SEPARATE
// geometry meant for an unlit (MeshBasic) material, so they read as
// self-illuminated. Emissive is the sanctioned exception to the single
// flat-shaded material (a shader need, like Glass/Water and the town's lit windows).

/** An asset whose glow is a separate mesh: `body` (matte) + `lit` (unlit/emissive). */
export interface LitAsset {
  body: THREE.BufferGeometry
  lit: THREE.BufferGeometry
}

const METAL = 0x3b3f45
const METAL_DARK = 0x2a2c30

/** A cobra-head street lamp: a tapered pole, a curved arm reaching over the road,
 *  and a lamp head with a warm glowing underside. */
export function makeStreetLamp(): LitAsset {
  const body: THREE.BufferGeometry[] = []
  const lit: THREE.BufferGeometry[] = []
  body.push(tinted(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 8).translate(0, 0.15, 0), METAL_DARK)) // footing
  const poleH = 4.2
  body.push(tinted(new THREE.CylinderGeometry(0.1, 0.16, poleH, 8).translate(0, poleH / 2, 0), METAL)) // pole
  // a curved arm arcing over toward +x, in short segments
  let px = 0, py = poleH, ang = 0
  for (let i = 0; i < 5; i++) {
    ang += 0.34
    const nx = px + Math.sin(ang) * 0.42
    const ny = py + Math.cos(ang) * 0.42
    body.push(tinted(makeLimb(new THREE.Vector3(px, py, 0), new THREE.Vector3(nx, ny, 0), 0.08, 0.07), METAL))
    px = nx; py = ny
  }
  body.push(tinted(new THREE.BoxGeometry(0.6, 0.22, 0.36).translate(px + 0.16, py - 0.02, 0), METAL_DARK)) // lamp head
  lit.push(tinted(new THREE.BoxGeometry(0.46, 0.07, 0.26).translate(px + 0.16, py - 0.14, 0), 0xffd98a)) // glowing underside
  const b = mergeGeometries(body, false)!
  b.computeVertexNormals()
  return { body: b, lit: mergeGeometries(lit, false)! }
}

/** A traffic signal: a pole topped with a three-lens head (red / amber / green),
 *  each lens a glowing disc under a dark hood. */
export function makeTrafficLight(): LitAsset {
  const body: THREE.BufferGeometry[] = []
  const lit: THREE.BufferGeometry[] = []
  body.push(tinted(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 8).translate(0, 0.15, 0), METAL_DARK)) // footing
  const poleH = 3.4
  body.push(tinted(new THREE.CylinderGeometry(0.09, 0.13, poleH, 8).translate(0, poleH / 2, 0), METAL)) // pole
  const hy = poleH - 0.1
  body.push(tinted(new THREE.BoxGeometry(0.5, 1.4, 0.34).translate(0, hy, 0), METAL_DARK)) // signal housing
  const lensZ = 0.17 + 0.03
  const lens = (y: number, color: number) => {
    const l = new THREE.CylinderGeometry(0.15, 0.15, 0.08, 12).rotateX(Math.PI / 2) // disc facing +z
    l.translate(0, y, lensZ)
    lit.push(tinted(l, color))
    body.push(tinted(new THREE.BoxGeometry(0.38, 0.06, 0.18).translate(0, y + 0.18, lensZ + 0.01), METAL_DARK)) // hood
  }
  lens(hy + 0.42, 0xff3b30) // red (top)
  lens(hy, 0xffb02e) // amber
  lens(hy - 0.42, 0x34c759) // green (bottom)
  const b = mergeGeometries(body, false)!
  b.computeVertexNormals()
  return { body: b, lit: mergeGeometries(lit, false)! }
}

const STREET_LAMP = makeStreetLamp()
const TRAFFIC_LIGHT = makeTrafficLight()

// --- Catalog ------------------------------------------------------------------
// One entry per reusable asset; the asset-gallery page renders straight off this,
// so adding an asset here makes it appear in the gallery. `vertexColors` assets
// carry their own per-part colours (the conifers); the rest take a flat `color`.
// `emissive` assets also carry a glow mesh rendered unlit (lamps, signals).

export interface RideAsset {
  id: string
  name: string
  category: 'Trees' | 'Farmland' | 'Roadside' | 'Ground & Rock'
  geometry: () => THREE.BufferGeometry
  /** Optional glow mesh (vertex-coloured), rendered unlit so it reads as lit. */
  emissive?: () => THREE.BufferGeometry
  color?: number
  vertexColors?: boolean
  note?: string
}

export const RIDE_ASSETS: RideAsset[] = [
  ...TREE_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    category: 'Trees' as const,
    geometry: () => makeTree(spec),
    vertexColors: true,
  })),
  { id: 'dead-1', name: 'Dead tree', category: 'Trees', geometry: () => makeDeadTree(0xd1a), color: 0x6f6151 },
  { id: 'dead-2', name: 'Dead tree (bare)', category: 'Trees', geometry: () => makeDeadTree(0xd2b), color: 0x7d6c54 },
  { id: 'rice-field', name: 'Rice paddy', category: 'Farmland', geometry: makeRicePaddy, vertexColors: true },
  { id: 'plantation', name: 'Tea plantation', category: 'Farmland', geometry: makeTeaPlantation, vertexColors: true },
  { id: 'crops', name: 'Crop rows', category: 'Farmland', geometry: makeCrops, vertexColors: true },
  { id: 'street-lamp', name: 'Street lamp', category: 'Roadside', geometry: () => STREET_LAMP.body, emissive: () => STREET_LAMP.lit, vertexColors: true },
  { id: 'traffic-light', name: 'Traffic light', category: 'Roadside', geometry: () => TRAFFIC_LIGHT.body, emissive: () => TRAFFIC_LIGHT.lit, vertexColors: true },
  { id: 'shrub', name: 'Shrub', category: 'Ground & Rock', geometry: makeShrub, color: RIDE_COLORS.shrub },
  { id: 'grass', name: 'Grass tuft', category: 'Ground & Rock', geometry: makeGrassTuft, color: RIDE_COLORS.grassBlade },
  { id: 'rock', name: 'Boulder', category: 'Ground & Rock', geometry: makeRock, color: RIDE_COLORS.rock },
  { id: 'volcanic-1', name: 'Volcanic rock', category: 'Ground & Rock', geometry: () => makeVolcanicRock(0x7a1), vertexColors: true },
  { id: 'volcanic-2', name: 'Volcanic rock (craggy)', category: 'Ground & Rock', geometry: () => makeVolcanicRock(0x7b2), vertexColors: true },
]
