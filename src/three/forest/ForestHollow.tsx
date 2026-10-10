import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { FOREST_OPENING } from '../../config/forestOpening'
import { useTownGLTF } from '../gltf'
import { paint } from './paint'

/** Authored erosion around the fixed walking shelf; no camera/parallax offset. */
export function ForestHollow() {
  const { scene } = useTownGLTF('/models/forest-hollow.glb')
  const asset = useMemo(() => {
    const root = scene.clone(true)
    const materials = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>()
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return
      const source = object.material as THREE.MeshStandardMaterial
      let material = materials.get(source)
      if (!material) {
        // Preserve every palette region, adding the forest's broad brush texture
        // and depth haze without painting grassy flowers onto exposed soil.
        material = paint(source.clone(), 'earth')
        material.flatShading = true
        material.roughness = 1
        material.side = THREE.DoubleSide
        materials.set(source, material)
      }
      object.material = material
      object.castShadow = object.name !== 'HollowFloor'
      object.receiveShadow = true
    })
    return { root, materials }
  }, [scene])
  useEffect(() => () => {
    for (const material of asset.materials.values()) material.dispose()
  }, [asset])
  const gap = FOREST_OPENING.gap
  return (
    <group position={[(gap.left + gap.right) / 2, 0, 0]}>
      <primitive object={asset.root} dispose={null} />
      {/* Diffuse daylight reaches the exposed banks below the canopy. */}
      <pointLight position={[0, 2.2, 3.5]} color="#f1d5a5" intensity={45} distance={12} decay={2} />
    </group>
  )
}
