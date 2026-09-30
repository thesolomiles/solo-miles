import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { NINJA_NIGHT as K, NINJA_RUN as N, ninjaView } from '../../config/arcade'
import type { NinjaState } from '../../arcade/ninjarun'
import { useShadowDispose } from '../useShadowDispose'
import { makeGrassTuft, makeShrub, tinted } from '../ride/assets'
import { mulberry32 } from '../ride/motion'

/**
 * Ninja Run's night bamboo grove (config: NINJA_NIGHT). Everything on the ground
 * lives in one group that scrolls with the run and wraps every SCROLL_W units —
 * each layout is laid out once and tiled 3×, so any viewport stays covered.
 *
 * Light: dim cold ambient + moonlight from behind, dense teal fog, and two kinds
 * of light anchors — cyan bioluminescent mushrooms/moss and warm stone lanterns.
 * Their glow is emissive colour > 1 (blooms on desktop) plus soft additive halo
 * cards (the glow phones get, with no bloom), and a few real point lights that
 * follow whichever lanterns / mushroom clusters are nearest the middle of the view.
 */

export const SCROLL_W = 48

// --- Placement + instancing -----------------------------------------------------

interface Placement {
  x: number
  z: number
  y?: number
  /** Uniform scale, or per-axis when `sy` / `sx` are set. */
  s: number
  sx?: number
  sy?: number
  ry: number
}

/** Tile one layout 3× along x (−W, 0, +W) so the wrapped scroll never shows an edge. */
function tile3(one: Placement[]): Placement[] {
  const all: Placement[] = []
  for (let t = -1; t <= 1; t++) for (const p of one) all.push({ ...p, x: p.x + t * SCROLL_W })
  return all
}

/** `count` random placements over one tile, z in [z0, z1], scale in [s0, s1]. */
function scatter(count: number, z0: number, z1: number, seed: number, s0 = 0.85, s1 = 1.15) {
  const rand = mulberry32(seed)
  return Array.from({ length: count }, () => ({
    x: rand() * SCROLL_W,
    z: z0 + rand() * (z1 - z0),
    s: s0 + rand() * (s1 - s0),
    ry: rand() * Math.PI * 2,
  }))
}

function Instanced({
  geometry,
  material,
  items,
  castShadow = false,
  receiveShadow = true,
}: {
  geometry: THREE.BufferGeometry
  material: THREE.Material
  items: Placement[]
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const v = new THREE.Vector3()
    const sc = new THREE.Vector3()
    items.forEach((p, i) => {
      q.setFromEuler(e.set(0, p.ry, 0))
      sc.set(p.sx ?? p.s, p.sy ?? p.s, p.s)
      m.compose(v.set(p.x, p.y ?? 0, p.z), q, sc)
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [items])
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
    />
  )
}

// --- Geometry -----------------------------------------------------------------------

/** A bamboo stalk: segmented culm, node rings, a crown of flat leaf pads. Pivot at ground. */
function makeBamboo(h: number, r: number, seed: number) {
  const rand = mulberry32(seed)
  const parts: THREE.BufferGeometry[] = []
  const culm = new THREE.CylinderGeometry(r * 0.85, r, h, 6)
  culm.translate(0, h / 2, 0)
  parts.push(tinted(culm, K.bamboo.culm))
  const seg = 0.9 + rand() * 0.4
  for (let y = seg; y < h - 0.4; y += seg) {
    const ring = new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.06, 6)
    ring.translate(0, y, 0)
    parts.push(tinted(ring, K.bamboo.ring))
  }
  const leaves = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < leaves; i++) {
    const blob = new THREE.IcosahedronGeometry(0.55 + rand() * 0.35, 0).scale(1.4, 0.45, 1)
    blob.translate((rand() - 0.5) * 1.2, h - 0.6 - i * 0.7 - rand() * 0.3, (rand() - 0.5) * 0.8)
    parts.push(tinted(blob, K.bamboo.leaf[i % 2]))
  }
  return mergeGeometries(parts, false)!
}

