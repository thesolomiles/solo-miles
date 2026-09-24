import { useEffect } from 'react'
import * as THREE from 'three'
import { HOME } from '../config/home'
import { useTownGLTF } from './gltf'

/**
 * Leonard's home interior (home.blend → public/models/home.glb), rendered in
 * place of the town while `interior === 'home'` (see three/Scene.tsx). The room
 * is exported as a single merged mesh on the shared palette material, so it's
 * one draw call; the TV screen and pendant bulb carry emissive swatches and
 * bloom through PostFX like the café's lit bits. Plank tops sit at y=0, so no
 * floor drop is needed (unlike the café).
 */
export function HomeModel() {
  const { scene } = useTownGLTF(HOME.url)

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

useTownGLTF.preload(HOME.url)
