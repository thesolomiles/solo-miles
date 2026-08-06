import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER } from '../config/constants'
import { BUILDINGS, WORLD } from '../config/town'
import { InteractablesProvider, ProximitySystem } from '../systems/interactables'
import { OrthoRig } from './OrthoRig'
import { Player } from './Player'
import { Environment } from './Environment'
import { Building } from './Building'
import { Cat } from './actors/Cat'
import { Rider } from './actors/Rider'
import { PostFX } from './PostFX'

/** Vertical gradient sky as the scene background (prototype look). */
function SkyBackground() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 256
    const g = c.getContext('2d')!
    const grd = g.createLinearGradient(0, 0, 0, 256)
    grd.addColorStop(0, WORLD.sky.top)
    grd.addColorStop(0.55, WORLD.sky.mid)
    grd.addColorStop(1, WORLD.sky.bottom)
    g.fillStyle = grd
    g.fillRect(0, 0, 8, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const prev = scene.background
    scene.background = tex
    return () => {
      scene.background = prev
      tex.dispose()
    }
  }, [scene])
  return null
}

export function Scene() {
  // Shared player position: the controller writes it; the camera, the cyclist,
  // and the proximity system read it. Hot per-frame data stays out of React.
  const posRef = useRef(PLAYER.start.clone())

  return (
    <InteractablesProvider>
      <SkyBackground />
      <fog attach="fog" args={[WORLD.fog.color, WORLD.fog.near, WORLD.fog.far]} />

      {/* Phase 2 warm rig: cool sky/ground ambient, a warm key sun casting soft
          shadows, and a dim cool fill from the opposite side to shape forms. */}
      <hemisphereLight args={[0xdcebf2, 0x6b7350, 0.55]} />
      <ambientLight intensity={0.12} color={0xfff2e0} />
      <directionalLight
        position={[24, 30, 16]}
        intensity={2.1}
        color={0xffe6bf}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={7}
        shadow-blurSamples={16}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-18, 14, -12]} intensity={0.35} color={0xbcd4e6} />

      <Environment />
      {BUILDINGS.map((b) => (
        <Building key={b.id} def={b} />
      ))}

      <Cat />
      <Rider playerPos={posRef} />
      <Player posRef={posRef} />

      <OrthoRig posRef={posRef} />
      <ProximitySystem playerPos={posRef} />

      <PostFX />
    </InteractablesProvider>
  )
}
