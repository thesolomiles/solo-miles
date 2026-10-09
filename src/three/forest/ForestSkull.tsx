import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { FOREST_ENCOUNTER as E } from '../../config/forestEncounter'
import { useTownGLTF } from '../gltf'
import { paint } from './paint'

/** Loaded on forest entry; the cached GLB and palette textures stay unmodified. */
export function ForestSkull({ onReady }: { onReady: (ready: boolean) => void }) {
  const { scene } = useTownGLTF('/models/forest-skull.glb')
  const asset = useMemo(() => {
    const root = scene.clone(true)
    const materials = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>()
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const prepare = (source: THREE.MeshStandardMaterial) => {
        let owned = materials.get(source)
        if (!owned) {
          owned = paint(source.clone(), 'bone')
          owned.flatShading = true
          owned.roughness = 0.94
          materials.set(source, owned)
        }
        return owned
      }
      object.material = Array.isArray(object.material)
        ? object.material.map(prepare)
        : prepare(object.material)
      object.castShadow = true
      object.receiveShadow = true
    })
    return { root, materials }
  }, [scene])

  useEffect(() => {
    onReady(true)
    return () => {
      for (const material of asset.materials.values()) material.dispose()
    }
  }, [asset, onReady])

  return (
    <group position={[E.landmarkX, 0, E.landmarkZ]}>
      <primitive object={asset.root} dispose={null} />
      {/* Soft clearing bounce, fixed in the world for both camera views. */}
      <pointLight position={[-4, 9, 9]} color="#ffe4b0" intensity={160} distance={23} decay={2} />
    </group>
  )
}
