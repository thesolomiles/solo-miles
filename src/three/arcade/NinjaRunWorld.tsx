import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame, type ThreeElements } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { NINJA_ENEMY, NINJA_NIGHT, NINJA_OBSTACLES, NINJA_RUN as N } from '../../config/arcade'
import {
  createNinjaRun,
  ninjaScore,
  stepNinjaRun,
  type NinjaState,
  type NinjaThing,
} from '../../arcade/ninjarun'
import { ninjaInput } from '../../systems/input'
import { useGame } from '../../state/store'
import { haloTexture, NinjaEye, NinjaNight, NinjaScenery, NinjaSky } from './ninjaScenery'
import { playNinjaSfx, setNinjaAmbiencePaused, startNinjaAmbience, type NinjaSound } from './ninjaSfx'
import { hullGeometry, outlineMaterial, withRim } from './rimMaterial'

/**
 * Ninja Run. The runner is the town character, standing at x = 0 facing +X; the
 * sim in arcade/ninjarun.ts scrolls rocks, logs, stumps and rival ninjas toward
 * him. The night bamboo grove around them lives in ./ninjaScenery.
 */

const MODEL = '/models/character.glb'
const FADE = 0.12
// Ground speed the ninja-run clip depicts at timeScale 1 (RiggedFigure STRIDE).
const STRIDE_NINJA = 5.5
const AIR_CLIP = 'jump-run'
const BEST_KEY = 'solomiles.ninjarun.best'
const POOL = 8
// Metres of path per footfall (the run clip's stride, two steps to the cycle).
const STEP_EVERY = 1.7
const STAR_POOL = 10
const FOE_POOL = 6

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}
function writeBest(v: number) {
  try {
    localStorage.setItem(BEST_KEY, String(v))
  } catch {
    /* private mode — best just won't persist */
  }
}

// --- Runner --------------------------------------------------------------------

function Runner({ state }: { state: RefObject<NinjaState> }) {
  const root = useRef<THREE.Group>(null!)
  const { scene, animations } = useTownGLTF(MODEL)
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions, mixer } = useAnimations(animations, model)
  const playing = useRef('')

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [model])

  const to = (name: string, once = false, timeScale = 1) => {
    const next = actions[name]
    if (!next) return
    if (playing.current === name && next.isRunning() && !once) return
    if (playing.current !== name) actions[playing.current]?.fadeOut(FADE)
    next.reset()
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = once
    next.timeScale = timeScale
    next.fadeIn(FADE).play()
    playing.current = name
  }

  const wasGrounded = useRef(true)
  const lastAirJumps = useRef(0)
  const lastStatus = useRef('')
  useFrame(() => {
    const s = state.current
    const paused = !!useGame.getState().arcade?.paused
    mixer.timeScale = paused ? 0 : 1

    if (s.status !== lastStatus.current) {
      // A fresh run (Retry) starts grounded, upright, running.
      if (s.status === 'play') wasGrounded.current = true
      lastStatus.current = s.status
    }

    if (s.status === 'play') {
      if (!s.grounded && (wasGrounded.current || s.airJumpsUsed > lastAirJumps.current)) {
        // Stretch the leap clip over the real air time so the landing lines up
        // (restarted for a double jump, over what's left of the flight).
        const h = wasGrounded.current ? N.jumpHeight : N.doubleJumpHeight
        const v0 = Math.sqrt(2 * h * N.gravity)
        const air = (v0 + Math.sqrt(v0 * v0 + 2 * N.gravity * s.y)) / N.gravity
        const clip = actions[AIR_CLIP]
        const dur = clip?.getClip().duration ?? air
        to(AIR_CLIP, true, dur / air)
      } else if (s.grounded) {
        to('ninja-run')
        const clip = actions['ninja-run']
        if (clip) clip.timeScale = s.speed / STRIDE_NINJA
      }
      wasGrounded.current = s.grounded
      lastAirJumps.current = s.airJumpsUsed
      root.current.rotation.z = 0
    } else {
      to('fall')
      // Knocked flat on his back (he faces +X, so backward is +Z roll).
      const k = Math.min(1, s.dieT / 0.35)
      root.current.rotation.z = k * 1.35
    }
    root.current.position.y = s.y
  })

  return (
    <group ref={root}>
      <group rotation={[0, Math.PI / 2, 0]} scale={N.figureScale}>
        <primitive object={model} />
      </group>
    </group>
  )
}

