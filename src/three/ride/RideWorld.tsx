import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useCyclistModel, CYCLIST_SCALE, type CyclistKit } from '../cyclist'
import { RIDE, RIDE_COLORS, PLAYER_KIT } from '../../config/ride'
import {
  makeTree,
  TREE_SPECS,
  makeGrassTuft,
  makeShrub,
  makeDeadTree,
  makeRock,
  makeBuilding,
  makeStreetLamp,
  makeTrafficLight,
  type LitAsset,
} from './assets'
import { RIDE_SCENES, type RideScene } from '../../config/rideScenes'
import { MOTION, SPAN, mulberry32, CURVE, roadX, curveSlope, LAND_GROVES } from './motion'
import { makeTarmacTexture } from '../tarmac'
import { useShadowDispose } from '../useShadowDispose'
import { useRideHud } from '../../state/rideHud'
import { useGame } from '../../state/store'
import { Beach } from './kits/Beach'
import { Farmland } from './kits/Farmland'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

// The winding road (CURVE / roadX / curveSlope) lives in ./motion so the scenery
// kits can follow the road too.

// --- Motion + gradient --------------------------------------------------------
// The world scrolls at a live speed (MOTION, shared in ./motion) that eases with a
// simulated gradient: uphill slows it, downhill speeds it up. Everything that moves
// reads MOTION.speed and CURVE.phase integrates it, so the scene stays in sync while
// the pace changes; the HUD is fed from the same source.

// --- Scene composition --------------------------------------------------------
// Which side of the road the roadside forest is confined to (screen-space x sign):
// 0 = both sides (the default look), ±1 = one side only. Set by RideWorld from the
// current route's scene spec BEFORE the prop fields build, and read by `sideX`.
const LAYOUT = {
  forestSide: 0 as -1 | 0 | 1,
  beachSide: 0 as -1 | 0 | 1,
  farmlandSide: 0 as -1 | 0 | 1,
  density: 1,
}

/** Scale a base prop count by the scene's density (open/airy scenes want fewer),
 *  keeping at least a couple so a field never vanishes entirely. */
const dens = (base: number) => Math.max(2, Math.round(base * LAYOUT.density))

// The riders are seen from behind (backs to camera, facing up the road), so a
// rider's RIGHT hand is screen-right (+X) and their LEFT is screen-left (−X).
const riderSideToScreen = (s: 'left' | 'right'): 1 | -1 => (s === 'right' ? 1 : -1)
/** Simulated road gradient (%) along the route coordinate w — a rolling profile
 *  with long climbs/descents plus shorter undulations, so the pace visibly ebbs
 *  and surges. Roughly −8…+16%. */
function gradeAt(w: number): number {
  return 4 + 7 * Math.sin(w * 0.045) + 3.5 * Math.sin(w * 0.024 + 1.5) + 2 * Math.sin(w * 0.09 + 0.3)
}

/** Drives the shared motion + gradient once per frame, before the consumers below
 *  read them, and feeds the telemetry HUD (~10Hz). Resets on mount (each ride). */
function MotionDriver() {
  const acc = useRef({ distKm: 0, elev: 0, t: 0, thr: 0 })
  useEffect(() => {
    acc.current = { distKm: 0, elev: 0, t: 0, thr: 0 }
    CURVE.phase = 0
    MOTION.speed = RIDE.scrollSpeed
    MOTION.grade = 0
    useRideHud.setState({ speed: 0, distanceKm: 0, elevationM: 0, timeS: 0, grade: 0 })
  }, [])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const grade = gradeAt(CURVE.phase)
    MOTION.grade = grade
    const target = RIDE.scrollSpeed * THREE.MathUtils.clamp(1 - grade * 0.042, 0.42, 1.6)
    MOTION.speed += (target - MOTION.speed) * (1 - Math.pow(0.06, dt)) // ease, don't jerk
    CURVE.phase += MOTION.speed * dt
    const a = acc.current
    a.t += dt
    const kmh = RIDE.baseSpeedKmh * (MOTION.speed / RIDE.scrollSpeed)
    a.distKm += (kmh / 3600) * dt
    if (grade > 0) a.elev += (grade / 100) * (kmh / 3.6) * dt
    a.thr += dt
    if (a.thr >= 0.1) {
      a.thr = 0
      useRideHud.setState({ speed: kmh, distanceKm: a.distKm, elevationM: a.elev, timeS: a.t, grade })
    }
  })
  return null
}

interface Inst {
  x: number
  z: number // live z, marched up-screen and wrapped
  rotY: number
  scale: number
}

