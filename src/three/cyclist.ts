import { useMemo } from 'react'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from './gltf'

/**
 * Shared loader for the kitted road cyclist (cyclist.glb) — used both by the
 * parked Leonard at the end of the town road and by the two riders in the ride
 * scene. It clones the model per instance (independent skeletons/materials) and:
 *
 *  - swaps the wheels' `TronGlow` rim material for a vivid unlit emissive so the
 *    scene's Bloom pass haloes it (desktop; mobile shows it bright but un-haloed);
 *  - optionally recolours the rider's kit. The whole rider shares ONE Imphenzia
 *    palette material (colour = which swatch each face's UVs land on), so a kit
 *    variant is done by cloning the albedo texture and repainting the two swatches
 *    the jersey and helmet use — no re-export. Because the jersey shares its blue
 *    swatch with the gloves and the helmet shares its white swatch with the
 *    socks/shoes, a recolour reads as a coherent alternate kit.
 */

export const CYCLIST_MODEL = '/models/cyclist.glb'
// The Tron wheel glow is rendered here in three.js (emissive + the scene's Bloom
// pass), so the colour is themeable without re-exporting the model.
export const TRON_GLOW = { color: '#12e6ff', intensity: 12 }
// cyclist.glb is authored ~true-size; match the town figure's footprint (0.9 =
// RiggedFigure's SCALE) so the rider is the same size in the town and the ride.
export const CYCLIST_SCALE = 0.9

/** A recoloured kit: hex sRGB strings the jersey and helmet swatches become. */
export type CyclistKit = { jersey: string; helmet: string }

// The exact sRGB swatch colours the baked jersey and helmet faces sample, found
// once from the decoded model (Draco, so it can't be read offline). Keyed "r,g,b".
type Swatches = { jersey: string; helmet: string }
let swatchCache: Swatches | null | undefined // undefined = not tried, null = failed

function findChar(scene: THREE.Object3D): { char?: THREE.Mesh; map?: THREE.Texture } {
  // The rider is the only skinned mesh (the bike parts are rigid), so match on
  // that rather than the node name — three sanitises "Cyclist Char" on import.
  let char: THREE.Mesh | undefined
  let map: THREE.Texture | undefined
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (m.isSkinnedMesh) {
      char = m
      const mm = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial
      if (mm?.map) map = mm.map
    }
  })
  return { char, map }
}

/**
 * Sample the char's UVs against the palette to learn which swatch the jersey
 * (central chest) and the helmet (crown) use. POSITION is the bind (standing)
 * pose, so "top of the mesh = helmet" and "central mid-upper = jersey" hold even
 * though the rider is posed seated at runtime.
 */
function detectSwatches(scene: THREE.Object3D): Swatches | null {
  if (swatchCache !== undefined) return swatchCache
  swatchCache = null
  const { char, map } = findChar(scene)
  const img = map?.image as CanvasImageSource | undefined
  const pos = char?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
  const uv = char?.geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
  if (!img || !pos || !uv) return swatchCache
  const W = (img as HTMLImageElement).width || (img as ImageBitmap).width
  const H = (img as HTMLImageElement).height || (img as ImageBitmap).height
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) return swatchCache
  ctx.drawImage(img, 0, 0, W, H)
  const data = ctx.getImageData(0, 0, W, H).data
  const flip = map!.flipY
  const sample = (u: number, v: number) => {
    const uu = u - Math.floor(u)
    const vv = v - Math.floor(v)
    let px = Math.floor(uu * W)
    let py = Math.floor((flip ? 1 - vv : vv) * H)
    px = Math.min(W - 1, Math.max(0, px))
    py = Math.min(H - 1, Math.max(0, py))
    const i = (py * W + px) * 4
    return data[i] + ',' + data[i + 1] + ',' + data[i + 2]
  }
  let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity
  const n = pos.count
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i), x = pos.getX(i)
    if (y < ymin) ymin = y
    if (y > ymax) ymax = y
    if (x < xmin) xmin = x
    if (x > xmax) xmax = x
  }
  const h = ymax - ymin
  const xc = (xmin + xmax) / 2
  const xspan = xmax - xmin || 1
  const top: Record<string, number> = {}
  const torso: Record<string, number> = {}
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i), x = pos.getX(i)
    const key = sample(uv.getX(i), uv.getY(i))
    if (y > ymin + 0.86 * h) top[key] = (top[key] || 0) + 1
    if (y > ymin + 0.5 * h && y < ymin + 0.72 * h && Math.abs(x - xc) < 0.16 * xspan)
      torso[key] = (torso[key] || 0) + 1
  }
  const mode = (c: Record<string, number>) => Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0]
  const jersey = mode(torso)
  const helmet = mode(top)
  if (jersey && helmet) swatchCache = { jersey, helmet }
  return swatchCache
}