/** A small cluster of glowing mushrooms: dim stems, bright caps. Pivot at ground. */
function makeMushrooms(seed: number) {
  const rand = mulberry32(seed)
  const parts: THREE.BufferGeometry[] = []
  const n = 3 + Math.floor(rand() * 3)
  const cap = new THREE.Color(K.mushroom.color)
  const stem = cap.clone().multiplyScalar(0.45)
  for (let i = 0; i < n; i++) {
    const h = 0.1 + rand() * 0.16
    const r = 0.05 + rand() * 0.05
    const x = (rand() - 0.5) * 0.35
    const z = (rand() - 0.5) * 0.25
    const s = new THREE.CylinderGeometry(r * 0.3, r * 0.4, h, 5)
    s.translate(x, h / 2, z)
    parts.push(tinted(s, stem))
    const c = new THREE.SphereGeometry(r, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2)
    c.scale(1, 0.7, 1)
    c.translate(x, h, z)
    parts.push(tinted(c, cap))
  }
  return mergeGeometries(parts, false)!
}

/** A mossy lump: a flattened faceted blob (sits on the ground or a boulder top). */
function makeMoss() {
  return tinted(new THREE.IcosahedronGeometry(0.3, 1).scale(1.3, 0.28, 0.9), K.moss.color)
}

/** A dark forest boulder, a bit wider than tall. */
function makeBoulder() {
  const g = new THREE.DodecahedronGeometry(0.6, 0).scale(1.35, 0.8, 1)
  g.translate(0, 0.3, 0)
  return tinted(g, K.boulder)
}

/** The lamp chamber's height on a lantern (where its glow + point light sit). */
const LANTERN_LIGHT_Y = 0.83

/**
 * A traditional stone lantern (tōrō): hex base, pillar, platform, an open fire
 * chamber (four corner posts), hex roof and finial. Returns the stone body and,
 * separately, the glowing core inside the chamber (its own emissive material).
 */
function makeLantern() {
  const stone = new THREE.Color(K.lantern.stone)
  const dark = stone.clone().multiplyScalar(0.7)
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, y: number, c = stone, x = 0, z = 0) => {
    g.translate(x, y, z)
    parts.push(tinted(g, c))
  }
  add(new THREE.CylinderGeometry(0.26, 0.3, 0.12, 6), 0.06, dark)
  add(new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6), 0.37)
  add(new THREE.CylinderGeometry(0.27, 0.22, 0.08, 6), 0.66)
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    add(new THREE.BoxGeometry(0.05, 0.26, 0.05), LANTERN_LIGHT_Y, stone, x * 0.13, z * 0.13)
  }
  add(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 6), 0.98, dark)
  add(new THREE.ConeGeometry(0.4, 0.22, 6), 1.11)
  add(new THREE.SphereGeometry(0.06, 6, 4), 1.25, dark)
  const body = mergeGeometries(parts, false)!
  const core = new THREE.BoxGeometry(0.2, 0.2, 0.2)
  core.translate(0, LANTERN_LIGHT_Y, 0)
  return { body, core }
}

// --- Glow textures -------------------------------------------------------------------

