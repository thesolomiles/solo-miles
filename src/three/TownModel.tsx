import { useEffect } from 'react'
import * as THREE from 'three'
import { useTownGLTF } from './gltf'

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
export function TownModel({ scale = 2 }: { scale?: number }) {
  const { scene } = useTownGLTF(URL)

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [scene])

  return <primitive object={scene} scale={scale} />
}

useTownGLTF.preload(URL)