const hexBytes = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

// One recoloured texture per kit, reused across remounts.
const texCache = new Map<string, THREE.Texture>()

function recolouredTexture(base: THREE.Texture, remap: { from: string; to: string }[]): THREE.Texture {
  const key = remap.map((r) => r.from + '=>' + r.to).join('|')
  const cached = texCache.get(key)
  if (cached) return cached
  const img = base.image as CanvasImageSource
  const W = (img as HTMLImageElement).width || (img as ImageBitmap).width
  const H = (img as HTMLImageElement).height || (img as ImageBitmap).height
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, W, H)
  const id = ctx.getImageData(0, 0, W, H)
  const d = id.data
  const rules = remap.map((r) => ({ from: r.from.split(',').map(Number), to: hexBytes(r.to) }))
  for (let i = 0; i < d.length; i += 4) {
    for (const rule of rules) {
      if (d[i] === rule.from[0] && d[i + 1] === rule.from[1] && d[i + 2] === rule.from[2]) {
        d[i] = rule.to[0]
        d[i + 1] = rule.to[1]
        d[i + 2] = rule.to[2]
        break
      }
    }
  }
  ctx.putImageData(id, 0, 0)
  const tex = new THREE.CanvasTexture(cv)
  tex.flipY = base.flipY
  tex.colorSpace = base.colorSpace
  tex.wrapS = base.wrapS
  tex.wrapT = base.wrapT
  tex.needsUpdate = true
  texCache.set(key, tex)
  return tex
}

/**
 * Load + clone the cyclist, apply the Tron glow, and (if `kit` is given) recolour
 * the jersey + helmet. Returns the prepared model and its animation clips; the
 * caller wires `useAnimations` and decides whether to play or pause `cycle`.
 */
export function useCyclistModel(kit?: CyclistKit) {
  const { scene, animations } = useTownGLTF(CYCLIST_MODEL)
  const model = useMemo(() => skeletonClone(scene), [scene])

  useMemo(() => {
    const sw = kit ? detectSwatches(scene) : null
    let recoloured: THREE.Texture | null = null
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      mats.forEach((mm, i) => {
        const std = mm as THREE.MeshStandardMaterial
        if (std?.name === 'TronGlow') {
          const glow = std.clone() as THREE.MeshStandardMaterial
          glow.emissive = new THREE.Color(TRON_GLOW.color)
          glow.emissiveIntensity = TRON_GLOW.intensity
          glow.color = new THREE.Color(0x000000)
          glow.toneMapped = false // keep the glow vivid so Bloom catches it
          if (Array.isArray(m.material)) m.material[i] = glow
          else m.material = glow
          m.castShadow = false
          return
        }
        if (kit && sw && std?.name === 'Material' && std.map) {
          if (!recoloured) {
            recoloured = recolouredTexture(std.map, [
              { from: sw.jersey, to: kit.jersey },
              { from: sw.helmet, to: kit.helmet },
            ])
          }
          const cm = std.clone() as THREE.MeshStandardMaterial
          cm.map = recoloured
          if (Array.isArray(m.material)) m.material[i] = cm
          else m.material = cm
        }
      })
    })
  }, [model, scene, kit])

  return { model, animations }
}

// Preload so the town homepage (parked Leonard) and the ride both have it ready.
useTownGLTF.preload(CYCLIST_MODEL)
