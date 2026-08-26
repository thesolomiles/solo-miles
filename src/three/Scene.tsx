import { useEffect, useRef, type RefObject } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYER } from '../config/constants'
import { WORLD } from '../config/town'
import { InteractablesProvider, ProximitySystem, ZoneProximity } from '../systems/interactables'
import { ColliderDebug } from './ColliderDebug'
import { ColliderEditor, ColliderEditorFor } from './ColliderEditor'
import { useCafeColliderEdit } from '../state/cafeColliderEdit'
import { ZoneEditor, ZoneEditorFor } from './ZoneEditor'
import { useCafeZoneEdit } from '../state/cafeZoneEdit'
import { OrthoRig } from './OrthoRig'
import { Player } from './Player'
// import { Bgm } from './Bgm' // BGM disabled for now — see Scene render below
import { AmbientSound } from './AmbientSound'
import { TownModel } from './TownModel'
import { CafeModel } from './CafeModel'
import { CafeWorkers } from './actors/CafeWorker'
import { Patrons } from './actors/Patron'
import { CafeBgm } from './CafeBgm'
import { Interactions } from './Interactions'
import { Cat } from './actors/Cat'
// import { Rider } from './actors/Rider' // hidden for now — see Scene render below
import { Workers } from './actors/Worker'
import { PostFX } from './PostFX'
import { useLighting } from '../state/lighting'
import { usePerf } from '../state/perf'
import { useGame } from '../state/store'
import { setActiveWorld } from '../systems/activeWorld'
import { CAFE } from '../config/cafe'
import { PacmanWorld } from './arcade/PacmanWorld'

// Interiors sit in a dark surround (a single room floating in space would
// otherwise show the bright town sky around it). A warm near-black frames the
// café's wood + amber glow as "a room in the dark".
const INTERIOR_BG = new THREE.Color('#171009')

/** Scene background: the town's vertical gradient sky, or a dark surround while
 *  inside an interior (the café). */
function SkyBackground({ interior }: { interior: string | null }) {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    if (interior) {
      const prev = scene.background
      scene.background = INTERIOR_BG
      return () => {
        scene.background = prev
      }
    }
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
  }, [scene, interior])
  return null
}

// Direction the key sun sits relative to whatever it lights — fixed, so shadows
// always fall the same way (light stays parallel; only its shadow box moves).
// Lowered for golden hour: a lower sun rakes longer, warmer shadows across the
// ground (was y=30, a higher midday angle).
const SUN_OFFSET = new THREE.Vector3(26, 20, 15)

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
      color={0xffb066}
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

/**
 * Watches the `interior` flag and, on each town↔café transition, swaps the
 * active collision world and teleports the player to the right spawn (café
 * entrance carpet on the way in, town café-door on the way out). Skips the
 * initial mount so it never yanks the player off their town spawn on load.
 */
function InteriorController({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const interior = useGame((s) => s.interior)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (interior === 'cafe') {
      setActiveWorld('cafe')
      posRef.current.set(CAFE.spawn.x, 0, CAFE.spawn.z)
    } else {
      setActiveWorld('town')
      posRef.current.set(CAFE.townReturn.x, 0, CAFE.townReturn.z)
    }
  }, [interior, posRef])
  return null
}

// Café window positions in three-space, nudged just inside each pane (Blender
// Y-up export: +Y/north → −Z). A warm point light at each makes the windows
// actually cast light into the room, not merely glow.
const CAFE_WINDOW_LIGHTS: [number, number, number][] = [
  [-6.4, 2.0, -4.0], // left · north
  [-6.4, 2.0, 1.5], // left · south
  [6.4, 2.0, -4.0], // right · north
  [6.4, 2.0, 1.5], // right · south
]

/**
 * Lighting for the café interior — its own rig, independent of the town's sun.
 * The room is lit by warm daylight spilling in the four windows plus a low
 * ambient so nothing goes pitch-black; the emissive sconces / menu / arcade
 * screens add their own glow on top.
 */
function CafeLights() {
  return (
    <>
      <ambientLight intensity={0.35} color={'#ffe6c2'} />
      {/* A general overhead fill so the middle of the room isn't dark — a warm
          ceiling glow centred over the tables, independent of the town sun. */}
      <pointLight position={[0, 6.5, -0.5]} color={'#ffdcb0'} intensity={55} distance={26} decay={2} />
      {CAFE_WINDOW_LIGHTS.map((p, i) => (
        <pointLight
          key={i}
          position={p}
          color={'#ffd39a'}
          intensity={22}
          distance={18}
          decay={2}
        />
      ))}
    </>
  )
}

