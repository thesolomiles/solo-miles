import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { captureDerivedColliders } from '../systems/colliders'
import { densifyForest } from '../systems/forest'
import { instanceScatter } from '../systems/instancing'
import { capturePineAsset } from './ride/pineAsset'
import { useTownGLTF } from './gltf'
import { useLighting } from '../state/lighting'
import { WORLD } from '../config/town'

const URL = '/models/town.glb'

/**
 * A tiny sky environment for the water to reflect. The scene has no env map, so a
 * water surface has nothing to mirror — it only shows the sun's direct specular,
 * which on gentle near-flat waves geometrically never bounces into our fixed 3/4
 * camera. We bake a small equirectangular sky (same gradient as SkyBackground)
 * plus a soft warm sun blob, and PMREM it. One small cubemap sampled per
 * fragment — no reflection render pass. Kept LDR on purpose: an HDR sun + bloom
 * turns the whole river into a white sheet under our grade.
 */
function makeSkyEnv(gl: THREE.WebGLRenderer): THREE.Texture {
  const w = 256
  const h = 128
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, WORLD.sky.top)
  grd.addColorStop(0.5, WORLD.sky.mid)
  grd.addColorStop(1, WORLD.sky.bottom)
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  // Sun blob a touch lower/brighter than the sky so facets can catch a glint
  // as they tilt — still LDR so bloom doesn't white-out the channel.
  const sun = g.createRadialGradient(w * 0.16, h * 0.28, 0, w * 0.16, h * 0.28, h * 0.36)
  sun.addColorStop(0, 'rgba(255,250,235,1)')
  sun.addColorStop(0.25, 'rgba(255,240,210,0.85)')
  sun.addColorStop(0.55, 'rgba(255,230,190,0.35)')
  sun.addColorStop(1, 'rgba(255,230,190,0)')
  g.fillStyle = sun
  g.fillRect(0, 0, w, h)

  const eq = new THREE.CanvasTexture(c)
  eq.colorSpace = THREE.SRGBColorSpace
  eq.mapping = THREE.EquirectangularReflectionMapping
  const pmrem = new THREE.PMREMGenerator(gl)
  const env = pmrem.fromEquirectangular(eq).texture
  eq.dispose()
  pmrem.dispose()
  return env
}

// The sky env-map and the water material are constants — same for the whole
// session — but TownModel UNMOUNTS every time you step into the café (and the
// arcade), so building them per mount allocated a fresh PMREM cubemap on every
// return to town and never freed the old one. Hold them at module scope so
// they're built once and simply re-used by each mount.
let skyEnv: THREE.Texture | null = null
let waterMaterial: THREE.MeshStandardMaterial | null = null
let waterShader: THREE.WebGLProgramParametersWithUniforms | null = null
// Bump when material params change so HMR can't keep a stale (e.g. Physical /
// HDR) instance alive in the module-scope cache.
const WATER_MAT_REV = 3
let waterMaterialRev = 0

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    waterMaterial?.dispose()
    skyEnv?.dispose()
    waterMaterial = null
    skyEnv = null
    waterShader = null
    waterMaterialRev = 0
  })
}