/** A soft round falloff (white centre → transparent edge) for halos and pools. */
export function haloTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** An irregular soft cloud (a few overlapping blobs) for the drifting fog wisps. */
function wispTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const g = c.getContext('2d')!
  const rand = mulberry32(0x5eed)
  for (let i = 0; i < 9; i++) {
    const x = 40 + rand() * 176
    const y = 36 + rand() * 24
    const r = 22 + rand() * 30
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    grd.addColorStop(0, 'rgba(255,255,255,0.55)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 96)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function glowMaterial(map: THREE.Texture, color: THREE.ColorRepresentation, strength: number) {
  return new THREE.MeshBasicMaterial({
    map,
    color: new THREE.Color(color).multiplyScalar(strength),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  })
}

// --- Layout ------------------------------------------------------------------------

/** Lantern x positions within one tile (behind the path, evenly-ish spaced). */
const LANTERNS: Placement[] = [
  { x: 6, z: -1.9, s: 1, ry: 0.2 },
  { x: 22.5, z: -2.6, s: 1.05, ry: -0.3 },
  { x: 38, z: -1.8, s: 0.95, ry: 0.5 },
]

function layout() {
  const rand = mulberry32(0xb00)
  // Glow mushrooms hug the path edges (both sides); the first two are the ones
  // the moving cyan point lights follow.
  const mush: Placement[] = [
    { x: 14, z: -1.45, s: 1.5, ry: 0 },
    { x: 33, z: 1.5, s: 1.6, ry: 1 },
  ]
  for (let i = 2; i < K.mushrooms; i++) {
    const front = rand() < 0.35
    mush.push({
      x: rand() * SCROLL_W,
      z: front ? 1.4 + rand() * 1.6 : -1.4 - rand() * 2.4,
      s: 1.1 + rand() * 0.7,
      ry: rand() * Math.PI * 2,
    })
  }
  // Boulders behind the path; about half wear a glowing moss cap.
  const boulders = scatter(7, -1.9, -4.5, 606, 0.7, 1.3)
  const moss: Placement[] = []
  boulders.forEach((b, i) => {
    if (i % 2 === 0) moss.push({ x: b.x, z: b.z, y: 0.62 * b.s, s: b.s * 0.9, ry: b.ry })
  })
  for (let i = 0; i < 4; i++) {
    moss.push({ x: rand() * SCROLL_W, z: -1.6 - rand() * 3, y: 0.02, s: 0.5 + rand() * 0.4, ry: rand() * 6 })
  }
  // Foreground grass grows taller the nearer it is to the camera, but starts far
  // enough out (z ≥ 4) that it never covers the runner's feet.
  const grassFront = scatter(110, 4, 26, 707, 1, 1).map((p) => ({ ...p, s: 1 + (p.z - 4) * 0.07 }))
  const grassBack = scatter(90, -1.5, -6, 808, 1.6, 3.2)

  // Halos: a ground pool + a small upright glow per mushroom cluster; a big
  // warm pool + a chamber glow per lantern. Upright cards face the camera (XY).
  const mushPools = mush.map((m) => ({ x: m.x, z: m.z, y: 0.02, s: 1.8 * m.s, ry: 0 }))
  const mushGlows = mush.map((m) => ({ x: m.x, z: m.z + 0.1, y: 0.16, s: 0.9 * m.s, ry: 0 }))
  const lampPools = LANTERNS.map((l) => ({ x: l.x, z: l.z + 0.4, y: 0.02, s: 3.4, ry: 0 }))
  const lampGlows = LANTERNS.map((l) => ({ x: l.x, z: l.z + 0.3, y: LANTERN_LIGHT_Y, s: 1.5, ry: 0 }))

  // Fog wisps: big soft banks back in the grove, and low mist hugging the ground.
  const wisps: Placement[] = []
  for (let i = 0; i < 12; i++) {
    const w = 9 + rand() * 10
    wisps.push({ x: rand() * SCROLL_W, z: -4 - rand() * 14, y: 1 + rand() * 4.5, s: 1, sx: w, sy: w * (0.28 + rand() * 0.15), ry: 0 })
  }
  // Low mist stays behind the path so it never veils the runner or the stones.
  for (let i = 0; i < 8; i++) {
    const w = 10 + rand() * 8
    wisps.push({ x: rand() * SCROLL_W, z: -2 - rand() * 3, y: 0.45 + rand() * 0.3, s: 1, sx: w, sy: 1 + rand() * 0.5, ry: 0 })
  }

  return {
    bamboo: [scatter(18, -2.6, -6, 101), scatter(18, -5, -12, 202), scatter(22, -9, -22, 303)].map(tile3),
    shrubs: tile3(scatter(26, 3, 26, 404, 0.6, 1.3)),
    backShrubs: tile3(scatter(12, -2.2, -3.6, 505, 0.5, 0.9)),
    grassFront: tile3(grassFront),
    grassBack: tile3(grassBack),
    pavers: Array.from({ length: 3 * Math.round(SCROLL_W / 1.2) }, (_, i) => ({
      x: -SCROLL_W + i * 1.2,
      z: ((i * 7) % 5) * 0.08 - 0.16,
      s: 1,
      ry: ((i * 13) % 7) * 0.05 - 0.15,
    })),
    boulders: tile3(boulders),
    moss: tile3(moss),
    mush: tile3(mush),
    lanterns: tile3(LANTERNS),
    mushPools: tile3(mushPools),
    mushGlows: tile3(mushGlows),
    lampPools: tile3(lampPools),
    lampGlows: tile3(lampGlows),
    wisps: tile3(wisps),
    /** One-tile x of the anchors the point lights follow. */
    lightAnchors: {
      lamps: LANTERNS.map((l) => ({ x: l.x, y: LANTERN_LIGHT_Y + 0.05, z: l.z + 0.25 })),
      mush: mush.slice(0, 2).map((m) => ({ x: m.x, y: 0.35, z: m.z })),
    },
  }
}

/** World x of the copy of a tile-local x nearest to `centre`, given the scroll offset. */
function nearestCopy(tileX: number, offset: number, centre: number) {
  const x = tileX - offset
  return x + Math.round((centre - x) / SCROLL_W) * SCROLL_W
}

// --- Components ---------------------------------------------------------------------

/** The scrolling night grove + its glow, and the point lights that track it. */
export function NinjaScenery({ state }: { state: RefObject<NinjaState> }) {
  const group = useRef<THREE.Group>(null!)
  const wispGroup = useRef<THREE.Group>(null!)
  const lampLights = useRef<(THREE.PointLight | null)[]>([])
  const mushLights = useRef<(THREE.PointLight | null)[]>([])
  const size = useThree((s) => s.size)

  const assets = useMemo(() => {
    const halo = haloTexture()
    const wisp = wispTexture()
    const lantern = makeLantern()
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    return {
      halo,
      wisp,
      leafy: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
      stone: new THREE.MeshStandardMaterial({ color: K.paver, flatShading: true, roughness: 1 }),
      glowMush: new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: new THREE.Color(1, 1, 1).multiplyScalar(K.mushroom.glow),
        toneMapped: false,
      }),
      glowMoss: new THREE.MeshBasicMaterial({
        vertexColors: true,
        color: new THREE.Color(1, 1, 1).multiplyScalar(K.moss.glow),
        toneMapped: false,
      }),
      lampCore: new THREE.MeshBasicMaterial({
        color: new THREE.Color(K.lantern.light).multiplyScalar(K.lantern.glow),
        toneMapped: false,
      }),
      haloCyan: glowMaterial(halo, K.mushroom.color, 0.55),
      haloCyanPool: glowMaterial(halo, K.mushroom.color, 0.28),
      haloWarm: glowMaterial(halo, K.lantern.light, 0.7),
      haloWarmPool: glowMaterial(halo, K.lantern.light, 0.3),
      wispMat: new THREE.MeshBasicMaterial({
        map: wisp,
        color: K.wispColor,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
      bamboo: [makeBamboo(7, 0.11, 11), makeBamboo(9.5, 0.13, 23), makeBamboo(12, 0.15, 37)],
      shrub: tinted(makeShrub(), K.shrub),
      grass: tinted(makeGrassTuft(), K.grass),
      paver: new THREE.BoxGeometry(0.7, 0.06, 0.55),
      boulder: makeBoulder(),
      moss: makeMoss(),
      mushrooms: makeMushrooms(0x3a3),
      lanternBody: lantern.body,
      lanternCore: lantern.core,
      flat,
      card: new THREE.PlaneGeometry(1, 1),
    }
  }, [])
  useEffect(
    () => () => {
      for (const v of Object.values(assets)) {
        if (Array.isArray(v)) v.forEach((g) => g.dispose())
        else (v as { dispose?: () => void }).dispose?.()
      }
    },
    [assets],
  )
  const L = useMemo(layout, [])

  useFrame(({ clock }) => {
    const off = state.current.distance % SCROLL_W
    group.current.position.x = -off
    // Wisps drift on top of the scroll; the layout repeats every SCROLL_W, so the
    // extra offset can wrap without a seam.
    wispGroup.current.position.x = -((clock.elapsedTime * K.wispDrift) % SCROLL_W)

    // Point lights follow the anchors nearest the middle of the view.
    const centre = ninjaView(size.width / Math.max(size.height, 1)).lead
    L.lightAnchors.lamps.forEach((a, i) => {
      lampLights.current[i]?.position.set(nearestCopy(a.x, off, centre), a.y, a.z)
    })
    L.lightAnchors.mush.forEach((a, i) => {
      mushLights.current[i]?.position.set(nearestCopy(a.x, off, centre), a.y, a.z)
    })
  })

  return (
    <>
      <group ref={group}>
        {assets.bamboo.map((g, i) => (
          <Instanced key={i} geometry={g} material={assets.leafy} items={L.bamboo[i]} castShadow />
        ))}
        <Instanced geometry={assets.grass} material={assets.leafy} items={L.grassBack} />
        <Instanced geometry={assets.grass} material={assets.leafy} items={L.grassFront} />
        <Instanced geometry={assets.shrub} material={assets.leafy} items={L.shrubs} castShadow />
        <Instanced geometry={assets.shrub} material={assets.leafy} items={L.backShrubs} castShadow />
        <Instanced geometry={assets.paver} material={assets.stone} items={L.pavers} />
        <Instanced geometry={assets.boulder} material={assets.leafy} items={L.boulders} castShadow />
        <Instanced geometry={assets.moss} material={assets.glowMoss} items={L.moss} receiveShadow={false} />
        <Instanced geometry={assets.mushrooms} material={assets.glowMush} items={L.mush} receiveShadow={false} />
        <Instanced geometry={assets.lanternBody} material={assets.leafy} items={L.lanterns} castShadow />
        <Instanced geometry={assets.lanternCore} material={assets.lampCore} items={L.lanterns} receiveShadow={false} />
        <Instanced geometry={assets.flat} material={assets.haloCyanPool} items={L.mushPools} receiveShadow={false} />
        <Instanced geometry={assets.card} material={assets.haloCyan} items={L.mushGlows} receiveShadow={false} />
        <Instanced geometry={assets.flat} material={assets.haloWarmPool} items={L.lampPools} receiveShadow={false} />
        <Instanced geometry={assets.card} material={assets.haloWarm} items={L.lampGlows} receiveShadow={false} />
        <group ref={wispGroup}>
          <Instanced geometry={assets.card} material={assets.wispMat} items={L.wisps} receiveShadow={false} />
        </group>
      </group>
      {L.lightAnchors.lamps.map((_, i) => (
        <pointLight
          key={`lamp${i}`}
          ref={(l) => {
            lampLights.current[i] = l
          }}
          color={K.lantern.light}
          intensity={K.lanternLight.intensity}
          distance={K.lanternLight.distance}
          decay={2}
        />
      ))}
      {L.lightAnchors.mush.map((_, i) => (
        <pointLight
          key={`mush${i}`}
          ref={(l) => {
            mushLights.current[i] = l
          }}
          color={K.mushroomLight.color}
          intensity={K.mushroomLight.intensity}
          distance={K.mushroomLight.distance}
          decay={2}
        />
      ))}
    </>
  )
}

// --- The eye -------------------------------------------------------------------------

/** How much bigger the eye's card is than the eye itself (room for tilt + soft edges). */
const EYE_CARD = 1.4

const EYE_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vP;
  void main() {
    vP = (uv - 0.5) * ${EYE_CARD.toFixed(1)} * 2.0;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

// vP is in eye units: corner to corner is x ∈ [-1, 1]. An animal's eye — no
// white, the iris fills it: fibrous amber round a slit pupil, rusting toward a
// dark rim, hooded by a heavy upper lid. It gives off no light of its own: what
// shows is only what the two nearest lanterns / mushrooms (uLight*) reach, through a
// drifting veil of mist.
const EYE_FRAG = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  uniform vec3 uRim;
  uniform vec3 uDark;
  uniform vec3 uLight[2];
  uniform vec3 uLightColor[2];
  uniform float uLightRange[2];
  uniform float uHalf;
  uniform float uGain;
  uniform float uMist;
  uniform float uVeil;
  uniform float uTime;
  uniform vec2 uSeed;
  uniform float uFade;
  uniform float uOpen;
  uniform float uSlit;
  uniform float uTilt;
  uniform vec2 uLook;
  varying vec2 vP;

  float hash(float n) { return fract(sin(n) * 43758.5453); }
  // Value noise that repeats every \`p\` (so it wraps cleanly round the iris).
  float noise(float x, float p) {
    float i = floor(x);
    float f = fract(x);
    return mix(hash(mod(i, p)), hash(mod(i + 1.0, p)), f * f * (3.0 - 2.0 * f));
  }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + 1.0), f.x), f.y);
  }

  void main() {
    float cs = cos(uTilt), sn = sin(uTilt);
    vec2 q = vec2(cs * vP.x - sn * vP.y, sn * vP.x + cs * vP.y);

    // Lids: a flat lower one, and a heavier upper one that comes down to meet
    // it. Soft-edged — it's seen through mist, never crisply.
    float span = max(1.0 - q.x * q.x, 0.0);
    float bot = 0.3 * span;
    float top = mix(-bot, 0.44 * pow(span, 0.8), uOpen);
    float d = max(q.y - top, -bot - q.y);
    float inside = (1.0 - smoothstep(-0.13, 0.03, d)) * (1.0 - smoothstep(0.8, 1.0, abs(q.x)));

    // Iris.
    vec2 c = q - uLook;
    float r = length(c) / 0.64;
    float turn = atan(c.y, c.x) / 6.2831853 + 0.5;
    float fibre = noise(turn * 90.0, 90.0) * 0.6 + noise(turn * 290.0, 290.0) * 0.4;
    vec3 iris = mix(uColor, uRim, smoothstep(0.2, 0.95, r));
    iris *= mix(1.0, 0.6 + 0.5 * fibre, smoothstep(0.12, 0.5, r));
    iris *= 1.0 - 0.85 * smoothstep(0.7, 1.0, r);

    // Slit pupil; the collar round it is what catches light best (eyeshine).
    float slitW = uSlit * (1.0 - (c.y * c.y) / 0.27);
    float pd = abs(c.x) - slitW;
    float pupil = 1.0 - smoothstep(-0.03, 0.05, pd);
    float shine = 1.0 + 0.9 * exp(-max(pd, 0.0) * 9.0) * step(0.0, slitW);
    vec3 col = mix(iris * shine, uDark, pupil);

    // The upper lid's shadow across the top of the eye.
    col *= mix(0.25, 1.0, smoothstep(0.0, 0.26, top - q.y));

    // Light from the forest: falls off with distance from its source, so the
    // side toward the lantern shows and the rest is lost. Flickers a little.
    vec3 at = vec3(vP * uHalf, 0.0);
    float flicker = 0.82 + 0.18 * noise(uTime * 6.0 + uSeed.x, 1000.0);
    float litA = (1.0 - smoothstep(0.0, uLightRange[0], length(at - uLight[0]))) * flicker;
    float litB = (1.0 - smoothstep(0.0, uLightRange[1], length(at - uLight[1]))) * flicker;
    float lit = max(litA, litB);
    col *= (uLightColor[0] * litA + uLightColor[1] * litB) * uGain;

    // Mist drifting across it, veiling it in patches.
    vec2 w = vP * uHalf * 0.55 + uSeed;
    float mist = noise2(w + vec2(uTime * 0.35, 0.0)) * 0.65 + noise2(w * 2.3 - vec2(uTime * 0.2, uTime * 0.07)) * 0.35;
    float veil = 1.0 - uVeil * smoothstep(0.3, 0.75, mist);

    gl_FragColor = vec4(col, inside * smoothstep(0.0, 0.22, lit) * veil * uFade);
    #include <colorspace_fragment>
    #include <fog_fragment>
    // …and a standing share of fog on top of what its depth gives it.
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, uMist);
  }
