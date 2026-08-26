import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { captureDerivedColliders } from '../systems/colliders'
import { densifyForest } from '../systems/forest'
import { instanceScatter } from '../systems/instancing'
import { useTownGLTF } from './gltf'
import { useLighting } from '../state/lighting'
import { WORLD } from '../config/town'

const URL = '/models/town.glb'

/**
 * A tiny sky environment for the water to reflect. The scene has no env map, so a
 * MeshStandardMaterial water surface has nothing to mirror — it only shows the
 * sun's direct specular, which on gentle near-flat waves geometrically never
 * bounces into our fixed 3/4 camera (the highlight would need ~40° facet tilts).
 * So we bake a cheap equirectangular sky — the same top/mid/bottom gradient as
 * SkyBackground, plus a soft warm blob roughly where the key sun sits — and PMREM
 * it. Now the water reflects the bright sky (and that sun blob), and because the
 * flat-shaded facets ripple, the reflection shimmers and the sun-glint sweeps
 * across as waves pass. One small cubemap sampled per fragment — no render pass.
 */
function makeSkyEnv(gl: THREE.WebGLRenderer): THREE.Texture {
  const w = 256
  const h = 128
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, WORLD.sky.top) // zenith (top of the reflected sky)
  grd.addColorStop(0.5, WORLD.sky.mid)
  grd.addColorStop(1, WORLD.sky.bottom) // horizon/ground
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  // Soft sun blob in the upper sky — its reflection is the glint on the water.
  // Placed at the key sun's rough azimuth/elevation (SUN_OFFSET ≈ 24,30,16).
  const sun = g.createRadialGradient(w * 0.16, h * 0.22, 0, w * 0.16, h * 0.22, h * 0.32)
  sun.addColorStop(0, 'rgba(255,246,224,1)')
  sun.addColorStop(0.4, 'rgba(255,236,196,0.5)')
  sun.addColorStop(1, 'rgba(255,236,196,0)')
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

function getWaterMaterial(gl: THREE.WebGLRenderer): THREE.MeshStandardMaterial {
  if (waterMaterial) return waterMaterial
  skyEnv ??= makeSkyEnv(gl)
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x3f86a3),
    // The water reflects the baked sky env (makeSkyEnv). Low roughness keeps the
    // reflection + sun-glint fairly crisp; a chunk of metalness raises the
    // surface reflectivity so the sky actually reads on it at our ~48° view
    // angle (a pure dielectric only reflects strongly near grazing). This is
    // what fixes "the water doesn't reflect any light".
    roughness: 0.15,
    metalness: 0.5,
    envMap: skyEnv,
    envMapIntensity: 1.6,
    flatShading: true,
    // Near-opaque: the water doesn't receive shadows, so its own lit blue
    // stays put — but if it were very translucent you'd see the shadowed dirt
    // bed through it (near-black under the bridge). A hint of translucency
    // keeps some depth without letting the bed's shadow bleed through.
    transparent: true,
    opacity: 0.9,
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
    // Amplitudes are small (~0.06 total) — the channel is shallow and the effect
    // should read as a gentle current, not an ocean swell.
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
           // A calm, slow current — the "dangerous" chop was mostly SPEED, so the
           // uTime multipliers are small (a gentle drift, ~1u/s crests) and the
           // amplitudes low. Two slow swells scroll along +X (the flow) with a
           // slower Z cross-ripple; a small, slow fine term keeps a little life in
           // the reflection without the agitated flashing.
           float wave = sin(transformed.x * 0.45 + uTime * 0.5) * 0.042
                      + sin(transformed.x * 1.0 - uTime * 0.7) * 0.015
                      + sin(transformed.z * 1.4 + uTime * 0.35) * 0.016
                      + sin(transformed.x * 2.2 + transformed.z * 1.6 + uTime * 0.85) * 0.009;
           transformed.y += wave;`,
      )
  }
  waterMaterial = mat
  return mat
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

  // Scale each building's warm window emission by its own knob. The café glass
  // is `Material.004` (baked strength ~5); the house windows are
  // `HouseWindowsLit` (baked ~0.6). Only emissive materials are touched — walls
  // and ground (black emissive) stay put.
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
      m.castShadow = true
      m.receiveShadow = true
    })
    // Collision is hand-authored now (config/colliders.data.ts). Still derive the
    // building/tree boxes from the real geometry and stash them so the ?edit
    // collider editor can offer them as a seed — but don't apply them at runtime.
    captureDerivedColliders(scene)
    // Finally, batch the scattered props (trees/rocks/grass/bushes/stumps) into
    // instanced meshes — runs after colliders so those still read the named
    // geometry. Turns ~600 draw calls into a handful; authoring stays per-object.
    instanceScatter(scene)
  }, [scene, waterMat])

  return <primitive object={scene} scale={scale} />
}

useTownGLTF.preload(URL)