/**
 * A field of instanced props that scrolls up-screen and recycles. The riders face
 * the camera and run in place, so the world flows AWAY (−Z, up-screen) or they read
 * as running backwards (see ride-scroll-direction): each instance marches −Z and,
 * once past `spawnZ`, wraps forward by one span. Its x tracks the winding road
 * (`roadX`) so props line the bends; `align` also yaws each instance to the road
 * tangent (for the centre dashes).
 *
 * `normalOffset` interprets `it.x` as a signed offset along the road NORMAL (the
 * same placement the road ribbon / fields use) instead of a plain horizontal x
 * offset — so a prop keeps its along-road position on bends and can't swing across
 * a curve onto a neighbouring field. Used for the farmland-side groves so trees
 * never drift over the crops.
 */
function ScrollField({
  insts,
  geometry,
  material,
  castShadow = true,
  align = false,
  normalOffset = false,
}: {
  insts: Inst[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  castShadow?: boolean
  align?: boolean
  normalOffset?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < insts.length; i++) {
      const it = insts[i]
      it.z -= MOTION.speed * dt
      if (it.z < RIDE.spawnZ) it.z += SPAN
      const rotY = align ? Math.atan(curveSlope(it.z)) : it.rotY
      _q.setFromAxisAngle(_up, rotY)
      if (normalOffset) {
        // it.x is a signed magnitude along the road normal (same maths as the road
        // ribbon / fields), so the prop shares the fields' coordinate frame.
        const sl = curveSlope(it.z)
        const invL = 1 / Math.hypot(1, sl)
        _p.set(roadX(it.z) + it.x * invL, 0, it.z - it.x * sl * invL)
      } else {
        _p.set(it.x + roadX(it.z), 0, it.z)
      }
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
    const z = RIDE.spawnZ + ((i + rand() * 0.8) / count) * SPAN
    out.push({ ...base, z })
  }
  return out
}

/** Instances clustered into the land-side tree-grove stretches (farmland scenes):
 *  a cluster of props per grove, in the near band on the farmland side — so trees
 *  and wild growth sit in the groves BETWEEN fields, never in the crops. */
interface GroveOpts { perGrove: number; latMin: number; latSpread: number; sMin: number; sSpread: number }
function groveField(seed: number, o: GroveOpts): Inst[] {
  const rand = mulberry32(seed)
  const side = LAYOUT.farmlandSide || -1
  const out: Inst[] = []
  for (const [a, b] of LAND_GROVES) {
    const cz = RIDE.spawnZ + (a + b) / 2
    for (let t = 0; t < o.perGrove; t++) {
      out.push({
        x: side * (RIDE.roadHalfWidth + o.latMin + rand() * o.latSpread),
        z: cz + (rand() - 0.5) * (b - a),
        rotY: rand() * Math.PI * 2,
        scale: o.sMin + rand() * o.sSpread,
      })
    }
  }
  return out
}

/** A roadside prop field: memoised geometry (pivoted to the ground) + material +
 *  a jittered instance pool, disposed together on unmount. On a farmland scene,
 *  props with a `grove` spec are confined to the tree-grove stretches instead of
 *  scattered across the fields. */
function useProps(
  makeGeom: () => THREE.BufferGeometry,
  color: number,
  seed: number,
  count: number,
  place: (r: () => number) => Omit<Inst, 'z'>,
  grove?: GroveOpts,
) {
  const geometry = useMemo(makeGeom, [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 }),
    [color],
  )
  const usedGrove = LAYOUT.farmlandSide !== 0 && !!grove
  const insts = useMemo(
    () => (usedGrove ? groveField(seed, grove!) : makeField(count, mulberry32(seed), place)),
    [],
  )
  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])
  return { geometry, material, insts, normalOffset: usedGrove }
}

const sideX = (min: number, spread: number) => (r: () => number) => {
  // Confine to one side when the scene asks (LAYOUT.forestSide), else pick randomly.
  const side = LAYOUT.forestSide !== 0 ? LAYOUT.forestSide : r() < 0.5 ? -1 : 1
  return { x: side * (RIDE.roadHalfWidth + min + r() * spread), rotY: r() * Math.PI * 2, scale: 0 }
}

// --- Roadside forest ---------------------------------------------------------
// The tree/shrub/rock geometry lives in ./assets (the reusable asset library, also
// shown in the asset-gallery page); the field components below instance them.

/** The roadside forest: one instanced field per tree variant (the East-Asian set),
 *  interleaved down the band with wide size variety. */