// --- Obstacles + enemies (fixed pools, assigned per frame) --------------------------

// Hazards read in the dark three ways, none of which the scenery gets (so a rock
// on the path never looks like decor): lighter stone/wood than the grove, a
// moonlit fresnel rim, and a pale outline shell all the way round.
const RIM = NINJA_NIGHT.hazardRim
const rim = <M extends THREE.MeshStandardMaterial>(m: M) => withRim(m, RIM.color, RIM.strength, RIM.power)
const MAT_OUTLINE = outlineMaterial(NINJA_NIGHT.hazardOutline.color, NINJA_NIGHT.hazardOutline.width)
const MAT_ROCK = rim(new THREE.MeshStandardMaterial({ color: '#86918d', flatShading: true, roughness: 0.95 }))
const MAT_BARK = rim(new THREE.MeshStandardMaterial({ color: '#6f5946', flatShading: true, roughness: 0.9 }))
const MAT_WOOD = rim(new THREE.MeshStandardMaterial({ color: '#c2a67f', flatShading: true, roughness: 0.9 }))
const MAT_NINJA = rim(new THREE.MeshStandardMaterial({ color: '#1f2433', flatShading: true, roughness: 0.8 }))
// The rival's headband and eye slit glow faintly: a red band + pale eyes are
// what you spot in the dark before the body.
const MAT_BAND = new THREE.MeshStandardMaterial({
  color: '#c8352b',
  emissive: '#c8352b',
  emissiveIntensity: 0.9,
  flatShading: true,
  roughness: 0.7,
})
const MAT_EYES = new THREE.MeshStandardMaterial({
  color: '#f1e3cf',
  emissive: '#dff6ff',
  emissiveIntensity: 1.6,
  flatShading: true,
  roughness: 0.7,
})
// Your stars catch a little moonlight of their own so a throw is always visible;
// theirs are dark steel with a hot red glow, so you can tell them apart mid-air.
const MAT_STAR = new THREE.MeshStandardMaterial({
  color: '#b8c0c8',
  emissive: '#cfe6ee',
  emissiveIntensity: 0.55,
  metalness: 0.6,
  roughness: 0.35,
})
const MAT_FOE_STAR = new THREE.MeshStandardMaterial({
  color: '#3a3f46',
  emissive: '#ff4a3a',
  emissiveIntensity: 1.5,
  metalness: 0.6,
  roughness: 0.35,
})

const { w: ROCK_W, h: ROCK_H } = NINJA_OBSTACLES.rock
const { w: LOG_W, h: LOG_H } = NINJA_OBSTACLES.log
const { w: STUMP_W, h: STUMP_H } = NINJA_OBSTACLES.stump
const ENEMY_H = NINJA_ENEMY.h
const GEO = {
  rock: new THREE.DodecahedronGeometry(0.6, 0),
  log: new THREE.CylinderGeometry(LOG_H / 2, LOG_H / 2, LOG_W, 8).rotateZ(Math.PI / 2),
  logEnd: new THREE.CylinderGeometry(LOG_H / 2 - 0.05, LOG_H / 2 - 0.05, 0.02, 8).rotateZ(Math.PI / 2),
  stump: new THREE.CylinderGeometry(STUMP_W / 2 - 0.04, STUMP_W / 2 + 0.04, STUMP_H, 8),
  stumpTop: new THREE.CylinderGeometry(STUMP_W / 2 - 0.08, STUMP_W / 2 - 0.08, 0.02, 8),
  enemyBody: new THREE.CapsuleGeometry(0.27, ENEMY_H * 0.5, 4, 10),
  enemyHead: new THREE.SphereGeometry(0.24, 12, 10),
  band: new THREE.CylinderGeometry(0.25, 0.25, 0.07, 12),
  bandTail: new THREE.BoxGeometry(0.2, 0.05, 0.04),
  eyes: new THREE.BoxGeometry(0.06, 0.06, 0.26),
}