`

const between = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a)

/** Seconds for the lids to part when it appears, and to shut when it goes. */
const EYE_OPEN = 0.5
const EYE_SHUT = 0.12
const BLINK_SHUT = 0.06
const BLINK_OPEN = 0.13

const tintScratch = new THREE.Color()

/** The forest's lights within one tile: where they are and what they throw. */
function eyeLights() {
  const E = K.eye
  const lamps = LANTERNS.map((l) => ({
    x: l.x,
    y: LANTERN_LIGHT_Y,
    z: l.z,
    color: K.lantern.light as string,
    range: E.lanternRange as number,
  }))
  const mush = layout()
    .mush.filter((m) => m.x >= 0 && m.x < SCROLL_W && m.z < 0)
    .map((m) => ({ x: m.x, y: 0.2, z: m.z, color: K.mushroom.color as string, range: E.mushroomRange as number }))
  return [...lamps, ...mush]
}

/**
 * The eye in the grove (config: NINJA_NIGHT.eye). Something big, far back among
 * the bamboo, watching him and trying not to be seen. It gives off no light: it
 * only shows where a lantern or a glow-mushroom cluster happens to reach it —
 * lit from below, in that light's colour, falling off into nothing — behind a
 * drifting veil of mist. It stays put in the grove (it scrolls by with the
 * trees, never with him), wherever it happens to be standing: often a stalk or
 * a crown of leaves is in front of part of it. Each time it's a glimpse: the
 * lids part beside some light ahead, hold a moment (the pupil narrowing on
 * him), then shut.
 */
export function NinjaEye({ state }: { state: RefObject<NinjaState> }) {
  const E = K.eye
  const mesh = useRef<THREE.Mesh>(null!)
  const size = useThree((s) => s.size)
  const lights = useMemo(eyeLights, [])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: EYE_VERT,
        fragmentShader: EYE_FRAG,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uColor: { value: new THREE.Color(E.color) },
            uRim: { value: new THREE.Color(E.rim) },
            uDark: { value: new THREE.Color(E.dark) },
            uLight: { value: [new THREE.Vector3(), new THREE.Vector3()] },
            uLightColor: { value: [new THREE.Color(), new THREE.Color()] },
            uLightRange: { value: [1, 1] },
            uHalf: { value: E.width / 2 },
            uGain: { value: E.gain },
            uMist: { value: E.mist },
            uVeil: { value: E.veil },
            uTime: { value: 0 },
            uSeed: { value: new THREE.Vector2() },
            uFade: { value: 0 },
            uOpen: { value: 0 },
            uSlit: { value: E.slit[0] },
            uTilt: { value: 0 },
            uLook: { value: new THREE.Vector2() },
          },
        ]),
        fog: true,
        transparent: true,
        depthWrite: false,
      }),
    [E],
  )
  useEffect(() => () => material.dispose(), [material])

  const sim = useRef({
    shown: false,
    /** Seconds to the next glimpse (while hidden). */
    wait: E.first as number,
    /** Seconds into this glimpse, and how long it stays open. */
    t: 0,
    hold: 0,
    /** Seconds into a blink (-1 = none) and when (in `t`) this glimpse blinks, if it does. */
    blinkT: -1,
    blinkAt: -1,
    /** Where the pupil is flicking to, and seconds until it flicks again. */
    lookX: 0,
    lookY: 0,
    nextLook: 0,
    lastDistance: 0,
  })

  // Dev handle: `__eye.show()` opens one now; `__eye.hold = true` keeps it open and still.
  const dev = useRef({ hold: false })
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__eye = Object.assign(dev.current, {
      show: () => {
        sim.current.shown = false
        sim.current.wait = 0
      },
      sim: () => sim.current,
      mesh: () => mesh.current,
    })
    return () => {
      delete w.__eye
    }
  }, [])

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05)
    const e = sim.current
    const u = material.uniforms
    const view = ninjaView(size.width / Math.max(size.height, 1))
    const m = mesh.current
    const held = import.meta.env.DEV && dev.current.hold
    u.uTime.value = clock.elapsedTime

    // It stands in the grove, so it scrolls by with it (a retry resets distance:
    // ignore the jump back).
    const run = Math.max(0, state.current.distance - e.lastDistance)
    e.lastDistance = state.current.distance

    if (!e.shown) {
      e.wait -= dt
      m.visible = false
      if (e.wait > 0) return
      // It can only be seen by a light: take one that's ahead of him now (none
      // there → try again next frame).
      const off = state.current.distance % SCROLL_W
      const [a0, a1] = E.ahead
      const ahead = lights
        .map((l) => nearestCopy(l.x, off, view.lead + ((a0 + a1) / 2) * view.halfX))
        .filter((x) => x > view.lead + a0 * view.halfX && x < view.lead + a1 * view.halfX)
      if (!ahead.length) return
      const lightX = ahead[Math.floor(Math.random() * ahead.length)]

      e.shown = true
      e.t = 0
      e.hold = between(E.glimpse)
      e.blinkT = -1
      e.blinkAt = Math.random() < E.blinkChance ? EYE_OPEN + Math.random() * e.hold * 0.6 : -1
      e.nextLook = 0
      // Far back among the bamboo and high up (it's a big animal), a little to
      // one side of the light. A new size and slant each time.
      const s = between(E.scale)
      m.position.set(lightX + (Math.random() < 0.5 ? -1 : 1) * between(E.lag), between(E.y), between(E.z))
      m.scale.setScalar(s)
      u.uHalf.value = (E.width / 2) * s
      u.uSeed.value.set(Math.random() * 50, Math.random() * 50)
      u.uTilt.value = (Math.random() - 0.5) * 2 * E.tilt
      u.uSlit.value = E.slit[0]
      u.uLook.value.set(0, 0)
    }

    if (held) e.t = Math.min(e.t + dt, EYE_OPEN + e.hold)
    else {
      e.t += dt
      // It stays where it is in the grove, so it scrolls by with the trees.
      m.position.x -= run
    }
    const shutAt = EYE_OPEN + e.hold
    const edge = view.halfX + (E.width * m.scale.x) / 2
    if (e.t > shutAt + EYE_SHUT || m.position.x < view.lead - edge) {
      e.shown = false
      e.wait = Math.random() < E.again ? between(E.againGap) : between(E.gap)
      m.visible = false
      return
    }
    m.visible = true

    // Lids: part slowly, snap shut; maybe one blink in between.
    let open =
      e.t < EYE_OPEN ? THREE.MathUtils.smoothstep(e.t / EYE_OPEN, 0, 1)
      : e.t > shutAt ? 1 - (e.t - shutAt) / EYE_SHUT
      : 1
    if (e.blinkT < 0 && e.blinkAt >= 0 && e.t >= e.blinkAt && e.t < shutAt) {
      e.blinkT = 0
      e.blinkAt = -1
    }
    if (e.blinkT >= 0) {
      e.blinkT += dt
      const b = e.blinkT
      open *= b < BLINK_SHUT ? 1 - b / BLINK_SHUT : THREE.MathUtils.smoothstep((b - BLINK_SHUT) / BLINK_OPEN, 0, 1)
      if (b > BLINK_SHUT + BLINK_OPEN) e.blinkT = -1
    }
    u.uOpen.value = open
    // Gone at the screen's edges.
    const fromEdge = (edge - Math.abs(m.position.x - view.lead)) / (2 * edge)
    u.uFade.value =
      E.opacity * THREE.MathUtils.smoothstep(e.t, 0, EYE_OPEN * 0.6) * THREE.MathUtils.smoothstep(fromEdge, 0.03, 0.14)

    // What reaches it right now: the two lights that light it most. (Depth
    // counts for less — the light carries back through the stalks.)
    const off = state.current.distance % SCROLL_W
    let best = [-1, -1]
    let bestLit = [0, 0]
    lights.forEach((l, i) => {
      const dx = nearestCopy(l.x, off, m.position.x) - m.position.x
      const lit = 1 - Math.hypot(dx, l.y - m.position.y, (l.z - m.position.z) * E.depthFade) / l.range
      if (lit > bestLit[0]) {
        best = [i, best[0]]
        bestLit = [lit, bestLit[0]]
      } else if (lit > bestLit[1]) {
        best[1] = i
        bestLit[1] = lit
      }
    })
    best.forEach((i, slot) => {
      if (i < 0) {
        u.uLightRange.value[slot] = 0.0001
        return
      }
      const l = lights[i]
      const x = nearestCopy(l.x, off, m.position.x)
      u.uLight.value[slot].set(x - m.position.x, l.y - m.position.y, (l.z - m.position.z) * E.depthFade)
      u.uLightColor.value[slot].set('#ffffff').lerp(tintScratch.set(l.color), E.tint)
      u.uLightRange.value[slot] = l.range
    })

    // The pupil narrows as it fixes on him (x = 0, down on the path), and
    // flicks about in small jumps round that.
    u.uSlit.value += (E.slit[1] - u.uSlit.value) * Math.min(1, dt * 4)
    e.nextLook -= dt
    if (e.nextLook <= 0) {
      e.nextLook = 0.25 + Math.random() * 0.7
      const toward = THREE.MathUtils.clamp(-m.position.x / 10, -1, 1)
      e.lookX = toward * E.gaze + (Math.random() - 0.5) * 2 * E.dart
      e.lookY = -E.gaze * 0.25 + (Math.random() - 0.5) * E.dart * 0.4
    }
    const k = Math.min(1, dt * 28)
    u.uLook.value.x += (e.lookX - u.uLook.value.x) * k
    u.uLook.value.y += (e.lookY - u.uLook.value.y) * k
  })

  const w = E.width * EYE_CARD
  return (
    <mesh ref={mesh} material={material} visible={false} renderOrder={1}>
      <planeGeometry args={[w, w]} />
    </mesh>
  )
}

/** Far backdrop: near-black teal at the top, fading to the fog colour at the horizon. */
export function NinjaSky() {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(260, 140, 1, 12)
    const top = new THREE.Color(K.skyTop)
    const low = new THREE.Color(K.fog)
    const pos = g.attributes.position
    const col = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.smoothstep(pos.getY(i), -55, 0)
      c.copy(low).lerp(top, t).toArray(col, i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  useEffect(() => () => geom.dispose(), [geom])
  return (
    <mesh geometry={geom} position={[0, 55, -70]} renderOrder={-1}>
      {/* Not tone-mapped: three applies fog after tone mapping, so the fogged
          grove reaches the raw fog colour — tone-mapping the sky too left a
          visible band where it met the horizon. */}
      <meshBasicMaterial vertexColors fog={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Night rig: dim cold ambient + hemisphere, moonlight from behind (shadows), a barely-there front fill, and the fog. */
export function NinjaNight() {
  const moon = useRef<THREE.DirectionalLight>(null!)
  useShadowDispose(moon)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const prevFog = scene.fog
    scene.fog = new THREE.Fog(K.fog, N.camDist + K.fogNear, N.camDist + K.fogFar)
    return () => {
      scene.fog = prevFog
    }
  }, [scene])
  return (
    <>
      <ambientLight intensity={K.ambient.intensity} color={K.ambient.color} />
      <hemisphereLight args={[K.hemisphere.sky, K.hemisphere.ground, K.hemisphere.intensity]} />
      <directionalLight position={[...K.fill.position]} intensity={K.fill.intensity} color={K.fill.color} />
      <directionalLight
        ref={moon}
        position={[...K.moon.position]}
        intensity={K.moon.intensity}
        color={K.moon.color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  )
}
