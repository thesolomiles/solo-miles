import { useEffect, useRef, type RefObject } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER } from '../config/constants'
import { WORLD } from '../config/town'
import { InteractablesProvider, ProximitySystem, ZoneProximity } from '../systems/interactables'
import { ColliderDebug } from './ColliderDebug'
import { ColliderEditor } from './ColliderEditor'
import { ZoneEditor } from './ZoneEditor'
import { OrthoRig } from './OrthoRig'
import { Player } from './Player'
// import { Bgm } from './Bgm' // BGM disabled for now — see Scene render below
import { AmbientSound } from './AmbientSound'
import { TownModel } from './TownModel'
import { Interactions } from './Interactions'
import { Cat } from './actors/Cat'
// import { Rider } from './actors/Rider' // hidden for now — see Scene render below
import { Workers } from './actors/Worker'
import { PostFX } from './PostFX'
import { useLighting } from '../state/lighting'
import { usePerf } from '../state/perf'

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
  const intensity = useLighting((s) => s.sunIntensity)
  const shadowRadius = useLighting((s) => s.shadowRadius)
  useFrame(() => {
    const p = posRef.current
    light.current.position.set(p.x + SUN_OFFSET.x, SUN_OFFSET.y, p.z + SUN_OFFSET.z)
    light.current.target.position.set(p.x, 0, p.z)
    light.current.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      intensity={intensity}
      color={0xffd9a0}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-radius={shadowRadius}
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

/**
 * Debug-only: sample the renderer's per-frame stats (draw calls, triangles) and
 * a smoothed FPS into the perf store, ~4×/sec, for the HUD. `gl.info` resets
 * each frame; read in useFrame it reflects the frame just drawn.
 */
function PerfProbe() {
  const gl = useThree((s) => s.gl)
  const set = usePerf((s) => s.set)
  const acc = useRef({ t: 0, fps: 60 })
  // The scene renders through PostFX's composer (several passes/frame). three
  // auto-resets `info` at each render() call, so by useFrame we'd only see the
  // final composite pass. Turn auto-reset off and reset once per frame ourselves
  // so the count reflects a whole frame (scene + post).
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])
  useFrame((_, dt) => {
    const a = acc.current
    // At useFrame time `info` holds the previous frame's full accumulation.
    const calls = gl.info.render.calls
    const tris = gl.info.render.triangles
    gl.info.reset()
    a.fps = a.fps * 0.9 + (1 / Math.max(dt, 1e-4)) * 0.1
    a.t += dt
    if (a.t >= 0.25) {
      set({ calls, tris, fps: Math.round(a.fps) })
      a.t = 0
    }
  })
  return null
}

export function Scene() {
  // Shared player position: the controller writes it; the camera, the cyclist,
  // and the proximity system read it. Hot per-frame data stays out of React.
  const posRef = useRef(PLAYER.start.clone())
  const params =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined
  const debug = !!params?.has('debug')
  // `?edit` opens the hand-authored collision editor (draggable boxes) instead
  // of the static red debug slabs. See three/ColliderEditor + ui panel.
  const edit = !!params?.has('edit')
  // `?zones` opens the interaction-zone editor (named "door" boxes, blue).
  const zonesEdit = !!params?.has('zones')

  const hemisphere = useLighting((s) => s.hemisphere)
  const ambient = useLighting((s) => s.ambient)
  const fill = useLighting((s) => s.fill)

  return (
    <InteractablesProvider>
      <SkyBackground />
      <fog attach="fog" args={[WORLD.fog.color, WORLD.fog.near, WORLD.fog.far]} />

      {/* Phase 2 warm rig: cool sky/ground ambient, a warm key sun casting soft
          shadows, and a dim cool fill from the opposite side to shape forms. */}
      {/* Moody rig: less flat fill so shadows go deep, a strong warm key.
          Intensities come from the lighting store (tunable via ?debug panel). */}
      <hemisphereLight args={[0xdcebf2, 0x6b7350, hemisphere]} />
      <ambientLight intensity={ambient} color={0xfff2e0} />
      <SunRig posRef={posRef} />
      <directionalLight position={[-18, 14, -12]} intensity={fill} color={0xbcd4e6} />

      {/* Phase 3: the real Blender-modelled town replaces the greybox
          Environment + Building meshes. Interactables/labels rewire per
          building once all four are modelled. */}
      <TownModel />
      {edit && <ColliderEditor />}
      {zonesEdit && <ZoneEditor />}
      {debug && !edit && <ColliderDebug boundary={WORLD.boundary} />}
      {(debug || edit) && <PerfProbe />}
      <Interactions />

      <Cat />
      {/* Cyclist Leonard hidden for now (ride-picker flow is built; re-enable when
          the ride UI/content is ready). Un-rendering also drops his interactable. */}
      {/* <Rider playerPos={posRef} /> */}
      <Workers />
      <Player posRef={posRef} />

      <OrthoRig posRef={posRef} />
      <ProximitySystem playerPos={posRef} />
      <ZoneProximity playerPos={posRef} />
      {/* BGM disabled for now (couldn't get the right feel — went with ambient
          environment sound instead). Re-enable by uncommenting the import + this
          line; the crossfade-on-bridge logic in three/Bgm.tsx is kept intact. */}
      {/* <Bgm playerPos={posRef} /> */}
      <AmbientSound playerPos={posRef} />

      <PostFX />
    </InteractablesProvider>
  )
}