function Trees() {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
    [],
  )
  const variants = useMemo(() => TREE_SPECS.map(makeTree), [])
  const fields = useMemo(() => {
    // Farmland scenes: trees cluster into the tree-grove stretches (never in the
    // crops), and stay a minority against the fields. Otherwise: the usual scatter.
    if (LAYOUT.farmlandSide !== 0) {
      const rand = mulberry32(0x7ac0)
      const side = LAYOUT.farmlandSide
      const perVariant: Inst[][] = TREE_SPECS.map(() => [])
      for (const [a, b] of LAND_GROVES) {
        const cz = RIDE.spawnZ + (a + b) / 2
        // Keep trees near the grove CENTRE (well inside the fields' buffer) so no
        // canopy can reach a crop plot.
        const dzHalf = Math.max(0.5, (b - a) / 2 - 1.5)
        for (let t = 0; t < 3; t++) {
          const vi = Math.floor(rand() * TREE_SPECS.length)
          perVariant[vi].push({
            x: side * (RIDE.roadHalfWidth + 2 + rand() * 8), // signed road-normal offset
            z: cz + (rand() - 0.5) * 2 * dzHalf,
            rotY: rand() * Math.PI * 2,
            scale: 0.6 + rand() * 0.45, // small, so canopies stay inside the buffer
          })
        }
      }
      return perVariant
    }
    // Trees get an extra thinning beyond the scene density — coastal routes read
    // more open with only a scattering of trees.
    return TREE_SPECS.map((_, i) =>
      makeField(dens(16), mulberry32(0xc0ffee + i * 977), (r) => ({
        ...sideX(0.6, 26)(r),
        scale: 0.7 + r() * 1.1,
      })),
    )
  }, [])
  const groveMode = LAYOUT.farmlandSide !== 0
  useEffect(() => () => {
    variants.forEach((g) => g.dispose())
    material.dispose()
  }, [variants, material])
  return (
    <>
      {variants.map((geo, i) => (
        <ScrollField key={i} insts={fields[i]} geometry={geo} material={material} normalOffset={groveMode} />
      ))}
    </>
  )
}

function Grass() {
  const p = useProps(
    makeGrassTuft,
    RIDE_COLORS.grassBlade,
    0x6a12,
    dens(120),
    (r) => ({ ...sideX(0.2, 22)(r), scale: 0.7 + r() * 0.9 }),
    { perGrove: 8, latMin: 0.5, latSpread: 12, sMin: 0.7, sSpread: 0.9 },
  )
  return <ScrollField {...p} castShadow={false} />
}

function Shrubs() {
  const p = useProps(
    makeShrub,
    RIDE_COLORS.shrub,
    0xb105,
    dens(170),
    (r) => ({ ...sideX(0.5, 26)(r), scale: 0.55 + r() * 0.75 }),
    { perGrove: 5, latMin: 1, latSpread: 12, sMin: 0.55, sSpread: 0.75 },
  )
  return <ScrollField {...p} />
}

/** One dead-tree field: a bare-tree variant scattered along the roadside (or, on a
 *  farmland scene, tucked into the tree groves). */
function DeadTree({ geomSeed, color, fieldSeed, count }: { geomSeed: number; color: number; fieldSeed: number; count: number }) {
  const p = useProps(
    () => makeDeadTree(geomSeed),
    color,
    fieldSeed,
    count,
    (r) => ({ ...sideX(0.8, 24)(r), scale: 0.8 + r() * 0.7 }),
    { perGrove: 1, latMin: 2, latSpread: 11, sMin: 0.8, sSpread: 0.7 },
  )
  return <ScrollField {...p} />
}

/** A scattering of weathered dead trees among the forest, in a couple of shapes
 *  and driftwood-grey/brown tones. */
function DeadTrees() {
  return (
    <>
      <DeadTree geomSeed={0xd1a} color={0x6f6151} fieldSeed={0xdead01} count={dens(15)} />
      <DeadTree geomSeed={0xd2b} color={0x7d6c54} fieldSeed={0xdead02} count={dens(12)} />
    </>
  )
}

function Rocks() {
  const p = useProps(
    makeRock,
    RIDE_COLORS.rock,
    0x5eed,
    dens(26),
    (r) => ({ ...sideX(0.6, 20)(r), scale: 0.3 + r() * 0.5 }),
    { perGrove: 2, latMin: 2, latSpread: 11, sMin: 0.3, sSpread: 0.5 },
  )
  return <ScrollField {...p} />
}

// --- Buildings ---------------------------------------------------------------
/** Occasional small coastal houses set well back from both sides of the road (a
 *  hamlet, not a wall of them). Their footprints face the road via a per-instance
 *  yaw so the door reads toward the tarmac. */