function getWaterMaterial(gl: THREE.WebGLRenderer): THREE.MeshStandardMaterial {
  if (waterMaterial && waterMaterialRev === WATER_MAT_REV) return waterMaterial
  waterMaterial?.dispose()
  skyEnv ??= makeSkyEnv(gl)
  const mat = new THREE.MeshStandardMaterial({
    // Deep enough that sky reflections read as luminous blue, not bloom-white
    // when the golden-hour env hits metalness. Near-opaque: full transparency
    // used to show the shadowed riverbed and kill the shine; a whisper of alpha
    // keeps a hint of depth without the matte look.
    color: new THREE.Color(0x2f6f8c),
    roughness: 0.22,
    metalness: 0.4,
    envMap: skyEnv,
    envMapIntensity: 1.15,
    flatShading: true,
    transparent: true,
    opacity: 0.97,
    // The water mesh's faces are wound downward (it exported doubleSided), so
    // rendering both sides is what keeps the top surface visible from above.
    side: THREE.DoubleSide,
  })
  // Keep the exported material's name: the mount pass below finds the river by
  // it, and on a remount the mesh is already carrying THIS material.
  mat.name = 'Water'
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    waterShader = shader
    // Layered sines: two scrolling along +X (the flow) at different scales, plus
    // a slower cross-chop along Z so it doesn't look like a moving corrugation.
    // A notch livelier than the first pass — still a calm channel, not an ocean.
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
           float wave = sin(transformed.x * 0.5 + uTime * 0.62) * 0.055
                      + sin(transformed.x * 1.15 - uTime * 0.88) * 0.022
                      + sin(transformed.z * 1.55 + uTime * 0.42) * 0.024
                      + sin(transformed.x * 2.6 + transformed.z * 1.9 + uTime * 1.05) * 0.014
                      + sin(transformed.x * 3.9 + transformed.z * 2.3 + uTime * 1.35) * 0.008;
           transformed.y += wave;`,
      )
  }
  waterMaterial = mat
  waterMaterialRev = WATER_MAT_REV
  if (import.meta.env?.DEV) {
    ;(window as unknown as { __waterMat?: THREE.MeshStandardMaterial }).__waterMat = mat
  }
  return mat
}

/**
 * Window glass. The Blender `Glass` material exports as a plain alpha-blended
 * tint; we swap it for a pale see-through pane that reflects the same baked sky
 * as the water (so it reads as glass, not a grey sheet) plus two soft diagonal
 * sheen bands baked into a tiny texture — the classic stylized "this is glass"
 * cue. Each pane is UV'd 0..1 in Blender so the bands sit across it. Behind every
 * pane is a small modelled room, which is what you see through it.
 */
let glassMaterial: THREE.MeshStandardMaterial | null = null
const GLASS_MAT_REV = 2
let glassMaterialRev = 0

/** Pane texture: `tint` fill with two diagonal sheen bands in `band`. */
function makePaneTexture(tint: string, band: string, band2: string): THREE.Texture {
  const s = 64
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = tint
  g.fillRect(0, 0, s, s)
  g.translate(s / 2, s / 2)
  g.rotate(-Math.PI / 4)
  g.fillStyle = band
  g.fillRect(-s, -s * 0.24, s * 2, s * 0.1)
  g.fillStyle = band2
  g.fillRect(-s, -s * 0.06, s * 2, s * 0.04)
  const t = new THREE.CanvasTexture(c)
  t.minFilter = THREE.LinearFilter
  return t
}

export function getGlassMaterial(gl: THREE.WebGLRenderer): THREE.MeshStandardMaterial {
  if (glassMaterial && glassMaterialRev === GLASS_MAT_REV) return glassMaterial
  glassMaterial?.dispose()
  skyEnv ??= makeSkyEnv(gl)
  const map = makePaneTexture('#c4e0ee', '#ffffff', '#f4fbff')
  map.colorSpace = THREE.SRGBColorSpace
  // alphaMap reads the green channel: a ~12% tint over the room behind, with the
  // sheen bands a little more opaque.
  const alphaMap = makePaneTexture('#1f1f1f', '#5c5c5c', '#454545')
  const mat = new THREE.MeshStandardMaterial({
    map,
    alphaMap,
    roughness: 0.08,
    metalness: 0.1,
    envMap: skyEnv,
    envMapIntensity: 0.5,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  mat.name = 'Glass'
  glassMaterial = mat
  glassMaterialRev = GLASS_MAT_REV
  return mat
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    glassMaterial?.dispose()
    glassMaterial = null
    glassMaterialRev = 0
  })
}

/**
 * The real town, modelled in Blender (flat low-poly) and exported to glTF —
 * ground tile, river, bridge, path, forest, and the café. This is the Phase-3
 * art drop-in that replaces the procedural greybox `Environment`.
 *
 * Blender is Z-up; the glTF export converts to three's Y-up, so the tile lands
 * on the ground plane with the forest to −Z (back) and the town to +Z (toward
 * the camera). `scale` sizes the 24-unit Blender tile into town space.
 */
export function TownModel({ scale = 1 }: { scale?: number }) {
  const { scene } = useTownGLTF(URL)
  const cafeGlow = useLighting((s) => s.cafeGlow)
  const houseGlow = useLighting((s) => s.houseGlow)
  // Remember each emissive material's exported intensity so the glow knobs are a
  // multiplier on the real baked value, not an absolute overwrite.
  const baseGlow = useRef(new Map<string, number>())

  // Scale the warm emission (lanterns, the little lamps inside the windows) by
  // the glow knob. Everything lit is `Material.004` (baked strength ~5). Only
  // emissive materials are touched — walls and ground (black emissive) stay put.
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial
        if (!std || !std.emissive) continue
        const lit = std.emissive.r + std.emissive.g + std.emissive.b > 0.001
        if (!lit) continue
        if (!baseGlow.current.has(std.uuid)) baseGlow.current.set(std.uuid, std.emissiveIntensity)
        const mult = std.name === 'HouseWindowsLit' ? houseGlow : cafeGlow
        std.emissiveIntensity = baseGlow.current.get(std.uuid)! * mult
      }
    })
  }, [scene, cafeGlow, houseGlow])

  // Stylized, flowing water. The Blender `Water` material exports as glTF
  // transmission (KHR_materials_transmission + IOR, roughness 0.04) — three.js
  // renders that as a MeshPhysicalMaterial doing screen-space refraction, which on
  // a faceted, double-sided, shadow-receiving low-poly mesh streaks with diagonal
  // artifacts. We replace it with a flat-shaded surface whose vertices ripple in
  // the vertex shader (a river flows E–W along the channel's long axis = world X,
  // so the waves scroll along +X). Because the mesh is flat-shaded, three derives
  // each facet's normal from the (now moving) positions, so the little triangles
  // tilt and catch the sun as they pass — that shimmer is what makes the water
  // both *move* and *reflect* instead of sitting as a dead blue slab. Pure vertex
  // work, no refraction/reflection render pass, so it's cheap and mobile-safe (no
  // EffectComposer involved). The `River` mesh is ~1040 verts — dense enough for
  // the ripples to read across the surface.
  const gl = useThree((s) => s.gl)
  const waterMat = getWaterMaterial(gl)
  const glassMat = getGlassMaterial(gl)

  // Drive the ripple clock. The uniform only exists once the material has
  // compiled (first render), so guard on the captured shader.
  useFrame((_, delta) => {
    if (waterShader) waterShader.uniforms.uTime.value += delta
  })

  useEffect(() => {
    // Fill the bare gaps in the forest first, so the clones get shadows below
    // and canopy colliders (they keep the Pine_/Round_ names the collider and
    // shadow passes key off).
    densifyForest(scene)
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = Array.isArray(m.material) ? m.material[0] : m.material
      // Water: swap in the stylized material and keep it out of the shadow pass.
      if (mat && (mat as THREE.Material).name === 'Water') {
        m.material = waterMat
        m.castShadow = false
        m.receiveShadow = false
        return
      }
      // Window glass: see-through, so it neither casts nor catches shadows.
      if (mat && (mat as THREE.Material).name === 'Glass') {
        m.material = glassMat
        m.castShadow = false
        m.receiveShadow = false
        return
      }
      m.castShadow = true
      m.receiveShadow = true
    })
    // Collision is hand-authored now (config/colliders.data.ts). Still derive the
    // building/tree boxes from the real geometry and stash them so the ?edit
    // collider editor can offer them as a seed — but don't apply them at runtime.
    captureDerivedColliders(scene)
    // Grab the pine geometry + material for the ride scene BEFORE instancing
    // detaches the named `Pine_*` meshes (three/ride/pineAsset.ts).
    capturePineAsset(scene)
    // Finally, batch the scattered props (trees/rocks/grass/bushes/stumps) into
    // instanced meshes — runs after colliders so those still read the named
    // geometry. Turns ~600 draw calls into a handful; authoring stays per-object.
    instanceScatter(scene)
  }, [scene, waterMat, glassMat])

  return <primitive object={scene} scale={scale} />
}

useTownGLTF.preload(URL)
