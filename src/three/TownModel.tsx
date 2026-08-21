import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { buildSceneColliders, setSceneColliders } from '../systems/colliders'
import { densifyForest } from '../systems/forest'
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

  useEffect(() => {
    // Fill the bare gaps in the forest first, so the clones get shadows below
    // and canopy colliders (they keep the Pine_/Round_ names the collider and
    // shadow passes key off).
    densifyForest(scene)
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    // Derive colliders (buildings + trees) from the real geometry now the model
    // is in the scene graph (so world matrices reflect its placement + scale).
    setSceneColliders(buildSceneColliders(scene))
  }, [scene])

  return <primitive object={scene} scale={scale} />
}

useTownGLTF.preload(URL)