function Buildings() {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
    [],
  )
  const variants = useMemo(() => [makeBuilding(0xb01), makeBuilding(0xb02), makeBuilding(0xb03)], [])
  const fields = useMemo(
    () =>
      variants.map((_, i) =>
        makeField(4, mulberry32(0xb01ce + i * 613), (r) => {
          // Set back behind the verge. Keep them off the beach side (a house set
          // back from a coastal road would land in the sea) — so on a beach route
          // they line the land side; otherwise either side.
          const side = LAYOUT.beachSide !== 0 ? (-LAYOUT.beachSide as -1 | 1) : r() < 0.5 ? -1 : 1
          return {
            x: side * (RIDE.roadHalfWidth + 5 + r() * 12),
            rotY: (side > 0 ? Math.PI : 0) + (r() - 0.5) * 0.8,
            scale: 0.9 + r() * 0.5,
          }
        }),
      ),
    [variants],
  )
  useEffect(() => () => {
    variants.forEach((g) => g.dispose())
    material.dispose()
  }, [variants, material])
  return (
    <>
      {variants.map((geo, i) => (
        <ScrollField key={i} insts={fields[i]} geometry={geo} material={material} />
      ))}
    </>
  )
}

// --- Lit street furniture ----------------------------------------------------
/** A scrolling field of a lit roadside asset (a LitAsset — matte `body` + glowing
 *  `lit`): the body takes the flat vertex-coloured standard material, the lit mesh
 *  an unlit MeshBasic so it reads as self-illuminated at golden hour. Both meshes
 *  share the same per-instance transforms and scroll/track the road like any prop. */
function LitField({ asset, insts }: { asset: LitAsset; insts: Inst[] }) {
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0.25 }),
    [],
  )
  const litMat = useMemo(
    () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
    [],
  )
  const bodyRef = useRef<THREE.InstancedMesh>(null!)
  const litRef = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => () => {
    bodyMat.dispose()
    litMat.dispose()
  }, [bodyMat, litMat])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < insts.length; i++) {
      const it = insts[i]
      it.z -= MOTION.speed * dt
      if (it.z < RIDE.spawnZ) it.z += SPAN
      _q.setFromAxisAngle(_up, it.rotY)
      _p.set(it.x + roadX(it.z), 0, it.z)
      _s.setScalar(it.scale)
      _m.compose(_p, _q, _s)
      bodyRef.current?.setMatrixAt(i, _m)
      litRef.current?.setMatrixAt(i, _m)
    }
    if (bodyRef.current) bodyRef.current.instanceMatrix.needsUpdate = true
    if (litRef.current) litRef.current.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={bodyRef} args={[asset.body, bodyMat, insts.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={litRef} args={[asset.lit, litMat, insts.length]} frustumCulled={false} />
    </>
  )
}

/** Sparse lit street furniture along the road: cobra-head lamps posted at the road
 *  edge (their arm arcing over the tarmac) plus the odd traffic light. The lamp
 *  arm reaches +x, so left-side posts stand as-built and right-side posts are
 *  turned 180° so the arm always reaches in over the road. */