/** A hazard part: the mesh plus its outline shell. */
function Outlined({
  geometry,
  material,
  ...props
}: { geometry: THREE.BufferGeometry; material: THREE.Material } & Omit<ThreeElements['group'], 'ref'>) {
  return (
    <group {...props}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <mesh geometry={hullGeometry(geometry)} material={MAT_OUTLINE} />
    </group>
  )
}

function Rock({ i }: { i: number }) {
  return (
    <Outlined
      geometry={GEO.rock}
      material={MAT_ROCK}
      position={[0, ROCK_H * 0.42, 0]}
      scale={[ROCK_W / 1.1, ROCK_H / 1.1, 0.9 + (i % 3) * 0.12]}
      rotation={[0, i * 1.7, 0]}
    />
  )
}

function Log() {
  return (
    <group position={[0, LOG_H / 2, 0]}>
      <Outlined geometry={GEO.log} material={MAT_BARK} />
      <mesh geometry={GEO.logEnd} material={MAT_WOOD} position={[-LOG_W / 2 - 0.005, 0, 0]} />
    </group>
  )
}

function Stump() {
  return (
    <group>
      <Outlined geometry={GEO.stump} material={MAT_BARK} position={[0, STUMP_H / 2, 0]} />
      <mesh geometry={GEO.stumpTop} material={MAT_WOOD} position={[0, STUMP_H + 0.005, 0]} />
    </group>
  )
}

/** Where a thrower's star glints in his hand during the wind-up. */
const WINDUP_POS: [number, number, number] = [-0.32, ENEMY_H * 0.8, 0.28]

/** Greybox rival ninja: dark capsule body, red headband, a pale eye slit. Faces −X. */
function Enemy() {
  return (
    <group>
      <Outlined geometry={GEO.enemyBody} material={MAT_NINJA} position={[0, ENEMY_H * 0.4, 0]} />
      <Outlined geometry={GEO.enemyHead} material={MAT_NINJA} position={[0, ENEMY_H - 0.22, 0]} />
      <mesh geometry={GEO.band} material={MAT_BAND} position={[0, ENEMY_H - 0.12, 0]} />
      <mesh geometry={GEO.bandTail} material={MAT_BAND} position={[0.28, ENEMY_H - 0.14, 0]} rotation={[0, 0, -0.9]} />
      <mesh geometry={GEO.eyes} material={MAT_EYES} position={[-0.21, ENEMY_H - 0.22, 0]} />
      <mesh name="windup" geometry={STAR_GEO} material={MAT_FOE_STAR} position={WINDUP_POS} visible={false} />
    </group>
  )
}

/** One pool per kind; each frame the live things of that kind claim slots in order. */
function ThingPool({
  state,
  kind,
  render,
}: {
  state: RefObject<NinjaState>
  kind: NinjaThing['kind']
  render: (i: number) => ReactNode
}) {
  const slots = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    let n = 0
    for (const t of state.current.things) {
      if (t.kind !== kind) continue
      const g = slots.current[n++]
      if (!g) break
      g.visible = true
      g.position.set(t.x, 0, 0)
      if (t.kind === 'enemy') {
        // Felled: tips over away from him and sinks out of sight.
        const d = t.downT ?? 0
        g.rotation.z = -Math.min(1, d / 0.3) * 1.45
        g.position.x += d * 2.5
        g.position.y = -Math.max(0, d - 0.6) * 1.2
        // Wind-up: a red star grows and spins in his raised hand.
        const star = (g.userData.windup ??= g.getObjectByName('windup')) as THREE.Object3D | undefined
        if (star) {
          star.visible = t.windT !== null
          if (t.windT !== null) {
            const k = Math.min(1, t.windT / N.enemyWindup)
            star.scale.setScalar(0.4 + 0.8 * k + Math.sin(clock.elapsedTime * 40) * 0.08)
            star.rotation.z = clock.elapsedTime * 18
          }
        }
      }
    }
    for (; n < slots.current.length; n++) {
      const g = slots.current[n]
      if (g) g.visible = false
    }
  })
  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(g) => {
            slots.current[i] = g
          }}
        >
          {render(i)}
        </group>
      ))}
    </>
  )
}