export function Scene() {
  // Shared player position: the controller writes it; the camera, the cyclist,
  // and the proximity system read it. Hot per-frame data stays out of React.
  const posRef = useRef(PLAYER.start.clone())
  const interior = useGame((s) => s.interior)
  const minigame = useGame((s) => s.minigame)
  const enclosed = interior !== null || minigame !== null

  // Dev-only handle (matches window.__ambient / __bgm): inspect/teleport the
  // player and poke game state from the console while iterating.
  useEffect(() => {
    if (import.meta.env?.DEV && typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).__solo = {
        game: useGame,
        pos: () => posRef.current,
        tp: (x: number, z: number) => posRef.current.set(x, 0, z),
      }
    }
  }, [])
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
  const haze = useLighting((s) => s.haze)

  // Atmospheric distance haze (golden hour): warm fog that fades the far scenery
  // into the sky, softening + slightly desaturating the distance while the
  // foreground stays crisp. The `haze` knob slides the fog band in/out — 0 pushes
  // it past the map (crisp), 1 pulls it close (thick). The player sits ~24u from
  // the camera, so `near` starts a touch beyond that and `far` reaches the reader.
  const fogNear = THREE.MathUtils.lerp(52, 22, haze)
  const fogFar = THREE.MathUtils.lerp(120, 52, haze)

  return (
    <InteractablesProvider>
      <SkyBackground interior={enclosed ? 'cafe' : null} />
      {!enclosed && <fog attach="fog" args={[WORLD.fog.color, fogNear, fogFar]} />}

      {/* Town rig (golden hour): a warm sky/ground ambient, a warm-amber key sun
          casting long soft shadows, and a dim COOL fill from the opposite side —
          the cool fill is deliberate: it tints the shadow sides blue against the
          warm sun for that late-afternoon warm/cool contrast. Gated OFF inside an
          interior — the café lights itself (CafeLights) so the sun never washes it. */}
      {!enclosed && (
        <>
          <hemisphereLight args={[0xf3e2c6, 0x6f5f42, hemisphere]} />
          <ambientLight intensity={ambient} color={0xffe9cf} />
          <SunRig posRef={posRef} />
          <directionalLight position={[-18, 14, -12]} intensity={fill} color={0xaecbe6} />
        </>
      )}
      {interior === 'cafe' && !minigame && <CafeLights />}

      {minigame === 'pacman' ? (
        <PacmanWorld />
      ) : interior === 'cafe' ? (
        <>
          <CafeModel />
          <CafeWorkers />
          <Patrons />
          {/* Café collision editor (?edit) — same draggable boxes as the town,
              driven by the café registry. */}
          {edit && <ColliderEditorFor store={useCafeColliderEdit} />}
          {zonesEdit && <ZoneEditorFor store={useCafeZoneEdit} />}
        </>
      ) : (
        <>
          {/* Phase 3: the real Blender-modelled town replaces the greybox
              Environment + Building meshes. */}
          <TownModel />
          {edit && <ColliderEditor />}
          {zonesEdit && <ZoneEditor />}
          {debug && !edit && <ColliderDebug boundary={WORLD.boundary} />}
          <Interactions />
          <Cat />
          {/* Cyclist Leonard hidden for now (ride-picker flow is built; re-enable
              when the ride UI/content is ready). */}
          {/* <Rider playerPos={posRef} /> */}
          <Workers />
        </>
      )}
      {(debug || edit) && <PerfProbe />}

      <InteriorController posRef={posRef} />
      {!minigame && <Player posRef={posRef} />}

      <OrthoRig posRef={posRef} />
      <ProximitySystem playerPos={posRef} />
      <ZoneProximity playerPos={posRef} />
      {/* BGM disabled for now (couldn't get the right feel — went with ambient
          environment sound instead). Re-enable by uncommenting the import + this
          line; the crossfade-on-bridge logic in three/Bgm.tsx is kept intact. */}
      {/* <Bgm playerPos={posRef} /> */}
      <AmbientSound playerPos={posRef} />
      <CafeBgm />

      <PostFX />
    </InteractablesProvider>
  )
}
