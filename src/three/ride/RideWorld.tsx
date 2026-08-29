import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RIDE, RIDE_COLORS } from '../../config/ride'
import { RiggedFigure } from '../RiggedFigure'
import { useShadowDispose } from '../useShadowDispose'
import { getPineAsset } from './pineAsset'
import { useRideHud } from '../../state/rideHud'
import type { CharAnim } from '../Figure'

const SPAN = RIDE.recycleZ - RIDE.spawnZ // length of the recycle band along Z
const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Small deterministic RNG so the scenery lays out the same every ride. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Inst {
  x: number
  z: number // live z, marched toward the camera and wrapped
  rotY: number
  scale: number
}

/**
 * A field of instanced props that scrolls toward the camera and recycles. Each
 * instance marches +Z at the ride speed; once it passes `recycleZ` it wraps back
 * by one span, so a small pool reads as an endless roadside.
 */
function ScrollField({
  insts,
  geometry,
  material,
  castShadow = true,
}: {
  insts: Inst[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  castShadow?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < insts.length; i++) {
      const it = insts[i]
      it.z += RIDE.scrollSpeed * dt
      if (it.z > RIDE.recycleZ) it.z -= SPAN
      _q.setFromAxisAngle(_up, it.rotY)
      _p.set(it.x, 0, it.z)
      _s.setScalar(it.scale)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, insts.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
    />
  )
}

/** Build a pool of instances spread evenly along the band, jittered by the RNG. */
function makeField(
  count: number,
  rand: () => number,
  place: (rand: () => number) => Omit<Inst, 'z'>,
): Inst[] {
  const out: Inst[] = []
  for (let i = 0; i < count; i++) {
    const base = place(rand)
    // Spread the pool evenly down the band, plus a little jitter, so gaps don't
    // line up into a visible pulse.
    const z = RIDE.spawnZ + ((i + rand() * 0.8) / count) * SPAN
    out.push({ ...base, z })
  }
  return out
}

/** A roadside prop field: memoised geometry (pivoted to the ground) + material +
 *  a jittered instance pool, disposed together on unmount. */
function useProps(
  makeGeom: () => THREE.BufferGeometry,
  color: number,
  seed: number,
  count: number,
  place: (r: () => number) => Omit<Inst, 'z'>,
) {
  const geometry = useMemo(makeGeom, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 }),
    [color],
  )
  const insts = useMemo(() => makeField(count, mulberry32(seed), place), [])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  return { geometry, material, insts }
}

const sideX = (min: number, spread: number) => (r: () => number) => {
  const side = r() < 0.5 ? -1 : 1
  return { x: side * (RIDE.roadHalfWidth + min + r() * spread), rotY: r() * Math.PI * 2, scale: 0 }
}

/**
 * Roadside pines. Reuses the actual main-map pine mesh + palette material
 * (captured at town load, see pineAsset.ts), normalised to a consistent height
 * with its base on the ground — so the ride's trees read identical to the town's.
 * Falls back to a simple cone if the town hasn't been visited yet.
 */
function Pines() {
  const asset = getPineAsset()
  const built = useMemo(() => {
    if (asset) {
      const g = asset.geometry.clone()
      g.computeBoundingBox()
      const bb = g.boundingBox!
      const h = bb.max.y - bb.min.y || 1
      g.translate(0, -bb.min.y, 0) // base to y = 0
      const k = RIDE.pineTargetH / h // scale 1 ≈ pineTargetH tall
      g.scale(k, k, k)
      return { geometry: g, material: asset.material, ownMat: false }
    }
    const g = new THREE.ConeGeometry(1.0, 3.4, 6).translate(0, 1.7, 0)
    const m = new THREE.MeshStandardMaterial({ color: RIDE_COLORS.pine, flatShading: true, roughness: 0.95 })
    return { geometry: g, material: m, ownMat: true }
  }, [asset])
  const insts = useMemo(
    () => makeField(30, mulberry32(0xc0ffee), (r) => ({ ...sideX(1.2, 13)(r), scale: 0.8 + r() * 0.55 })),
    [],
  )
  useEffect(() => () => {
    built.geometry.dispose()
    if (built.ownMat) built.material.dispose()
  }, [built])
  return <ScrollField insts={insts} geometry={built.geometry} material={built.material} />
}