function StreetFurniture() {
  const lamp = useMemo(makeStreetLamp, [])
  const signal = useMemo(makeTrafficLight, [])
  const edge = RIDE.roadHalfWidth + 0.5
  const lampInsts = useMemo(() => {
    const r = mulberry32(0x1a4b)
    const n = 7
    const out: Inst[] = []
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1 // alternate banks down the road
      out.push({
        x: side * edge,
        z: RIDE.spawnZ + ((i + r() * 0.5) / n) * SPAN,
        rotY: side > 0 ? Math.PI : 0, // arm reaches in over the road
        scale: 0.9,
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const signalInsts = useMemo(() => {
    const r = mulberry32(0x7c33)
    const n = 2
    const out: Inst[] = []
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1
      out.push({
        x: side * edge,
        z: RIDE.spawnZ + ((i + 0.35 + r() * 0.3) / n) * SPAN,
        // Lenses are on the head's +z face; the rider faces the camera (+z), so a
        // small turn toward the road keeps the signal facing the oncoming rider.
        rotY: side > 0 ? 0.3 : -0.3,
        scale: 0.95,
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => () => {
    lamp.body.dispose(); lamp.lit.dispose()
    signal.body.dispose(); signal.lit.dispose()
  }, [lamp, signal])
  return (
    <>
      <LitField asset={lamp} insts={lampInsts} />
      <LitField asset={signal} insts={signalInsts} />
    </>
  )
}


/** A soft round sprite (radial gradient) so each mote reads as a glowing speck
 *  rather than a hard square. */
function makeDiscTexture(): THREE.CanvasTexture {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.65)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

// Airborne dust motes drift in a slab above the road.
const MOTE = { xHalf: 26, yLo: 0.4, yHi: 7.5, zFar: -42, zNear: 8 }
const MOTE_SPAN = MOTE.zNear - MOTE.zFar

const MOTE_VERT = `
  uniform float uTime;
  uniform float uSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  varying float vTw;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.5 + aPhase) * 0.32;
    p.y += sin(uTime * 0.8 + aPhase * 1.6) * 0.22;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tw = 0.3 + 0.7 * pow(sin(uTime * aSpeed + aPhase) * 0.5 + 0.5, 2.0);
    vTw = tw;
    gl_PointSize = uSize * aSize * tw;
    gl_Position = projectionMatrix * mv;
  }
`
const MOTE_FRAG = `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  varying float vTw;
  void main() {
    float a = texture2D(uTex, gl_PointCoord).a;
    gl_FragColor = vec4(uColor, a * vTw);
  }
`

/**
 * Floating dust motes — a slab of soft additive points drifting above the road,
 * each twinkling on its own phase so they catch and lose the low sun like specks
 * in a shaft of light. They scroll −Z with the world (MOTION.speed) and recycle;
 * the drift and twinkle are done on the GPU.
 */
function Motes() {
  const COUNT = 170
  const { geom, baseX } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(COUNT * 3)
    const bx = new Float32Array(COUNT) // lateral position before the road-curve offset
    const aPhase = new Float32Array(COUNT)
    const aSpeed = new Float32Array(COUNT)
    const aSize = new Float32Array(COUNT)
    const r = mulberry32(0x51a7c3)
    for (let i = 0; i < COUNT; i++) {
      bx[i] = (r() * 2 - 1) * MOTE.xHalf
      pos[i * 3] = bx[i]
      pos[i * 3 + 1] = MOTE.yLo + r() * (MOTE.yHi - MOTE.yLo)
      pos[i * 3 + 2] = MOTE.zFar + r() * MOTE_SPAN
      aPhase[i] = r() * Math.PI * 2
      aSpeed[i] = 0.7 + r() * 2.0
      aSize[i] = 0.5 + r() * 1.15
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    return { geom: g, baseX: bx }
  }, [])
  const tex = useMemo(makeDiscTexture, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: 9 },
          uTex: { value: tex },
          uColor: { value: new THREE.Color(0xffedc4) },
        },
        vertexShader: MOTE_VERT,
        fragmentShader: MOTE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [tex],
  )
  useEffect(() => () => {
    geom.dispose()
    tex.dispose()
    mat.dispose()
  }, [geom, tex, mat])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const p = geom.attributes.position.array as Float32Array
    for (let i = 0; i < COUNT; i++) {
      let z = p[i * 3 + 2] - MOTION.speed * dt
      if (z < MOTE.zFar) z += MOTE_SPAN
      p[i * 3 + 2] = z
      // track the road's lateral curve like every other prop, so the motes don't
      // sway against the world as bends slide the whole scene sideways
      p[i * 3] = baseX[i] + roadX(z)
    }
    geom.attributes.position.needsUpdate = true
    mat.uniforms.uTime.value += dt
  })
  return <points geometry={geom} material={mat} frustumCulled={false} />
}

/** The ride road's asphalt surface (shared with the town road). Scrolled down
 *  the road each frame so the surface reads as moving. */
const makeRideTarmac = () =>
  makeTarmacTexture({
    road: RIDE_COLORS.road,
    dark: RIDE_COLORS.roadDark,
    light: RIDE_COLORS.roadLight,
  })

// --- The raised, winding road ribbon -----------------------------------------
// Built once as dynamic strip geometry spanning the visible band; each frame we
// only rewrite the x of every sample from `curveX`, so the road bends and its
// bends flow with the scenery. It's a raised causeway: a tarmac top, two dirt
// embankment walls down to the grass (which shade and cast a shadow), and painted
// edge lines.
const TILE = 6 // world-units per texture tile down the road
const RB = { zFar: -60, zNear: 32, samples: 74 }

function buildTop(zs: number[], yTop: number): THREE.BufferGeometry {
  const S = zs.length
  const pos = new Float32Array(S * 2 * 3)
  const uv = new Float32Array(S * 2 * 2)
  const nor = new Float32Array(S * 2 * 3)
  for (let i = 0; i < S; i++) {
    const z = zs[i]
    const v = (z - zs[0]) / TILE
    const li = 2 * i
    const ri = 2 * i + 1
    pos[li * 3 + 1] = yTop; pos[li * 3 + 2] = z
    pos[ri * 3 + 1] = yTop; pos[ri * 3 + 2] = z
    nor[li * 3 + 1] = 1; nor[ri * 3 + 1] = 1
    uv[li * 2] = 0; uv[li * 2 + 1] = v
    uv[ri * 2] = 1.4; uv[ri * 2 + 1] = v
  }
  const idx: number[] = []
  for (let i = 0; i < S - 1; i++) {
    const a = 2 * i, b = 2 * i + 1, c = 2 * i + 2, d = 2 * i + 3
    idx.push(a, c, b, b, c, d)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}
function updateTop(g: THREE.BufferGeometry, zs: number[], HW: number) {
  const p = g.attributes.position.array as Float32Array
  for (let i = 0; i < zs.length; i++) {
    const zc = zs[i]
    const cx = roadX(zc)
    const s = curveSlope(zc)
    const invL = 1 / Math.hypot(1, s)
    const ox = HW * invL, oz = HW * s * invL // offset along the road normal
    const li = 2 * i, ri = 2 * i + 1
    p[li * 3] = cx - ox; p[li * 3 + 2] = zc + oz
    p[ri * 3] = cx + ox; p[ri * 3 + 2] = zc - oz
  }
  g.attributes.position.needsUpdate = true
}

function buildWalls(zs: number[], yTop: number): THREE.BufferGeometry {
  const S = zs.length
  const pos = new Float32Array(S * 4 * 3)
  const nor = new Float32Array(S * 4 * 3)
  for (let i = 0; i < S; i++) {
    const z = zs[i]
    const b = 4 * i
    pos[(b + 0) * 3 + 1] = yTop; pos[(b + 0) * 3 + 2] = z // topL
    pos[(b + 1) * 3 + 1] = 0;    pos[(b + 1) * 3 + 2] = z // botL
    pos[(b + 2) * 3 + 1] = yTop; pos[(b + 2) * 3 + 2] = z // topR
    pos[(b + 3) * 3 + 1] = 0;    pos[(b + 3) * 3 + 2] = z // botR
    nor[(b + 0) * 3] = -1; nor[(b + 1) * 3] = -1
    nor[(b + 2) * 3] = 1;  nor[(b + 3) * 3] = 1
  }
  const idx: number[] = []
  for (let i = 0; i < S - 1; i++) {
    const b = 4 * i, n = 4 * (i + 1)
    idx.push(b + 0, b + 1, n + 1, b + 0, n + 1, n + 0) // left wall
    idx.push(b + 2, b + 3, n + 3, b + 2, n + 3, n + 2) // right wall
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}
function updateWalls(g: THREE.BufferGeometry, zs: number[], HW: number) {
  const p = g.attributes.position.array as Float32Array
  for (let i = 0; i < zs.length; i++) {
    const zc = zs[i]
    const cx = roadX(zc)
    const s = curveSlope(zc)
    const invL = 1 / Math.hypot(1, s)
    const ox = HW * invL, oz = HW * s * invL
    const b = 4 * i
    const lx = cx - ox, lz = zc + oz, rx = cx + ox, rz = zc - oz
    p[(b + 0) * 3] = lx; p[(b + 0) * 3 + 2] = lz
    p[(b + 1) * 3] = lx; p[(b + 1) * 3 + 2] = lz
    p[(b + 2) * 3] = rx; p[(b + 2) * 3 + 2] = rz
    p[(b + 3) * 3] = rx; p[(b + 3) * 3 + 2] = rz
  }
  g.attributes.position.needsUpdate = true
}

function buildLines(zs: number[], yTop: number): THREE.BufferGeometry {
  const S = zs.length
  const y = yTop + 0.015
  const pos = new Float32Array(S * 4 * 3)
  const nor = new Float32Array(S * 4 * 3)
  for (let i = 0; i < S; i++) {
    const z = zs[i]
    const b = 4 * i
    for (let k = 0; k < 4; k++) {
      pos[(b + k) * 3 + 1] = y
      pos[(b + k) * 3 + 2] = z
      nor[(b + k) * 3 + 1] = 1
    }
  }
  const idx: number[] = []
  for (let i = 0; i < S - 1; i++) {
    const b = 4 * i, n = 4 * (i + 1)
    idx.push(b + 0, b + 1, n + 1, b + 0, n + 1, n + 0) // left line
    idx.push(b + 2, b + 3, n + 3, b + 2, n + 3, n + 2) // right line
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}
function updateLines(g: THREE.BufferGeometry, zs: number[], EL: number) {
  const p = g.attributes.position.array as Float32Array
  const h = 0.09
  for (let i = 0; i < zs.length; i++) {
    const zc = zs[i]
    const cx = roadX(zc)
    const s = curveSlope(zc)
    const invL = 1 / Math.hypot(1, s)
    const sInvL = s * invL
    const b = 4 * i
    // place a vertex at signed offset o along the road normal from the centre
    const set = (k: number, o: number) => {
      p[(b + k) * 3] = cx + o * invL
      p[(b + k) * 3 + 2] = zc - o * sInvL
    }
    set(0, -(EL + h)); set(1, -(EL - h)) // left line
    set(2, EL - h); set(3, EL + h) // right line
  }
  g.attributes.position.needsUpdate = true
}

function CurvyRoad() {
  const HW = RIDE.roadHalfWidth
  const yTop = RIDE.roadHeight
  const EL = HW - 0.34
  const zs = useMemo(() => {
    const a = new Array<number>(RB.samples)
    for (let i = 0; i < RB.samples; i++) a[i] = RB.zFar + (i / (RB.samples - 1)) * (RB.zNear - RB.zFar)
    return a
  }, [])
  const tex = useMemo(() => {
    const t = makeRideTarmac()
    t.repeat.set(1.4, 1) // UV.v already carries world-length / TILE
    return t
  }, [])
  const top = useMemo(() => buildTop(zs, yTop), [zs, yTop])
  const walls = useMemo(() => buildWalls(zs, yTop), [zs, yTop])
  const lines = useMemo(() => buildLines(zs, yTop), [zs, yTop])
  useEffect(() => () => {
    tex.dispose(); top.dispose(); walls.dispose(); lines.dispose()
  }, [tex, top, walls, lines])
  useFrame(() => {
    updateTop(top, zs, HW)
    updateWalls(walls, zs, HW)
    updateLines(lines, zs, EL)
    // +phase/TILE makes the grain travel −Z at exactly scrollSpeed, matching the
    // dashes and props (the plane-UV maths flips the sign vs the ground texture).
    tex.offset.y = CURVE.phase / TILE
  })
  return (
    <group>
      <mesh geometry={top} castShadow receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={walls} castShadow receiveShadow>
        <meshStandardMaterial color={RIDE_COLORS.embankment} roughness={1} flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={lines}>
        <meshStandardMaterial color={RIDE_COLORS.edgeLine} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Centre-line dashes on the tarmac — they follow the road's bends and yaw to its
 *  tangent, the clearest cue that the road is moving. */
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
  return <ScrollField insts={insts} geometry={geometry} material={material} castShadow={false} align />
}

/** Ground: a solid grass slab. It carries no scrolling texture on purpose — a flat
 *  plane with a moving texture reads as a detached 2D layer in this top-down view.
 *  The "patchy" look and the ground motion come from GroundPatches instead, which
 *  are real geometry scrolling with the same rig as the trees. */
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -12]} receiveShadow>
      <planeGeometry args={[92, 130]} />
      <meshStandardMaterial color={RIDE_COLORS.grass} roughness={1} />
    </mesh>
  )
}

/** One layer of flat ground patches — low-poly discs lying on the grass at a set
 *  height, scattered full-width and scrolled by the shared ScrollField, so they
 *  move in exact lockstep with the trees and road (no floaty texture layer). */
function GroundPatch({
  color, seed, layerY, count, smin, smax,
}: {
  color: number; seed: number; layerY: number; count: number; smin: number; smax: number
}) {
  const p = useProps(
    () => new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2).translate(0, layerY, 0),
    color,
    seed,
    count,
    (r) => {
      // These are LAND patches — when a scene puts water on one side (LAYOUT.forestSide),
      // keep them on the land side so no grass discs float in the sea.
      const fs = LAYOUT.forestSide
      const x = fs !== 0 ? fs * (1 + r() * 39) : (r() * 2 - 1) * 40
      return { x, rotY: r() * Math.PI * 2, scale: smin + r() * (smax - smin) }
    },
  )
  return <ScrollField {...p} castShadow={false} />
}

/** The patchy ground: three tones of flat discs (two greens + bare earth) at
 *  slightly stepped heights, scattered across the whole width and scrolling with
 *  the world — the ground's motion and patchiness as real, in-sync geometry. */
function GroundPatches() {
  return (
    <>
      <GroundPatch color={0x6d8a49} seed={0x1a1} layerY={0.02} count={70} smin={1.8} smax={4.2} />
      <GroundPatch color={0x9aad5e} seed={0x2b2} layerY={0.035} count={56} smin={1.5} smax={3.4} />
      <GroundPatch color={0x8a7250} seed={0x3c3} layerY={0.05} count={42} smin={1.2} smax={2.6} />
    </>
  )
}

/** One ride cyclist: the kitted rider on the bike (cyclist.glb), looping its baked
 *  `cycle` clip (legs pedalling ~85rpm, cranks + Tron wheels spinning), turned to
 *  face the camera. Static like the old runner — the world moves under it. The
 *  `TronGlow` rim material glows (see useCyclistModel); an optional `kit` recolours
 *  the jersey + helmet so the two riders read as two people. Each instance clones
 *  the model (skeleton) — glow/kit materials are shared read-only. */
function RideCyclist({ x, phase = 0, rate = 1, kit }: { x: number; phase?: number; rate?: number; kit?: CyclistKit }) {
  const { model, animations } = useCyclistModel(kit)
  const root = useRef<THREE.Group>(null!)
  const { actions } = useAnimations(animations, root)

  useEffect(() => {
    const a = actions['cycle']
    if (!a) return
    a.reset()
    // Stagger this rider's pedal phase so the two aren't in lockstep.
    a.time = phase * a.getClip().duration
    a.play()
  }, [actions, phase])

  // Pedal cadence eases with the live world speed — quicker on descents, labouring
  // on climbs — same feel as the old runner (1.0 = the baked 85rpm at cruise).
  // Also yaw the rider to the road's heading at its row so it stays true to the
  // road as the bends flow past (base π faces the camera; the road tangent adds on
  // top — same atan(curveSlope) alignment the dashes use). The lateral seat tracks
  // the road normal so the two riders straddle the centreline through bends.
  useFrame(() => {
    const a = actions['cycle']
    // `rate` slightly detunes each rider's cadence so they drift out of phase over
    // time instead of pedalling in perfect sync.
    if (a) a.timeScale = (MOTION.speed / RIDE.scrollSpeed) * rate
    const g = root.current
    if (!g) return
    const ang = Math.atan(curveSlope(RIDE.runnerZ))
    g.rotation.y = Math.PI + ang
    g.position.set(x * Math.cos(ang), RIDE.roadHeight, RIDE.runnerZ - x * Math.sin(ang))
  })

  return (
    // Position + yaw are driven per-frame (above) so the rider follows the road's
    // heading; these initial values just avoid a one-frame pop before useFrame runs.
    <group ref={root} position={[x, RIDE.roadHeight, RIDE.runnerZ]} rotation={[0, Math.PI, 0]} scale={CYCLIST_SCALE}>
      <primitive object={model} />
    </group>
  )
}

/** Ride lighting — its own warm rig (the town sun is off during a ride). The sun
 *  sits to the right so the raised road's left embankment falls into shade and it
 *  throws a shadow onto the grass to the left. */
function RideLights() {
  const sun = useRef<THREE.DirectionalLight>(null!)
  useShadowDispose(sun)
  return (
    <>
      <hemisphereLight args={[0xf3e2c6, 0x6f5f42, 0.55]} />
      <ambientLight intensity={0.42} color={0xffe9cf} />
      <directionalLight position={[-12, 10, -6]} intensity={0.35} color={0xaecbe6} />
      <directionalLight
        ref={sun}
        position={[17, 10, 6]}
        intensity={1.55}
        color={RIDE_COLORS.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  )
}

/**
 * The ride auto-runner world. Player + Leonard run in place facing the camera on
 * a raised, winding road while the tarmac, dashes and roadside forest scroll away
 * up-screen and recycle. Speed eases with a simulated gradient (MotionDriver).
 * Own lighting + fog; mounted by three/Scene.tsx when `ride` is set, with the
 * town unmounted.
 */
export function RideWorld() {
  const scene = useThree((s) => s.scene)
  // The scene spec for this route (which kits, which sides). Set the forest side
  // synchronously during render so the prop fields pick it up when they build
  // (their useMemos run as the children below render, after this line).
  const ride = useGame((s) => s.ride)
  const spec: RideScene | undefined = ride ? RIDE_SCENES[ride] : undefined
  LAYOUT.forestSide = spec?.forest ? riderSideToScreen(spec.forest) : 0
  LAYOUT.beachSide = spec?.beach ? riderSideToScreen(spec.beach) : 0
  LAYOUT.farmlandSide = spec?.farmland ? riderSideToScreen(spec.farmland) : 0
  LAYOUT.density = spec?.density ?? 1

  useEffect(() => {
    const prev = scene.fog
    scene.fog = new THREE.Fog(0xe4dcc6, 34, 78)
    CURVE.phase = 0
    return () => {
      scene.fog = prev
      LAYOUT.forestSide = 0
      LAYOUT.beachSide = 0
      LAYOUT.farmlandSide = 0
      LAYOUT.density = 1
    }
  }, [scene])

  return (
    <group>
      <RideLights />
      <MotionDriver />
      <Ground />
      <GroundPatches />
      {spec?.beach && <Beach side={riderSideToScreen(spec.beach)} />}
      {spec?.farmland && <Farmland side={riderSideToScreen(spec.farmland)} />}
      <CurvyRoad />
      <RoadDashes />
      <Trees />
      <DeadTrees />
      <Grass />
      <Shrubs />
      <Rocks />
      {spec?.buildings && <Buildings />}
      {spec?.streetFurniture && <StreetFurniture />}
      <RideCyclist x={RIDE.playerX} kit={PLAYER_KIT} />
      <RideCyclist x={RIDE.leonardX} phase={0.37} rate={1.06} />
      <Motes />
    </group>
  )
}