// --- Shuriken ---------------------------------------------------------------------

function starGeometry(r: number) {
  const shape = new THREE.Shape()
  const inner = r * 0.32
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const rr = i % 2 === 0 ? r : inner
    const x = Math.cos(a) * rr
    const y = Math.sin(a) * rr
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const hole = new THREE.Path()
  hole.absarc(0, 0, r * 0.12, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
  g.translate(0, 0, -0.02)
  return g
}
const STAR_GEO = starGeometry(N.shurikenRadius * 1.3)

/** Yours (pool of STAR_POOL) and theirs (FOE_POOL), both spinning. */
function Stars({ state }: { state: RefObject<NinjaState> }) {
  const mine = useRef<(THREE.Mesh | null)[]>([])
  const theirs = useRef<(THREE.Mesh | null)[]>([])
  const spin = useRef(0)
  useFrame((_, delta) => {
    if (!useGame.getState().arcade?.paused) spin.current += delta * 26
    const ks = state.current.shuriken
    for (let i = 0; i < mine.current.length; i++) {
      const m = mine.current[i]
      if (!m) continue
      const k = ks[i]
      m.visible = !!k && Number.isFinite(k.x)
      if (!k || !m.visible) continue
      m.position.set(k.x, k.y, 0)
      // Stuck stars stop spinning (and keep whatever angle they hit at).
      if (!k.stuck) m.rotation.z = -spin.current + k.id
    }
    const fs = state.current.foeStars
    for (let i = 0; i < theirs.current.length; i++) {
      const m = theirs.current[i]
      if (!m) continue
      const f = fs[i]
      m.visible = !!f && Number.isFinite(f.x)
      if (!f || !m.visible) continue
      m.position.set(f.x, f.y, 0)
      m.rotation.z = spin.current + f.id
    }
  })
  const pool = (n: number, mat: THREE.Material, into: RefObject<(THREE.Mesh | null)[]>) =>
    Array.from({ length: n }, (_, i) => (
      <mesh
        key={i}
        geometry={STAR_GEO}
        material={mat}
        visible={false}
        castShadow
        ref={(m) => {
          into.current[i] = m
        }}
      />
    ))
  return (
    <>
      {pool(STAR_POOL, MAT_STAR, mine)}
      {pool(FOE_POOL, MAT_FOE_STAR, theirs)}
    </>
  )
}

// --- Sparks ---------------------------------------------------------------------------

const SPARK_BURSTS = 8
const SPARK_BITS = 14
/** Deterministic 0..1 per (burst, bit, salt), so a burst doesn't reshuffle each frame. */
function sparkRand(id: number, j: number, salt: number) {
  let h = Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(j + 1, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

/**
 * Spark bursts where stars meet (big: star on star) or clink off an obstacle
 * (small). Hot streaks fly out under gravity and shrink away, over a quick flash —
 * bright enough to bloom on desktop; the flash card is the glow on phones.
 */
function Sparks({ state }: { state: RefObject<NinjaState> }) {
  const bits = useRef<THREE.InstancedMesh>(null!)
  const flashes = useRef<THREE.InstancedMesh>(null!)
  const assets = useMemo(() => {
    const halo = haloTexture()
    return {
      halo,
      bit: new THREE.BoxGeometry(1, 0.03, 0.03).translate(0.5, 0, 0),
      card: new THREE.PlaneGeometry(1, 1),
      bitMat: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd98a').multiplyScalar(3), toneMapped: false }),
      flashMat: new THREE.MeshBasicMaterial({
        map: halo,
        color: new THREE.Color('#ffe2a8').multiplyScalar(1.6),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    }
  }, [])
  useEffect(
    () => () => {
      for (const v of Object.values(assets)) v.dispose()
    },
    [assets],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  useFrame(() => {
    const sparks = state.current.sparks
    let b = 0
    for (let i = 0; i < SPARK_BURSTS; i++) {
      const sp = sparks[i]
      if (!sp) {
        m.makeScale(0, 0, 0)
        flashes.current.setMatrixAt(i, m)
        for (let j = 0; j < SPARK_BITS; j++) bits.current.setMatrixAt(b++, m)
        continue
      }
      const t = sp.age
      const life = 1 - t / N.sparkSecs
      const n = sp.big ? SPARK_BITS : 6
      for (let j = 0; j < SPARK_BITS; j++) {
        if (j >= n) {
          m.makeScale(0, 0, 0)
          bits.current.setMatrixAt(b++, m)
          continue
        }
        const a = sparkRand(sp.id, j, 1) * Math.PI * 2
        const v = (sp.big ? 4 : 2.2) + sparkRand(sp.id, j, 2) * (sp.big ? 5 : 3)
        const vx = Math.cos(a) * v
        const vy = Math.sin(a) * v - 14 * t
        p.set(sp.x + vx * t, sp.y + Math.sin(a) * v * t - 7 * t * t, 0.15)
        q.setFromAxisAngle(zAxis, Math.atan2(vy, vx) + Math.PI)
        const len = (0.05 + 0.035 * v) * life
        m.compose(p, q, sc.set(len, life, life))
        bits.current.setMatrixAt(b++, m)
      }
      const f = Math.max(0, 1 - t / 0.16) * (sp.big ? 1.6 : 0.8)
      m.compose(p.set(sp.x, sp.y, 0.12), q.identity(), sc.set(f, f, f))
      flashes.current.setMatrixAt(i, m)
    }
    bits.current.instanceMatrix.needsUpdate = true
    flashes.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={bits} args={[assets.bit, assets.bitMat, SPARK_BURSTS * SPARK_BITS]} frustumCulled={false} />
      <instancedMesh ref={flashes} args={[assets.card, assets.flashMat, SPARK_BURSTS]} frustumCulled={false} />
    </>
  )
}

// --- Air step (double jump) -------------------------------------------------------

const STEP_POOL = 3
const STEP_PUFFS = 14
const MIST = new THREE.Color('#a9c6cf')

/** A feathered ring (soft both sides), for the flat "ledge" of air he pushes off. */
function stepRingTexture() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0, 'rgba(255,255,255,0)')
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  grd.addColorStop(0.8, 'rgba(255,255,255,0.8)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * The double jump's footprint in the air — like the intro's landing dust, but
 * made of mist: soft puffs kicked out sideways from under his feet (as if he'd
 * stamped on an invisible ledge), dragging to a stop, swelling and sinking a
 * touch as they fade, over a faint flat ring where the "ledge" was. It hangs
 * where he stepped (the sim scrolls it with the ground) and he rises out of it.
 * Positions are closed-form in the step's age (drag integrated), with each
 * puff's direction hashed from the step id, so nothing is simulated here.
 */
function AirSteps({ state }: { state: RefObject<NinjaState> }) {
  const puffs = useRef<THREE.InstancedMesh>(null!)
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const assets = useMemo(() => {
    const halo = haloTexture()
    const ringTex = stepRingTexture()
    const ringMat = () =>
      new THREE.MeshBasicMaterial({
        map: ringTex,
        color: MIST,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    return {
      halo,
      ringTex,
      card: new THREE.PlaneGeometry(1, 1),
      flat: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      puffMat: new THREE.MeshBasicMaterial({
        map: halo,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      ringMats: Array.from({ length: STEP_POOL }, ringMat),
    }
  }, [])
  useEffect(
    () => () => {
      assets.halo.dispose()
      assets.ringTex.dispose()
      assets.card.dispose()
      assets.flat.dispose()
      assets.puffMat.dispose()
      assets.ringMats.forEach((m) => m.dispose())
    },
    [assets],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const col = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const steps = state.current.airSteps
    let n = 0
    for (let i = 0; i < STEP_POOL; i++) {
      const st = steps[i]
      const ring = rings.current[i]
      if (!st) {
        if (ring) ring.visible = false
        for (let j = 0; j < STEP_PUFFS; j++) {
          m.makeScale(0, 0, 0)
          puffs.current.setMatrixAt(n++, m)
        }
        continue
      }
      const t = st.age
      const k = Math.min(1, t / N.airStepSecs)
      const fade = (1 - k) * (1 - k)
      for (let j = 0; j < STEP_PUFFS; j++) {
        // Kicked out flat around his feet; drag brings each to a stop.
        const a = (j / STEP_PUFFS) * Math.PI * 2 + sparkRand(st.id, j, 3) * 0.5
        const sp = 1.4 + sparkRand(st.id, j, 4) * 2.4
        const out = (sp * (1 - Math.exp(-5 * t))) / 5
        const sink = -0.25 * (1 - Math.exp(-2.5 * t)) - sparkRand(st.id, j, 5) * 0.12
        p.set(st.x + Math.cos(a) * (0.2 + out), st.y + 0.05 + sink, Math.sin(a) * (0.2 + out) * 0.8)
        const size = (0.42 + sparkRand(st.id, j, 6) * 0.4) * (0.7 + 1.3 * (1 - Math.exp(-4 * t)))
        m.compose(p, q.identity(), sc.set(size, size * 0.8, size))
        puffs.current.setMatrixAt(n, m)
        puffs.current.setColorAt(n, col.copy(MIST).multiplyScalar(0.75 * fade))
        n++
      }
      if (ring) {
        ring.visible = true
        ring.position.set(st.x, st.y + 0.02, 0)
        const rk = Math.min(1, t / 0.35)
        ring.scale.setScalar(0.5 + (1 - (1 - rk) * (1 - rk)) * 2.2)
        assets.ringMats[i].opacity = 0.7 * (1 - rk) * (1 - rk)
      }
    }
    puffs.current.instanceMatrix.needsUpdate = true
    if (puffs.current.instanceColor) puffs.current.instanceColor.needsUpdate = true
  })
  return (
    <>
      <instancedMesh
        ref={(im) => {
          if (!im) return
          puffs.current = im
          // allocate instanceColor up front so the material compiles with it
          if (!im.instanceColor) for (let i = 0; i < im.count; i++) im.setColorAt(i, MIST)
        }}
        args={[assets.card, assets.puffMat, STEP_POOL * STEP_PUFFS]}
        frustumCulled={false}
      />
      {assets.ringMats.map((mat, i) => (
        <mesh
          key={i}
          geometry={assets.flat}
          material={mat}
          visible={false}
          // tipped toward the near-level camera so the ledge reads as a disc
          rotation={[0.45, 0, 0]}
          ref={(r) => {
            rings.current[i] = r
          }}
        />
      ))}
    </>
  )
}

/** Dev autopilot: jump obstacles, knock their stars out of the air (or jump
 *  them when empty-handed), and shoot each ninja with one aimed star. */
function autopilot(s: NinjaState) {
  if (s.status !== 'play') return
  const ahead = s.things.filter((t) => t.downT === null && t.x + t.w / 2 >= 0)
  const rock = ahead.find((t) => t.kind !== 'enemy')
  const ninja = ahead.find((t) => t.kind === 'enemy')
  const foe = s.foeStars.filter((f) => f.x > 0).sort((a, b) => a.x - b.x)[0]
  const flying = s.shuriken.filter((k) => !k.stuck && !k.falling)
  if (rock && (!ninja || rock.x < ninja.x)) ninjaInput.jump ||= rock.x - rock.w / 2 < s.speed * 0.2 + 0.3
  if (foe && !flying.some((k) => k.x < foe.x)) {
    if (s.ammo > 0 && foe.x < 8) ninjaInput.throw = true
    else if (foe.x < (s.speed + N.foeStarSpeed) * 0.3 + 0.5) ninjaInput.jump = true
    return
  }
  // Throw once nothing tall enough to catch the star stands in between.
  const blocked = ahead.some((t) => t.kind === 'stump' && ninja && t.x < ninja.x)
  const inFlight = flying.some((k) => ninja && k.x < ninja.x)
  if (ninja && ninja.x < N.shurikenRange - 1 && !blocked && !inFlight && s.ammo > 0) ninjaInput.throw = true
}

// --- World -------------------------------------------------------------------------

export function NinjaRunWorld() {
  const state = useRef<NinjaState>(createNinjaRun())
  const run = useGame((s) => s.arcadeRun)
  const best = useRef(readBest())
  const lastHud = useRef('')
  const strideRun = useRef(0)

  // Retry: a fresh run (the first mount already has one).
  const firstRun = useRef(run)
  useEffect(() => {
    if (run === firstRun.current) return
    state.current = createNinjaRun()
    ninjaInput.jump = false
    ninjaInput.throw = false
  }, [run])

  useEffect(() => {
    ninjaInput.jump = false
    ninjaInput.throw = false
    // The night-forest bed plays for as long as the game is up.
    return startNinjaAmbience()
  }, [])

  // Dev handle: inspect the run, `__ninja.auto = true` for an autopilot that
  // jumps obstacles and shoots ninjas (for eyeballing the feel hands-free), and
  // `__ninja.freeze = true` to hold the sim still for a screenshot.
  const dev = useRef({ auto: false, freeze: false })
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__ninja = Object.assign(dev.current, {
      state: () => state.current,
      input: ninjaInput,
      /** Fast-forward `secs` of autopiloted play (the hidden preview pane throttles rAF). */
      ff: (secs: number) => {
        for (let t = 0; t < secs; t += 1 / 60) {
          autopilot(state.current)
          stepNinjaRun(state.current, 1 / 60, ninjaInput.jump, ninjaInput.throw)
          ninjaInput.jump = ninjaInput.throw = false
        }
      },
    })
    return () => {
      delete w.__ninja
    }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()
    const s = state.current
    const paused = !!st.arcade?.paused || !!st.transition

    setNinjaAmbiencePaused(!!st.arcade?.paused)
    if (import.meta.env.DEV && dev.current.auto) autopilot(s)
    // (`__ninja.freeze` holds the frame for screenshots, dev only.)
    if (!paused && !(import.meta.env.DEV && dev.current.freeze)) {
      const wasGrounded = s.grounded
      const from = s.distance
      const sounds: NinjaSound[] = stepNinjaRun(s, dt, ninjaInput.jump, ninjaInput.throw)
      // Footfalls come off the distance run, so they quicken with him; a
      // landing is its own thud and restarts the count.
      if (s.status === 'play' && s.grounded) {
        if (!wasGrounded) {
          sounds.push('land')
          strideRun.current = 0
        } else {
          strideRun.current += Math.max(0, s.distance - from)
          if (strideRun.current >= STEP_EVERY) {
            strideRun.current %= STEP_EVERY
            sounds.push('step')
          }
        }
      }
      playNinjaSfx(sounds)
    }
    ninjaInput.jump = false
    ninjaInput.throw = false

    const score = ninjaScore(s)
    if (s.status === 'lost' && score > best.current) {
      best.current = score
      writeBest(score)
    }
    const hud = {
      score,
      lives: 1,
      status: s.status,
      paused: !!st.arcade?.paused,
      best: best.current,
      ammo: s.ammo,
    }
    const key = `${hud.score}|${hud.status}|${hud.paused}|${hud.best}|${hud.ammo}`
    if (key !== lastHud.current) {
      lastHud.current = key
      st.setArcade(hud)
    }
  })

  return (
    <group>
      <NinjaNight />
      <NinjaSky />
      {/* Forest floor + the flagstone path he runs along. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[140, 260]} />
        <meshStandardMaterial color={NINJA_NIGHT.ground} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[140, 2.4]} />
        <meshStandardMaterial color={NINJA_NIGHT.path} roughness={1} />
      </mesh>

      <NinjaScenery state={state} />
      <NinjaEye state={state} />
      <ThingPool state={state} kind="rock" render={(i) => <Rock i={i} />} />
      <ThingPool state={state} kind="log" render={() => <Log />} />
      <ThingPool state={state} kind="stump" render={() => <Stump />} />
      <ThingPool state={state} kind="enemy" render={() => <Enemy />} />
      <Stars state={state} />
      <Sparks state={state} />
      <AirSteps state={state} />
      <Runner state={state} />
    </group>
  )
}

useTownGLTF.preload(MODEL)
