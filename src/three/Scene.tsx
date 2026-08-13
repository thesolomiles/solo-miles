import { useEffect, useRef, type RefObject } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER } from '../config/constants'
import { WORLD } from '../config/town'
import { InteractablesProvider, ProximitySystem } from '../systems/interactables'
import { ColliderDebug } from './ColliderDebug'
import { OrthoRig } from './OrthoRig'
import { Player } from './Player'
import { TownModel } from './TownModel'
import { Interactions } from './Interactions'
import { Cat } from './actors/Cat'
import { Rider } from './actors/Rider'
import { Workers } from './actors/Worker'
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

// Direction the key sun sits relative to whatever it lights — fixed, so shadows
// always fall the same way (light stays parallel; only its shadow box moves).
const SUN_OFFSET = new THREE.Vector3(24, 30, 16)

/**
 * The warm key sun. Its shadow frustum FOLLOWS the player each frame instead of
 * blanketing the whole town, so the 2048² map's texels concentrate around the
 * character — a crisp shadow up close rather than a town-wide blur. The box
 * (±22) still reaches nearby buildings, which is all the follow-cam ever shows.
 */
function SunRig({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const light = useRef<THREE.DirectionalLight>(null!)
  useFrame(() => {
    const p = posRef.current
    light.current.position.set(p.x + SUN_OFFSET.x, SUN_OFFSET.y, p.z + SUN_OFFSET.z)
    light.current.target.position.set(p.x, 0, p.z)
    light.current.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      intensity={2.1}
      color={0xffe6bf}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-radius={3.5}
      shadow-blurSamples={16}
      shadow-camera-near={1}
      shadow-camera-far={90}
      shadow-camera-left={-22}
      shadow-camera-right={22}
      shadow-camera-top={22}
      shadow-camera-bottom={-22}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
    />
  )
}

export function Scene() {
  // Shared player position: the controller writes it; the camera, the cyclist,
  // and the proximity system read it. Hot per-frame data stays out of React.
  const posRef = useRef(PLAYER.start.clone())
  const debug =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

  return (
    <InteractablesProvider>
      <SkyBackground />
      <fog attach="fog" args={[WORLD.fog.color, WORLD.fog.near, WORLD.fog.far]} />

      {/* Phase 2 warm rig: cool sky/ground ambient, a warm key sun casting soft
          shadows, and a dim cool fill from the opposite side to shape forms. */}
      <hemisphereLight args={[0xdcebf2, 0x6b7350, 0.55]} />
      <ambientLight intensity={0.12} color={0xfff2e0} />
      <SunRig posRef={posRef} />
      <directionalLight position={[-18, 14, -12]} intensity={0.35} color={0xbcd4e6} />

      {/* Phase 3: the real Blender-modelled town replaces the greybox
          Environment + Building meshes. Interactables/labels rewire per
          building once all four are modelled. */}
      <TownModel />
      {debug && <ColliderDebug boundary={WORLD.boundary} />}
      <Interactions />

      <Cat />
      <Rider playerPos={posRef} />
      <Workers />
      <Player posRef={posRef} />

      <OrthoRig posRef={posRef} />
      <ProximitySystem playerPos={posRef} />

      <PostFX />
    </InteractablesProvider>
  )
}
