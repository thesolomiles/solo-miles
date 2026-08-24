import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { captureDerivedColliders } from '../systems/colliders'
import { densifyForest } from '../systems/forest'
import { instanceScatter } from '../systems/instancing'
import { useTownGLTF } from './gltf'
import { useLighting } from '../state/lighting'

const URL = '/models/town.glb'

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

  // Stylized water. The Blender `Water` material exports as glTF transmission
  // (KHR_materials_transmission + IOR, roughness 0.04) — three.js renders that as
  // a MeshPhysicalMaterial doing screen-space refraction, which on a faceted,
  // double-sided, shadow-receiving low-poly mesh streaks with diagonal artifacts.
  // We replace it with a flat-shaded translucent surface: reads as low-poly water,
  // no refraction pass, no shadow acne. (This is the "water = a three.js job on
  // export" the art pass always intended.)
  const waterMat = useRef<THREE.MeshStandardMaterial | null>(null)
  if (!waterMat.current) {
    waterMat.current = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x3f86a3),
      roughness: 0.35,
      metalness: 0,
      flatShading: true,
      // Near-opaque: the water doesn't receive shadows, so its own lit blue
      // stays put — but if it were very translucent you'd see the shadowed dirt
      // bed through it (near-black under the bridge). A hint of translucency
      // keeps some depth without letting the bed's shadow bleed through.
      transparent: true,
      opacity: 0.93,
      // The water mesh's faces are wound downward (it exported doubleSided), so
      // rendering both sides is what keeps the top surface visible from above.
      side: THREE.DoubleSide,
    })
  }

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
        m.material = waterMat.current!
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
  }, [scene])

  return <primitive object={scene} scale={scale} />
}

useTownGLTF.preload(URL)
