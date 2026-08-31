import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

// --- Conifers -----------------------------------------------------------------

export interface PineSpec {
  trunkH: number
  trunkR: number
  trunk: number
  sides: number
  foliage: number
  /** Stacked foliage cones: radius, height, base-y. */
  tiers: { r: number; h: number; y: number }[]
}

/** A stacked-cone conifer built from one spec: a tapered trunk plus foliage tiers,
 *  each tier a hair darker toward the base for depth. Flat-shaded, vertex-coloured. */
export function makePine(spec: PineSpec): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(spec.trunkR * 0.8, spec.trunkR, spec.trunkH, 5)
  trunk.translate(0, spec.trunkH / 2, 0)
  parts.push(tinted(trunk, spec.trunk))
  const base = new THREE.Color(spec.foliage)
  spec.tiers.forEach((t, i) => {
    const cone = new THREE.ConeGeometry(t.r, t.h, spec.sides)
    cone.translate(0, t.y + t.h / 2, 0)
    const shade = 0.82 + (i / Math.max(1, spec.tiers.length - 1)) * 0.28
    parts.push(tinted(cone, base.clone().multiplyScalar(shade)))
  })
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

/** Five distinct pine silhouettes — spruce, fir, tall pine, young sapling, bushy —
 *  in a spread of greens, so the roadside reads as a real mixed forest. */
export const PINE_SPECS: PineSpec[] = [
  // tall narrow spruce
  { trunkH: 0.5, trunkR: 0.13, trunk: 0x6b4a2f, sides: 6, foliage: 0x3c5a2b,
    tiers: [{ r: 1.3, h: 1.2, y: 0.4 }, { r: 1.02, h: 1.15, y: 1.2 }, { r: 0.74, h: 1.1, y: 2.0 }, { r: 0.46, h: 1.0, y: 2.75 }] },
  // broad fir
  { trunkH: 0.42, trunkR: 0.15, trunk: 0x6e4c30, sides: 7, foliage: 0x50702f,
    tiers: [{ r: 1.7, h: 1.35, y: 0.35 }, { r: 1.24, h: 1.3, y: 1.25 }, { r: 0.72, h: 1.25, y: 2.15 }] },
  // tall pine on a bare trunk
  { trunkH: 1.0, trunkR: 0.13, trunk: 0x5f4029, sides: 6, foliage: 0x35563a,
    tiers: [{ r: 1.05, h: 1.5, y: 0.9 }, { r: 0.82, h: 1.45, y: 1.9 }, { r: 0.5, h: 1.3, y: 2.85 }] },
  // young sapling
  { trunkH: 0.3, trunkR: 0.1, trunk: 0x6b4a2f, sides: 6, foliage: 0x6b8f3f,
    tiers: [{ r: 0.9, h: 1.05, y: 0.25 }, { r: 0.56, h: 0.95, y: 1.0 }] },
  // squat bushy pine
  { trunkH: 0.35, trunkR: 0.14, trunk: 0x6e4c30, sides: 7, foliage: 0x466b34,
    tiers: [{ r: 1.5, h: 1.5, y: 0.3 }, { r: 1.02, h: 1.35, y: 1.3 }] },
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

/** A bare, weathered dead tree — a tapered trunk with a few angular leafless
 *  branches (and the odd fork). Randomised per `seed` so variants differ. */
export function makeDeadTree(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed)
  const parts: THREE.BufferGeometry[] = []
  const H = 2.2 + rand() * 1.4
  const trunk = new THREE.CylinderGeometry(0.08, 0.19, H, 5)
  trunk.translate(0, H / 2, 0)
  parts.push(trunk)
  const nb = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < nb; i++) {
    const by = H * (0.42 + rand() * 0.5)
    const len = 0.5 + rand() * 1.1
    const branch = new THREE.CylinderGeometry(0.025, 0.07, len, 4)
    branch.translate(0, len / 2, 0)
    branch.rotateZ((0.6 + rand() * 0.7) * (rand() < 0.5 ? -1 : 1))
    branch.rotateY(rand() * Math.PI * 2)
    branch.translate(0, by, 0)
    parts.push(branch)
    if (rand() < 0.5) {
      const len2 = 0.3 + rand() * 0.5
      const fork = new THREE.CylinderGeometry(0.02, 0.045, len2, 4)
      fork.translate(0, len2 / 2, 0)
      fork.rotateZ((0.5 + rand() * 0.6) * (rand() < 0.5 ? -1 : 1))
      fork.rotateY(rand() * Math.PI * 2)
      fork.translate((rand() - 0.5) * len, by + len * 0.55, (rand() - 0.5) * len)
      parts.push(fork)
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

// --- Catalog ------------------------------------------------------------------
// One entry per reusable asset; the asset-gallery page renders straight off this,
// so adding an asset here makes it appear in the gallery. `vertexColors` assets
// carry their own per-part colours (the conifers); the rest take a flat `color`.

export interface RideAsset {
  id: string
  name: string
  category: 'Trees' | 'Ground & Rock'
  geometry: () => THREE.BufferGeometry
  color?: number
  vertexColors?: boolean
  note?: string
}

export const RIDE_ASSETS: RideAsset[] = [
  ...PINE_SPECS.map((spec, i) => ({
    id: `pine-${i}`,
    name: ['Spruce', 'Fir', 'Tall pine', 'Sapling', 'Bushy pine'][i] ?? `Pine ${i}`,
    category: 'Trees' as const,
    geometry: () => makePine(spec),
    vertexColors: true,
  })),
  { id: 'dead-1', name: 'Dead tree', category: 'Trees', geometry: () => makeDeadTree(0xd1a), color: 0x6f6151 },
  { id: 'dead-2', name: 'Dead tree (bare)', category: 'Trees', geometry: () => makeDeadTree(0xd2b), color: 0x7d6c54 },
  { id: 'shrub', name: 'Shrub', category: 'Ground & Rock', geometry: makeShrub, color: RIDE_COLORS.shrub },
  { id: 'grass', name: 'Grass tuft', category: 'Ground & Rock', geometry: makeGrassTuft, color: RIDE_COLORS.grassBlade },
  { id: 'rock', name: 'Boulder', category: 'Ground & Rock', geometry: makeRock, color: RIDE_COLORS.rock },
]
