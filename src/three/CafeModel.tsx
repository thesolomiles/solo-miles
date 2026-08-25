import { useEffect } from 'react'
import * as THREE from 'three'
import { CAFE } from '../config/cafe'
import { useTownGLTF } from './gltf'

/**
 * The café interior, modelled in Blender (cafe.blend → public/models/cafe.glb)
 * on the shared Imphenzia palette material. Rendered in place of the town while
 * `interior === 'cafe'` (see three/Scene.tsx). Much simpler than TownModel: no
 * forest, water, or instancing — just enable shadows. The emissive swatches
 * (window panes, wall sconces, arcade screens, coffee-machine buttons, menu
 * title) carry their baked emission strength through the glTF, so they glow and
 * bloom through PostFX exactly like the town's lit windows.
 */
export function CafeModel() {
  const { scene } = useTownGLTF(CAFE.url)

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
    })
  }, [scene])

  return <primitive object={scene} />
}

useTownGLTF.preload(CAFE.url)
