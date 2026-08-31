import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RIDE, RIDE_COLORS } from '../../config/ride'
import { RIDE_SCENES, type RideScene } from '../../config/rideScenes'
import { MOTION, SPAN, mulberry32 } from './motion'
import { makeTarmacTexture } from '../tarmac'
import { RiggedFigure } from '../RiggedFigure'
import { useShadowDispose } from '../useShadowDispose'
import { useRideHud } from '../../state/rideHud'
import { useGame } from '../../state/store'
import { Beach } from './kits/Beach'
import type { CharAnim } from '../Figure'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

// --- The winding road ---------------------------------------------------------
// The road meanders left/right. `roadX(z)` is the road centre's x at world z,
// anchored to zero at the riders' row so they sit still and centred while the
// bends flow past. A scrolling `phase` slides the bends up-screen in lockstep with
// the scenery. Everything anchored to the road (the ribbon, dashes, roadside
// props) reads its x from `roadX`, so the whole scene bends together as a coherent
// road through the forest.
const CURVE = { phase: 0 }
/**
 * The road-centre x as a function of the along-route coordinate w = z + phase.
 * Deliberately varied over distance: slowly-changing envelopes give long
 * near-straight runs, gentler curved stretches, and the occasional sharp
 * switchback, instead of one uniform wiggle.
 */
function curveRaw(z: number): number {
  const w = z + CURVE.phase
  // how curvy this stretch is (long wavelength → long straight / curvy runs)
  const regime = 0.5 + 0.5 * Math.sin(w * 0.008 + 0.6)
  // switchback burst — mostly ~0, spikes toward 1 now and then for a sharp bend
  const b = Math.max(0, Math.sin(w * 0.017 + 1.2))
  const burst = b * b * b
  const gentle = 2.4 * Math.sin(w * 0.042) + 1.0 * Math.sin(w * 0.026 + 1.1)
  const switchback = 5.4 * Math.sin(w * 0.10 + 0.4)
  return regime * gentle + burst * switchback
}
/** The road-centre x at world z, anchored so it's ZERO at the riders' row: the
 *  riders sit still and centred on the road, and the bends appear ahead/behind
 *  and flow past them. */
function roadX(z: number): number {
  return curveRaw(z) - curveRaw(RIDE.runnerZ)
}
/** dx/dz of the road centre — numeric so it tracks the complex profile above.
 *  Used to yaw dashes and to keep the ribbon width perpendicular to the road. */
function curveSlope(z: number): number {
  const h = 0.6
  return (curveRaw(z + h) - curveRaw(z - h)) / (2 * h)
}

// --- Motion + gradient --------------------------------------------------------
// The world scrolls at a live speed (MOTION, shared in ./motion) that eases with a
// simulated gradient: uphill slows it, downhill speeds it up. Everything that moves
// reads MOTION.speed and CURVE.phase integrates it, so the scene stays in sync while
// the pace changes; the HUD is fed from the same source.

// --- Scene composition --------------------------------------------------------
// Which side of the road the roadside forest is confined to (screen-space x sign):
// 0 = both sides (the default look), ±1 = one side only. Set by RideWorld from the
// current route's scene spec BEFORE the prop fields build, and read by `sideX`.
const LAYOUT = { forestSide: 0 as -1 | 0 | 1 }

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
 */
