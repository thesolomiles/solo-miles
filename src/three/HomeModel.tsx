import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HOME } from '../config/home'
import { useTownGLTF } from './gltf'
import { getGlassMaterial } from './TownModel'

/**
 * Leonard's home interior (home.blend → public/models/home.glb), rendered in
 * place of the town while `interior === 'home'` (see three/Scene.tsx). The room
 * is exported as a single merged mesh on the shared palette material, so it's
 * one draw call; the TV screen and pendant bulb carry emissive swatches and
 * bloom through PostFX like the café's lit bits. The south window's panes are a
 * second mesh on the Blender `Glass` material, swapped for the town's shared
 * glass look (and kept out of the shadow pass so daylight comes through).
 * Plank tops sit at y=0, so no floor drop is needed (unlike the café).
 */
const SHADOW_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false })

export function HomeModel() {
  const { scene } = useTownGLTF(HOME.url)
  const gl = useThree((s) => s.gl)
  const glassMat = getGlassMaterial(gl)

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = Array.isArray(m.material) ? m.material[0] : m.material
      if (mat && (mat as THREE.Material).name === 'Glass') {
        m.material = glassMat
        m.castShadow = false
        m.receiveShadow = false
        return
      }
      // The window is cut away at ~0.9 m so it doesn't hide the lounge from the
      // camera; its full-height frame above the cut is exported as `HomeShadow`
      // and drawn invisibly — it only casts the sun's window-bar shadows.
      if (m.name === 'HomeShadow') {
        m.material = SHADOW_ONLY
        m.castShadow = true
        m.receiveShadow = false
        return
      }
      m.castShadow = true
      m.receiveShadow = true
    })
  }, [scene, glassMat])

  return <primitive object={scene} />
}

useTownGLTF.preload(HOME.url)