/** A low-poly grass tuft — a few flat-shaded blades fanned out from the base. */
function makeGrassTuft(): THREE.BufferGeometry {
  const rand = mulberry32(0x9a55)
  const blades: THREE.BufferGeometry[] = []
  for (let i = 0; i < 5; i++) {
    const h = 0.38 + rand() * 0.28
    const b = new THREE.ConeGeometry(0.045, h, 3)
    b.translate(0, h / 2, 0)
    b.rotateZ((rand() - 0.5) * 0.6)
    b.rotateY(rand() * Math.PI * 2)
    b.translate((rand() - 0.5) * 0.28, 0, (rand() - 0.5) * 0.28)
    blades.push(b)
  }
  return mergeGeometries(blades, false)!
}

/** A low rounded shrub — a couple of clustered flat-shaded icospheres. */
function makeShrub(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const add = (r: number, x: number, y: number, z: number) => {
    const s = new THREE.IcosahedronGeometry(r, 1)
    s.translate(x, y, z)
    parts.push(s)
  }
  add(0.5, 0, 0.42, 0)
  add(0.34, 0.34, 0.3, 0.06)
  add(0.32, -0.3, 0.32, -0.08)
  return mergeGeometries(parts, false)!
}

function Grass() {
  const p = useProps(makeGrassTuft, RIDE_COLORS.grassBlade, 0x6a12, 52, (r) => ({
    ...sideX(0.3, 9)(r),
    scale: 0.7 + r() * 0.8,
  }))
  return <ScrollField {...p} castShadow={false} />
}

function Shrubs() {
  const p = useProps(makeShrub, RIDE_COLORS.shrub, 0xb105, 16, (r) => ({
    ...sideX(1.4, 10)(r),
    scale: 0.7 + r() * 0.6,
  }))
  return <ScrollField {...p} />
}

function Rocks() {
  const p = useProps(() => new THREE.IcosahedronGeometry(1, 0).translate(0, 0.4, 0), RIDE_COLORS.rock, 0x5eed, 14, (r) => ({
    ...sideX(0.6, 11)(r),
    scale: 0.3 + r() * 0.5,
  }))
  return <ScrollField {...p} />
}

/** Centre-line dashes on the tarmac — the clearest cue that the road is moving. */
function RoadDashes() {
  const geometry = useMemo(
    () => new THREE.BoxGeometry(0.34, 0.02, 2.4).translate(0, RIDE.roadHeight + 0.02, 0),
    [],
  )
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: RIDE_COLORS.dash, roughness: 0.7 }),
    [],
  )
  const insts = useMemo(() => {
    const count = Math.ceil(SPAN / 5)
    const out: Inst[] = []
    for (let i = 0; i < count; i++) out.push({ x: 0, z: RIDE.spawnZ + (i / count) * SPAN, rotY: 0, scale: 1 })
    return out
  }, [])
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  return <ScrollField insts={insts} geometry={geometry} material={material} castShadow={false} />
}

/** Ground: a wide grass slab with a raised tarmac slab (a low kerb) down the
 *  centre and a dirt verge along each edge. Static — the sense of motion comes
 *  from the dashes and props scrolling over it. */
function Ground() {
  const h = RIDE.roadHeight
  const verge = RIDE.vergeWidth
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -12]} receiveShadow>
        <planeGeometry args={[80, 100]} />
        <meshStandardMaterial color={RIDE_COLORS.grass} roughness={1} />
      </mesh>
      {/* raised tarmac slab */}
      <mesh position={[0, h / 2, -12]} receiveShadow castShadow>
        <boxGeometry args={[RIDE.roadHalfWidth * 2, h, 100]} />
        <meshStandardMaterial color={RIDE_COLORS.road} roughness={0.85} />
      </mesh>
      {/* dirt verges flanking the road */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (RIDE.roadHalfWidth + verge / 2), h * 0.45, -12]} receiveShadow>
          <boxGeometry args={[verge, h * 0.9, 100]} />
          <meshStandardMaterial color={RIDE_COLORS.verge} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** One runner: the shared rigged character, locked in place looping its run clip
 *  (RiggedFigure syncs the clip cadence to anim.speed). Faces north (back to the
 *  camera) — riding up the road, standing on the raised tarmac. */