function ScrollField({
  insts,
  geometry,
  material,
  castShadow = true,
  align = false,
}: {
  insts: Inst[]
  geometry: THREE.BufferGeometry
  material: THREE.Material
  castShadow?: boolean
  align?: boolean
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
      _p.set(it.x + roadX(it.z), 0, it.z)
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
  // Confine to one side when the scene asks (LAYOUT.forestSide), else pick randomly.
  const side = LAYOUT.forestSide !== 0 ? LAYOUT.forestSide : r() < 0.5 ? -1 : 1
  return { x: side * (RIDE.roadHalfWidth + min + r() * spread), rotY: r() * Math.PI * 2, scale: 0 }
}

// --- Low-poly pine trees (a variety) -----------------------------------------

/** Paint every vertex of a part one flat colour, so a merged tree can carry a
 *  brown trunk and green tiers under a single vertex-colour material. */
function tinted(g: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

interface PineSpec {
  trunkH: number
  trunkR: number
  trunk: number
  sides: number
  foliage: number
  /** Stacked foliage cones: radius, height, base-y. */
  tiers: { r: number; h: number; y: number }[]
}

/** A stacked-cone conifer built from one spec: a tapered trunk plus foliage tiers,
 *  each tier a hair darker toward the base for a little depth. Flat-shaded, low
 *  poly, vertex-coloured. */
function makePine(spec: PineSpec): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(spec.trunkR * 0.8, spec.trunkR, spec.trunkH, 5)
  trunk.translate(0, spec.trunkH / 2, 0)
  parts.push(tinted(trunk, spec.trunk))
  const base = new THREE.Color(spec.foliage)
  spec.tiers.forEach((t, i) => {
    const cone = new THREE.ConeGeometry(t.r, t.h, spec.sides)
    cone.translate(0, t.y + t.h / 2, 0)
    // lower tiers slightly darker, top tier slightly brighter
    const shade = 0.82 + (i / Math.max(1, spec.tiers.length - 1)) * 0.28
    parts.push(tinted(cone, base.clone().multiplyScalar(shade)))
  })
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

/** Five distinct pine silhouettes — spruce, fir, tall pine, young sapling, bushy
 *  — in a spread of greens, so the roadside reads as a real mixed forest. */
const PINE_SPECS: PineSpec[] = [
  // tall narrow spruce
  { trunkH: 0.5, trunkR: 0.13, trunk: 0x6b4a2f, sides: 6, foliage: 0x3c5a2b,
    tiers: [{ r: 1.3, h: 1.2, y: 0.4 }, { r: 1.02, h: 1.15, y: 1.2 }, { r: 0.74, h: 1.1, y: 2.0 }, { r: 0.46, h: 1.0, y: 2.75 }] },
  // broad fir
  { trunkH: 0.42, trunkR: 0.15, trunk: 0x6e4c30, sides: 7, foliage: 0x50702f,
    tiers: [{ r: 1.7, h: 1.35, y: 0.35 }, { r: 1.24, h: 1.3, y: 1.25 }, { r: 0.72, h: 1.25, y: 2.15 }] },
  // tall pine on a bare trunk
  { trunkH: 1.0, trunkR: 0.13, trunk: 0x5f4029, sides: 6, foliage: 0x35563a,
    tiers: [{ r: 1.05, h: 1.5, y: 0.9 }, { r: 0.82, h: 1.45, y: 1.9 }, { r: 0.5, h: 1.3, y: 2.85 }] },
  // young sapling
  { trunkH: 0.3, trunkR: 0.1, trunk: 0x6b4a2f, sides: 6, foliage: 0x6b8f3f,
    tiers: [{ r: 0.9, h: 1.05, y: 0.25 }, { r: 0.56, h: 0.95, y: 1.0 }] },
  // squat bushy pine
  { trunkH: 0.35, trunkR: 0.14, trunk: 0x6e4c30, sides: 7, foliage: 0x466b34,
    tiers: [{ r: 1.5, h: 1.5, y: 0.3 }, { r: 1.02, h: 1.35, y: 1.3 }] },
]

/** The roadside forest: one instanced field per pine variant, interleaved down
 *  the band with wide size variety. */
function Pines() {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }),
    [],
  )
  const variants = useMemo(() => PINE_SPECS.map(makePine), [])
  const fields = useMemo(
    () =>
      PINE_SPECS.map((_, i) =>
        makeField(34, mulberry32(0xc0ffee + i * 977), (r) => ({
          ...sideX(0.6, 26)(r),
          scale: 0.7 + r() * 1.1,
        })),
      ),
    [],
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
  const p = useProps(makeGrassTuft, RIDE_COLORS.grassBlade, 0x6a12, 120, (r) => ({
    ...sideX(0.2, 22)(r),
    scale: 0.7 + r() * 0.9,
  }))
  return <ScrollField {...p} castShadow={false} />
}

function Shrubs() {
  const p = useProps(makeShrub, RIDE_COLORS.shrub, 0xb105, 170, (r) => ({
    ...sideX(0.5, 26)(r),
    scale: 0.55 + r() * 0.75,
  }))
  return <ScrollField {...p} />
}

/** A bare, weathered dead tree — a tapered trunk with a few angular leafless
 *  branches (and the odd fork). Randomised per `seed` so variants differ. */
function makeDeadTree(seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed)
  const parts: THREE.BufferGeometry[] = []
  const H = 2.2 + rand() * 1.4
  const trunk = new THREE.CylinderGeometry(0.08, 0.19, H, 5)
  trunk.translate(0, H / 2, 0)
  parts.push(trunk)
  const nb = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < nb; i++) {
    const by = H * (0.42 + rand() * 0.5)
    const len = 0.5 + rand() * 1.1
    const branch = new THREE.CylinderGeometry(0.025, 0.07, len, 4)
    branch.translate(0, len / 2, 0)
    branch.rotateZ((0.6 + rand() * 0.7) * (rand() < 0.5 ? -1 : 1))
    branch.rotateY(rand() * Math.PI * 2)
    branch.translate(0, by, 0)
    parts.push(branch)
    if (rand() < 0.5) {
      const len2 = 0.3 + rand() * 0.5
      const fork = new THREE.CylinderGeometry(0.02, 0.045, len2, 4)
      fork.translate(0, len2 / 2, 0)
      fork.rotateZ((0.5 + rand() * 0.6) * (rand() < 0.5 ? -1 : 1))
      fork.rotateY(rand() * Math.PI * 2)
      fork.translate((rand() - 0.5) * len, by + len * 0.55, (rand() - 0.5) * len)
      parts.push(fork)
    }
  }
  const g = mergeGeometries(parts, false)!
  g.computeVertexNormals()
  return g
}

/** One dead-tree field: a bare-tree variant scattered along the roadside. */
function DeadTree({ geomSeed, color, fieldSeed, count }: { geomSeed: number; color: number; fieldSeed: number; count: number }) {
  const p = useProps(
    () => makeDeadTree(geomSeed),
    color,
    fieldSeed,
    count,
    (r) => ({ ...sideX(0.8, 24)(r), scale: 0.8 + r() * 0.7 }),
  )
  return <ScrollField {...p} />
}

/** A scattering of weathered dead trees among the forest, in a couple of shapes
 *  and driftwood-grey/brown tones. */
function DeadTrees() {
  return (
    <>
      <DeadTree geomSeed={0xd1a} color={0x6f6151} fieldSeed={0xdead01} count={15} />
      <DeadTree geomSeed={0xd2b} color={0x7d6c54} fieldSeed={0xdead02} count={12} />
    </>
  )
}

function Rocks() {
  const p = useProps(() => new THREE.IcosahedronGeometry(1, 0).translate(0, 0.4, 0), RIDE_COLORS.rock, 0x5eed, 26, (r) => ({
    ...sideX(0.6, 20)(r),
    scale: 0.3 + r() * 0.5,
  }))
  return <ScrollField {...p} />
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

/** One rider: the shared rigged character, looping its run clip, turned to face
 *  the camera. Completely static — the world (road included) moves under it; if a
 *  switchback swings the tarmac aside, that's fine. */
function RideRunner({ x }: { x: number }) {
  const anim = useRef<CharAnim>({
    moving: true, phase: 0, speed: RIDE.runSpeed, gait: 'run',
    jumpSeq: 0, jumpKind: 'jump', jumping: false,
  })
  // Cadence the legs with the live world speed — quicker on the descents, labouring
  // on the climbs — without moving the rider.
  useFrame(() => {
    anim.current.speed = RIDE.runSpeed * (MOTION.speed / RIDE.scrollSpeed)
  })
  return (
    <group position={[x, RIDE.roadHeight, RIDE.runnerZ]} rotation={[0, 0, 0]}>
      <RiggedFigure anim={anim} />
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

  useEffect(() => {
    const prev = scene.fog
    scene.fog = new THREE.Fog(0xe4dcc6, 34, 78)
    CURVE.phase = 0
    return () => {
      scene.fog = prev
      LAYOUT.forestSide = 0
    }
  }, [scene])

  return (
    <group>
      <RideLights />
      <MotionDriver />
      <Ground />
      <GroundPatches />
      {spec?.beach && <Beach side={riderSideToScreen(spec.beach)} />}
      <CurvyRoad />
      <RoadDashes />
      <Pines />
      <DeadTrees />
      <Grass />
      <Shrubs />
      <Rocks />
      <RideRunner x={RIDE.playerX} />
      <RideRunner x={RIDE.leonardX} />
      <Motes />
    </group>
  )
}