function RideRunner({ x }: { x: number }) {
  const anim = useRef<CharAnim>({
    moving: true, phase: 0, speed: RIDE.runSpeed, gait: 'run',
    jumpSeq: 0, jumpKind: 'jump', jumping: false,
  })
  return (
    <group position={[x, RIDE.roadHeight, 0]} rotation={[0, Math.PI, 0]}>
      <RiggedFigure anim={anim} />
    </group>
  )
}

/** Ride lighting — its own warm rig (the town sun is off during a ride). */
function RideLights() {
  const sun = useRef<THREE.DirectionalLight>(null!)
  useShadowDispose(sun)
  return (
    <>
      <hemisphereLight args={[0xf3e2c6, 0x6f5f42, 0.6]} />
      <ambientLight intensity={0.5} color={0xffe9cf} />
      <directionalLight position={[-12, 10, -6]} intensity={0.4} color={0xaecbe6} />
      <directionalLight
        ref={sun}
        position={[8, 16, 12]}
        intensity={1.5}
        color={RIDE_COLORS.sun}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  )
}

/**
 * Feeds the telemetry HUD (state/rideHud): distance integrates a speed that
 * varies around the baseline with a synthetic rolling gradient; elevation
 * accumulates the climbs. Throttled to ~10Hz so the HUD doesn't re-render every
 * frame. Resets on mount (each new ride). Purely decorative game-feel numbers.
 */
function RideTelemetry() {
  const acc = useRef({ dist: 0, elev: 0, t: 0, thr: 0 })
  useEffect(() => {
    acc.current = { dist: 0, elev: 0, t: 0, thr: 0 }
    useRideHud.setState({ speed: 0, distanceKm: 0, elevationM: 0, timeS: 0, grade: 0 })
  }, [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const a = acc.current
    a.t += dt
    const grade = 3.5 + Math.sin(a.t * 0.13) * 5.5 + Math.sin(a.t * 0.31 + 1.3) * 3 // ~ -5…+12 %
    const speed = Math.max(9, RIDE.baseSpeedKmh - grade * 0.75 + Math.sin(a.t * 0.5) * 1.2)
    a.dist += (speed / 3600) * dt
    if (grade > 0) a.elev += (grade / 100) * (speed / 3.6) * dt
    a.thr += dt
    if (a.thr >= 0.1) {
      a.thr = 0
      useRideHud.setState({ speed, distanceKm: a.dist, elevationM: a.elev, timeS: a.t, grade })
    }
  })
  return null
}

/**
 * The ride auto-runner world. Player + Leonard run in place on a raised road
 * while the dashes and roadside scenery (main-map pines, grass, shrubs, rocks)
 * scroll toward the camera and recycle. Own lighting + fog; mounted by
 * three/Scene.tsx when `ride` is set, with the town unmounted.
 */
export function RideWorld() {
  const scene = useThree((s) => s.scene)
  // A warm distance fog fades the far spawn line (props popping in at spawnZ) into
  // the sky. Restored on unmount so it doesn't leak into the town.
  useEffect(() => {
    const prev = scene.fog
    scene.fog = new THREE.Fog(0xe4dcc6, 34, 74)
    return () => {
      scene.fog = prev
    }
  }, [scene])

  return (
    <group>
      <RideLights />
      <Ground />
      <RoadDashes />
      <Pines />
      <Grass />
      <Shrubs />
      <Rocks />
      <RideRunner x={RIDE.playerX} />
      <RideRunner x={RIDE.leonardX} />
      <RideTelemetry />
    </group>
  )
}
