import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { FOREST, type ForestLayer } from '../../config/forest'
import { forestFrame, forestView, rateAt } from '../../systems/forestView'
import { forestTouch, isTypingTarget } from '../../systems/input'
import { IS_MOBILE } from '../../systems/device'
import { useGame } from '../../state/store'
import { useAnimations } from '@react-three/drei'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { NINJA_RUN as N } from '../../config/arcade'
import type { AirStep } from '../../arcade/ninjarun'
import { AirSteps } from '../arcade/airSteps'
import { obstaclesIn, type ObstacleKind } from './forestObstacles'
import {
  TRUNK_H,
  TRUNK_R,
  crownGeometry,
  fernGeometry,
  glowTexture,
  hash3,
  prep,
  rockGeometry,
  shaftTexture,
  trunkGeometry,
  frondTexture,
  grassGeometry,
  grassTexture,
  foregroundTexture,
  pathTexture,
  pathDirt,
  PATH_TILE,
} from './forestAssets'
import { forestPaintFog, paint } from './paint'
import { CharacterMask, CHARACTER_LAYER } from './CharacterMask'
import { WispGuide } from './Wisps'
import { playForestSfx, startForestAmbience, type ForestSound } from './forestSfx'
import { FOREST_ENCOUNTER, forestSceneryHalf, inForestClearing } from '../../config/forestEncounter'
import { forestReveal, useForestEncounter } from '../../state/forestEncounter'
import { ForestEncounter } from './ForestEncounter'
import { ForestStones } from './ForestStones'
import { ForestHollow } from './ForestHollow'
import { FOREST_OPENING as O, forestFloorAt, constrainForestHollowX, inForestHollow } from '../../config/forestOpening'
import { advanceForestOpening, noteForestDoubleJump, resetForestOpening, useForestOpening } from '../../state/forestOpening'

/**
 * The forest walk: an endless side-on stroll through tall pines (see
 * config/forest.ts). Leonard walks along the path at z = 0; the camera
 * (OrthoRig's forest branch) slides after him. Trees are placed by hashing
 * their slot index, so the forest is endless both ways and the same tree is
 * always in the same place when you walk back.
 */

const P = FOREST.palette
const VARIANTS = 3
/** Widest half-view the instance pools are sized for (ultrawide + margin). */
const MAX_HALF = 42
const MARGIN = 4

const lerp = THREE.MathUtils.lerp

// --- Atmosphere ------------------------------------------------------------------

const SUN_DIR = new THREE.Vector3(...FOREST.light.sunDir).normalize()

function Atmosphere() {
  // Behind everything: the haze itself (see Backdrop). The clear colour is
  // only ever seen through gaps above it.
  // Fog goes on the scene itself (a <fog attach> here would land on a group).
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const prev = { background: scene.background, fog: scene.fog }
    scene.background = new THREE.Color(P.fog)
    scene.fog = new THREE.Fog(P.fog, FOREST.camDist + FOREST.fogNear, FOREST.camDist + FOREST.fogFar)
    return () => {
      scene.background = prev.background
      scene.fog = prev.fog
    }
  }, [scene])

  // The sun's shadow box rides along with the walker (like the town's SunRig).
  const sun = useRef<THREE.DirectionalLight>(null!)
  useFrame(({ camera, size }) => {
    const x = forestView.walkerX
    if (scene.fog instanceof THREE.Fog) {
      const distance = Math.hypot(camera.position.x - x, camera.position.y, camera.position.z)
      scene.fog.near = distance + FOREST.fogNear
      scene.fog.far = distance + FOREST.fogFar
      // Match the side view's depth haze rather than giving the low shot a new
      // fog distribution. Its lighting and painted materials stay the same.
      const pitch = THREE.MathUtils.degToRad(FOREST.pitchDeg)
      const lookY = forestFrame(size.width / Math.max(size.height, 1)).lookY
      const sideDistance = Math.hypot(lookY + Math.sin(pitch) * FOREST.camDist, Math.cos(pitch) * FOREST.camDist)
      const sideOffset = FOREST.camDist - sideDistance + lookY * Math.sin(pitch)
      forestPaintFog.value.set(forestReveal.perspective ? 1 : 0, distance + sideOffset)
    }
    sun.current.position.set(x + SUN_DIR.x * 40, SUN_DIR.y * 40, SUN_DIR.z * 40)
    sun.current.target.position.set(x, 0, 0)
    sun.current.target.updateMatrixWorld()
  })

  const L = FOREST.light
  return (
    <>
      <hemisphereLight args={[L.hemiSky, L.hemiGround, L.hemi]} />
      <ambientLight intensity={L.ambient} />
      <directionalLight
        ref={sun}
        intensity={L.sun}
        color={L.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={6}
        shadow-blurSamples={16}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  )
}

/** The canopy's leaf pattern, one seamless tile: white = leaves (blocks the
 *  sun), black = a gap. Gaps come in loose clusters, like real breaks in the
 *  crowns, sized so about `open` of the sky shows. Read as an alphaMap. */
function canopyTexture(open: number): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, S, S)
  const hole = (x: number, y: number, r: number) => {
    // Drawn 9× round the tile so a gap crossing an edge wraps seamlessly.
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        const grd = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
        grd.addColorStop(0, 'rgba(0,0,0,1)')
        grd.addColorStop(0.6, 'rgba(0,0,0,0.8)')
        grd.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grd
        g.beginPath()
        g.arc(x + dx, y + dy, r, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  // Each cluster: one larger break with a few smaller flecks of light round it.
  const clusters = Math.round(open * 40)
  for (let k = 0; k < clusters; k++) {
    const x = hash3(k, 1, 70) * S
    const y = hash3(k, 2, 70) * S
    hole(x, y, 9 + hash3(k, 3, 70) * 14)
    const flecks = 2 + Math.floor(hash3(k, 4, 70) * 4)
    for (let f = 0; f < flecks; f++) {
      const a = hash3(k, f, 71) * Math.PI * 2
      const d = 10 + hash3(k, f, 72) * 22
      hole(x + Math.cos(a) * d, y + Math.sin(a) * d, 3 + hash3(k, f, 73) * 6)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/**
 * The canopy: a flat sheet of leaves high overhead that nobody sees — it
 * writes no colour or depth on screen, but the shadow pass (which uses its own
 * depth material, honouring the alphaMap holes) still draws it — so it shades the forest,
 * so sunlight reaches the floor (and the trunks) in scattered dapples. It's
 * snapped to whole tiles as the camera moves, so the pattern stays put in the
 * world and the pools don't slide.
 */
function Canopy() {
  const mesh = useRef<THREE.Mesh>(null!)
  const C = FOREST.canopy
  const W = 240
  const D = 90
  const assets = useMemo(() => {
    const tex = canopyTexture(C.open)
    tex.repeat.set(W / C.tile[0], D / C.tile[1])
    const mat = new THREE.MeshBasicMaterial({
      alphaMap: tex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      colorWrite: false,
      depthWrite: false,
    })
    const geom = new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2)
    return { tex, mat, geom }
  }, [C])
  useEffect(
    () => () => {
      for (const v of Object.values(assets)) v.dispose()
    },
    [assets],
  )
  useFrame(() => {
    mesh.current.position.x = Math.round(forestView.camX / C.tile[0]) * C.tile[0]
  })
  return (
    <mesh
      ref={mesh}
      geometry={assets.geom}
      material={assets.mat}
      position={[0, C.y, -15]}
      castShadow
    />
  )
}

/** A wall of haze far behind the last trees, drawn through the same fog, so
 *  the distance dissolves into exactly the fog colour (no horizon line). */
function Backdrop() {
  const mesh = useRef<THREE.Mesh>(null!)
  useFrame(() => {
    mesh.current.position.x = forestView.camX
  })
  return (
    <mesh ref={mesh} position={[0, 20, -90]}>
      <planeGeometry args={[400, 120]} />
      <meshBasicMaterial color={P.fog} />
    </mesh>
  )
}

/** The worn rim either side of the bare dirt (u), and the path strip's length. */
const PATH_EDGE = 0.35
const PATH_W = 220

// --- Ground ------------------------------------------------------------------------

/** The forest floor and the trodden path. Both ride along under the camera;
 *  the path's pattern (pathTexture: bare dirt, patchy, grown over) scrolls
 *  with the world. */
function Ground() {
  const group = useRef<THREE.Group>(null!)
  useFrame(() => {
    group.current.position.x = forestView.camX
  })
  const half = FOREST.pathHalf
  // Painted in world space, so the brushwork stays put while the planes slide
  // along under the camera.
  const mats = useMemo(() => {
    const map = pathTexture(half, PATH_EDGE, P.path, P.pathEdge)
    map.repeat.x = PATH_W / PATH_TILE
    const cut = (mat: THREE.MeshStandardMaterial, key: string) => {
      const compile = mat.onBeforeCompile.bind(mat)
      mat.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer)
        shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
          #include <clipping_planes_fragment>
          float hollowAcross = (vPaintPos.x - ${((O.gap.left + O.gap.right) / 2).toFixed(3)}) / ${((O.gap.right - O.gap.left) / 2).toFixed(3)};
          float hollowBack = ${O.gap.back.toFixed(3)} + 1.2 * min(1.35, hollowAcross * hollowAcross);
          if (vPaintPos.x > ${O.gap.left.toFixed(3)} && vPaintPos.x < ${O.gap.right.toFixed(3)}
            && vPaintPos.z > hollowBack && vPaintPos.z < ${O.gap.front.toFixed(3)}) discard;
        `)
      }
      mat.customProgramCacheKey = () => 'forest-hollow-eroded-' + key
      return mat
    }
    return {
      ground: cut(paint(new THREE.MeshStandardMaterial({ color: P.ground, roughness: 1 }), 'ground'), 'ground'),
      path: cut(paint(new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 1 }), 'leaf'), 'path'),
    }
  }, [half])
  useEffect(
    () => () => {
      mats.path.map?.dispose()
      for (const m of Object.values(mats)) m.dispose()
    },
    [mats],
  )
  useFrame(() => {
    mats.path.map!.offset.x = (forestView.camX - PATH_W / 2) / PATH_TILE
  })
  return (
    <>
      <Suspense fallback={null}>
        <ForestHollow />
      </Suspense>
      <group ref={group}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -20]} material={mats.ground} receiveShadow>
          <planeGeometry args={[220, 130]} />
        </mesh>
        {/* The path with its worn rim, where the grass gives way to dirt. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} material={mats.path} receiveShadow>
          <planeGeometry args={[PATH_W, (half + PATH_EDGE) * 2]} />
        </mesh>
      </group>
    </>
  )
}

// --- Trees + understory -----------------------------------------------------------------

interface Assets {
  trunks: THREE.BufferGeometry[]
  crowns: THREE.BufferGeometry[]
  fern: THREE.BufferGeometry
  rock: THREE.BufferGeometry
  crownMat: THREE.Material
  fernMat: THREE.Material
  rockMat: THREE.Material
  grass: THREE.BufferGeometry
  grassMat: THREE.Material
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Write instance `n` of `mesh`. */
function put(mesh: THREE.InstancedMesh, n: number, x: number, z: number, rotY: number, sx: number, sy: number, sz: number) {
  _p.set(x, 0, z)
  _q.setFromAxisAngle(_up, rotY)
  _s.set(sx, sy, sz)
  _m.compose(_p, _q, _s)
  mesh.setMatrixAt(n, _m)
}

/**
 * One depth band. Its group slides by camX·(1 − rate), so it scrolls past at
 * `rate` of the path's pace; inside it, slot i (every `every` u) holds the same
 * hashed tree / ferns / rock every time it comes into view.
 */
function TreeBand({ li, layer, assets }: { li: number; layer: ForestLayer; assets: Assets }) {
  const size = useThree((s) => s.size)
  const group = useRef<THREE.Group>(null!)
  const trunkRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const crownRefs = useRef<(THREE.InstancedMesh | null)[]>([])
  const fernRef = useRef<THREE.InstancedMesh>(null!)
  const rockRef = useRef<THREE.InstancedMesh>(null!)
  const range = useRef('')

  const zMid = (layer.z[0] + layer.z[1]) / 2
  const rate = rateAt(zMid)
  const slots = Math.ceil((2 * (MAX_HALF + MARGIN)) / layer.every) + 4
  // Near the path, trunks throw shadows across it; further back nobody sees them.
  const castShadow = Math.abs(zMid) < 6
  const barkMat = useMemo(
    () => paint(new THREE.MeshStandardMaterial({ color: layer.bark, flatShading: true, roughness: 0.95 }), 'bark'),
    [layer.bark],
  )
  useEffect(() => () => barkMat.dispose(), [barkMat])

  useFrame(() => {
    const camX = forestView.camX
    group.current.position.x = camX * (1 - rate)
    // Visible stretch in the band's own coordinates.
    const half = forestSceneryHalf(camX, forestFrame(size.width / Math.max(size.height, 1)).halfX) + MARGIN
    const centre = camX * rate
    const i0 = Math.floor((centre - half) / layer.every) - 1
    const i1 = Math.ceil((centre + half) / layer.every) + 1
    const key = `${i0}|${i1}`
    if (key === range.current) return
    range.current = key

    const tc = new Array(VARIANTS).fill(0)
    let fc = 0
    let rc = 0
    for (let i = i0; i <= i1; i++) {
      const r = (salt: number) => hash3(i, li, salt)
      const slotX = (i + 0.15 + 0.7 * r(2)) * layer.every + camX * (1 - rate)
      const slotZ = lerp(layer.z[0], layer.z[1], r(3))
      if (inForestClearing(slotX, slotZ)) continue
      if (r(0) < layer.fill) {
        const v = Math.floor(r(1) * VARIANTS)
        const x = (i + 0.15 + 0.7 * r(2)) * layer.every
        const z = lerp(layer.z[0], layer.z[1], r(3))
        const radius = lerp(layer.radius[0], layer.radius[1], r(4))
        const height = lerp(layer.height[0], layer.height[1], r(5))
        const rotY = r(6) * Math.PI * 2
        const sr = radius / TRUNK_R
        const sh = height / TRUNK_H
        const tm = trunkRefs.current[v]
        if (tm && tc[v] < slots) put(tm, tc[v], x, z, rotY, sr, sh, sr)
        const cm = crownRefs.current[v]
        if (cm && tc[v] < slots) {
          const cs = 0.8 + 0.45 * r(7)
          put(cm, tc[v], x, z, rotY, cs, sh, cs)
        }
        tc[v]++
      }
      // Ferns round the slot, sometimes a rock.
      const ferns = Math.floor(r(8) * 3)
      for (let k = 0; k < ferns && fc < slots * 2; k++) {
        const x = (i + r(10 + k)) * layer.every
        const z = lerp(layer.z[0] - 1, layer.z[1] + 1, r(20 + k))
        if (inForestHollow(x + camX * (1 - rate), z, 0.8)) continue
        const s = 0.8 + r(30 + k) * 0.6
        put(fernRef.current, fc++, x, z, r(40 + k) * 6.28, s, s * (0.8 + r(45 + k) * 0.5), s)
      }
      if (r(50) < 0.22 && rc < slots) {
        const x = (i + r(51)) * layer.every
        const z = lerp(layer.z[0], layer.z[1], r(52))
        if (inForestHollow(x + camX * (1 - rate), z, 0.8)) continue
        const s = 0.7 + r(53) * 0.9
        put(rockRef.current, rc++, x, z, r(54) * 6.28, s, s, s)
      }
    }
    for (let v = 0; v < VARIANTS; v++) {
      for (const m of [trunkRefs.current[v], crownRefs.current[v]]) {
        if (!m) continue
        m.count = Math.min(tc[v], slots)
        m.instanceMatrix.needsUpdate = true
        m.computeBoundingSphere()
      }
    }
    fernRef.current.count = fc
    fernRef.current.instanceMatrix.needsUpdate = true
    fernRef.current.computeBoundingSphere()
    rockRef.current.count = rc
    rockRef.current.instanceMatrix.needsUpdate = true
    rockRef.current.computeBoundingSphere()
  })

  return (
    <group ref={group}>
      {assets.trunks.map((g, v) => (
        <instancedMesh
          key={`t${v}`}
          ref={(m) => {
            trunkRefs.current[v] = m
          }}
          args={[g, barkMat, slots]}
          castShadow={castShadow}
          receiveShadow
          frustumCulled={false}
        />
      ))}
      {layer.boughs &&
        assets.crowns.map((g, v) => (
          <instancedMesh
            key={`c${v}`}
            ref={(m) => {
              crownRefs.current[v] = m
            }}
            args={[g, assets.crownMat, slots]}
            castShadow={castShadow}
            frustumCulled={false}
          />
        ))}
      <instancedMesh
        ref={fernRef}
        args={[assets.fern, assets.fernMat, slots * 2]}
        receiveShadow
        frustumCulled={false}
      />
      <instancedMesh
        ref={rockRef}
        args={[assets.rock, assets.rockMat, slots]}
        receiveShadow
        castShadow={castShadow}
        frustumCulled={false}
      />
    </group>
  )
}

/** Ferns and stones along the far side of the path, scrolling with it. */
function Understory({ assets }: { assets: Assets }) {
  const size = useThree((s) => s.size)
  const fernRef = useRef<THREE.InstancedMesh>(null!)
  const rockRef = useRef<THREE.InstancedMesh>(null!)
  const range = useRef('')
  const U = FOREST.understory
  const slots = Math.ceil((2 * (MAX_HALF + MARGIN)) / U.every) + 4

  useFrame(() => {
    const camX = forestView.camX
    const half = forestSceneryHalf(camX, forestFrame(size.width / Math.max(size.height, 1)).halfX) + MARGIN
    const i0 = Math.floor((camX - half) / U.every) - 1
    const i1 = Math.ceil((camX + half) / U.every) + 1
    const key = `${i0}|${i1}`
    if (key === range.current) return
    range.current = key
    let fc = 0
    let rc = 0
    for (let i = i0; i <= i1; i++) {
      const r = (salt: number) => hash3(i, 99, salt)
      if (r(0) > U.fill) continue
      const x = (i + r(1)) * U.every
      const z = lerp(U.z[0], U.z[1], r(3))
      if (inForestClearing(x, z)) continue
      if (r(4) < 0.82) {
        const s = 0.5 + r(5) * 0.7
        put(fernRef.current, fc++, x, z, r(6) * 6.28, s, s * (0.7 + r(7) * 0.6), s)
      } else {
        const s = 0.35 + r(5) * 0.5
        put(rockRef.current, rc++, x, z, r(6) * 6.28, s, s, s)
      }
    }
    fernRef.current.count = fc
    fernRef.current.instanceMatrix.needsUpdate = true
    fernRef.current.computeBoundingSphere()
    rockRef.current.count = rc
    rockRef.current.instanceMatrix.needsUpdate = true
    rockRef.current.computeBoundingSphere()
  })
  return (
    <>
      <instancedMesh ref={fernRef} args={[assets.fern, assets.fernMat, slots]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={rockRef} args={[assets.rock, assets.rockMat, slots]} castShadow receiveShadow frustumCulled={false} />
    </>
  )
}

function useForestAssets(): Assets {
  const assets = useMemo<Assets>(() => {
    const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, ...extra })
    return {
      trunks: Array.from({ length: VARIANTS }, (_, v) => trunkGeometry(v)),
      crowns: Array.from({ length: VARIANTS }, (_, v) => crownGeometry(v)),
      fern: fernGeometry(),
      rock: rockGeometry(),
      // The fronds carry their own painted colour; alphaTest cuts the feathery
      // edge (and the shadow pass honours it too).
      crownMat: paint(
        new THREE.MeshStandardMaterial({
          map: frondTexture(),
          // Cool teal over the painted greens: dark boughs, lit tips (the reference).
          color: '#7a9e92',
          alphaTest: 0.45,
          side: THREE.DoubleSide,
          roughness: 0.9,
        }),
        'leaf',
      ),
      fernMat: paint(std(P.fern, { side: THREE.DoubleSide }), 'leaf'),
      rockMat: paint(std(P.rock), 'stone'),
      grass: grassGeometry(),
      grassMat: paint(
        new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 }),
        'leaf',
      ),
    }
  }, [])
  useEffect(
    () => () => {
      for (const v of Object.values(assets)) {
        if (Array.isArray(v)) v.forEach((g) => g.dispose())
        else v.dispose()
      }
    },
    [assets],
  )
  return assets
}

/**
 * Lush grass: tufts packed along the far side of the path and back under the
 * trees, lime where the light lands (Leonard's reference is carpeted in it).
 * Parallaxed by depth in a few bands, so near tufts slide past faster.
 */
const GRASS_BANDS = 3
function Grass({ assets }: { assets: Assets }) {
  const size = useThree((s) => s.size)
  const G = FOREST.grass
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const groups = useRef<(THREE.Group | null)[]>([])
  const ranges = useRef<string[]>([])
  const bands = useMemo(
    () => [
      ...Array.from({ length: GRASS_BANDS }, (_, b) => {
        const z0 = lerp(G.z[0], G.z[1], b / GRASS_BANDS)
        const z1 = lerp(G.z[0], G.z[1], (b + 1) / GRASS_BANDS)
        return { z0, z1, rate: rateAt((z0 + z1) / 2), path: false }
      }),
      // Short grass on the path itself wherever it's grown over (pathDirt).
      // Exactly the path's pace, so it stays put on the dirt pattern.
      { z0: -G.pathHalf, z1: FOREST.pathHalf, rate: 1, path: true },
    ],
    [G],
  )
  const slots = Math.ceil((2 * (MAX_HALF + MARGIN)) / G.every) + 8
  useFrame(() => {
    const camX = forestView.camX
    const half = forestSceneryHalf(camX, forestFrame(size.width / Math.max(size.height, 1)).halfX) + MARGIN
    bands.forEach((band, b) => {
      const grp = groups.current[b]
      const m = refs.current[b]
      if (!grp || !m) return
      grp.position.x = camX * (1 - band.rate)
      const centre = camX * band.rate
      const i0 = Math.floor((centre - half) / G.every) - 1
      const i1 = Math.ceil((centre + half) / G.every) + 1
      const key = `${i0}|${i1}`
      if (ranges.current[b] === key) return
      ranges.current[b] = key
      let n = 0
      for (let i = i0; i <= i1 && n < slots; i++) {
        const r = (salt: number) => hash3(i, 300 + b, salt)
        if (r(0) > G.fill) continue
        const z = lerp(band.z0, band.z1, r(1))
        const x = (i + r(3)) * G.every
        if (inForestHollow(x + camX * (1 - band.rate), z, 0.35)) continue
        if (band.path) {
          // Only off the bare dirt, and kept short so his legs still show.
          if (Math.abs(z) < FOREST.pathHalf * pathDirt(x) + 0.12) continue
          const sc = 0.3 + r(2) * 0.3
          put(m, n++, x, z, r(4) * 6.28, sc * (0.9 + r(5) * 0.6), sc, sc)
          continue
        }
        if (Math.abs(z) < G.pathHalf) continue // not on the trodden path
        const sc = 0.55 + r(2) * 0.75
        put(m, n++, x, z, r(4) * 6.28, sc * (0.9 + r(5) * 0.6), sc, sc)
      }
      m.count = n
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    })
  })
  return (
    <>
      {bands.map((_, b) => (
        <group
          key={b}
          ref={(g) => {
            groups.current[b] = g
          }}
        >
          <instancedMesh
            ref={(m) => {
              refs.current[b] = m
            }}
            args={[assets.grass, assets.grassMat, slots]}
            receiveShadow
            frustumCulled={false}
          />
        </group>
      ))}
    </>
  )
}

// --- Foreground -------------------------------------------------------------------------------

/**
 * The foreground: one near-black cut-out strip nearest the lens (see
 * FOREST.foreground). It's a single camera-facing plane well in front of the
 * path — far enough forward that it sits above the ground wherever it shows,
 * so nothing can draw in front of it — riding along with the camera; the
 * pattern itself scrolls at `rate`. No fog, no light: it stays dark. Its
 * brushwork is baked into the tile (world-space paint would swim, since the
 * pattern outruns the world). Like Leonard it skips the brush filter
 * (CHARACTER_LAYER), which melts its fronds and blades into lumps, so its
 * edges stay crisp cut-paper, as in the reference.
 */
const FG_DIST = 25
/** How far below the path the strip reaches (well past the frame's bottom). */
const FG_DEPTH = 12
function Foreground() {
  const F = FOREST.foreground
  const mesh = useRef<THREE.Mesh>(null!)
  const width = 2 * (MAX_HALF + MARGIN)
  const assets = useMemo(() => {
    const { tex, top, bottom } = foregroundTexture(F)
    // The tile covers [bottom, top]; the rest of the plane below clamps to the
    // tile's solid bottom row.
    const H = top + FG_DEPTH
    tex.wrapS = THREE.RepeatWrapping
    tex.repeat.set(width / F.tile, H / (top - bottom))
    tex.offset.y = 1 - tex.repeat.y
    const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, fog: false })
    // Its "keep crisp" mask (CharacterMask) only where it's solid.
    const mask = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 })
    // The same cut in the visible and crisp-mask passes keeps the lower
    // hollow readable without hiding the entire foreground on approach.
    for (const material of [mat, mask]) {
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vOpeningX;\nvarying float vOpeningY;')
          .replace('#include <project_vertex>', `#include <project_vertex>
            vOpeningX = (modelMatrix * vec4(position, 1.0)).x;
            vOpeningY = (modelMatrix * vec4(position, 1.0)).y;`)
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vOpeningX;\nvarying float vOpeningY;')
          // Only the opening stays in world space. All foreground foliage
          // shares one scrolling texture; the terrain mesh supplies the rim.
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            float openingFray = 0.12 * sin(vOpeningY * 4.3) + 0.06 * sin(vOpeningY * 9.0);
            if (vOpeningX > ${(O.gap.left - 0.1).toFixed(3)} + openingFray
              && vOpeningX < ${(O.gap.right + 0.1).toFixed(3)} - openingFray) discard;`)
      }
      material.customProgramCacheKey = () => 'forest-opening-foreground-scrolling'
    }
    const geom = new THREE.PlaneGeometry(width, H).translate(0, (top - FG_DEPTH) / 2, 0)
    return { tex, mat, mask, geom }
  }, [F, width])
  useEffect(
    () => () => {
      for (const v of [assets.tex, assets.mat, assets.mask, assets.geom]) v.dispose()
    },
    [assets],
  )
  const pitch = THREE.MathUtils.degToRad(FOREST.pitchDeg)
  useEffect(() => {
    mesh.current.layers.enable(CHARACTER_LAYER)
    mesh.current.userData.maskMaterial = assets.mask
  }, [assets])
  useFrame(() => {
    const camX = forestView.camX
    // This camera-facing foreground strip is composed only for the side view.
    mesh.current.visible = !forestReveal.perspective
    mesh.current.position.x = camX
    assets.tex.offset.x = (camX * F.rate - width / 2) / F.tile
  })
  // Slid toward the camera along its view axis, so it still lines up with the
  // path on screen (local y = screen height above the path).
  return (
    <mesh
      ref={mesh}
      geometry={assets.geom}
      material={assets.mat}
      position={[0, Math.sin(pitch) * FG_DIST, Math.cos(pitch) * FG_DIST]}
      rotation={[-pitch, 0, 0]}
    />
  )
}

// --- Light: shafts + pools + motes ---------------------------------------------------------

/**
 * Warm shafts of light slanting down through the canopy, each with a soft pool
 * where it meets the floor. They breathe slowly (a cloud passing far above).
 * Additive cards, no fog (fog would add its colour on top); depth is in the
 * per-shaft brightness instead.
 */
/** The path ray in slot i (rate 1: it's on the path), or null. Shared by the
 *  shafts and the light that follows them, so both agree where rays fall. */
function pathShaftAt(i: number) {
  const PS = FOREST.pathShafts
  const r = (salt: number) => hash3(i, 91, salt)
  if (r(0) > PS.fill) return null
  const x = (i + 0.2 + 0.6 * r(1)) * PS.every
  if (inForestHollow(x, 0, 1)) return null
  return {
    x,
    w: lerp(PS.width[0], PS.width[1], r(2)),
    len: lerp(PS.length[0], PS.length[1], r(3)),
    rate: 0.12 + r(4) * 0.1,
    phase: r(5) * 6.28,
  }
}
/** Each ray breathes slowly, out of step with the others (a cloud far above). */
const rayBreath = (t: number, p: { rate: number; phase: number }) => 0.7 + 0.3 * Math.sin(t * p.rate + p.phase)

function Shafts() {
  const size = useThree((s) => s.size)
  const shafts = useRef<THREE.InstancedMesh>(null!)
  const volumes = useRef<THREE.InstancedMesh>(null!)
  const pools = useRef<THREE.InstancedMesh>(null!)
  const S = FOREST.shafts
  const PS = FOREST.pathShafts
  const slots =
    Math.ceil((2 * (MAX_HALF + MARGIN)) / S.every) + Math.ceil((2 * (MAX_HALF + MARGIN)) / PS.every) + 10
  const assets = useMemo(() => {
    const shaftTex = shaftTexture()
    const poolTex = glowTexture()
    const card = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)
    // Three fixed crossed planes give the clearing's rays volume from both
    // cameras. They share one draw call and retain the same floor anchors.
    const crossed = [0, Math.PI / 3, Math.PI * 2 / 3].map((angle) => card.clone().rotateY(angle))
    const volumeCard = mergeGeometries(crossed)!
    crossed.forEach((geometry) => geometry.dispose())
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const mat = (map: THREE.Texture) =>
      new THREE.MeshBasicMaterial({
        map,
        color: P.shaft,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      })
    const volumeMat = mat(shaftTex)
    volumeMat.opacity = 1 / 3
    return { shaftTex, poolTex, card, flat, volumeCard, volumeMat, shaftMat: mat(shaftTex), poolMat: mat(poolTex) }
  }, [])
  useEffect(
    () => () => {
      for (const v of Object.values(assets)) v.dispose()
    },
    [assets],
  )
  const col = useMemo(() => new THREE.Color(), [])
  const rot = useMemo(() => new THREE.Euler(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const camX = forestView.camX
    const half = forestSceneryHalf(camX, forestFrame(size.width / Math.max(size.height, 1)).halfX) + 8
    let n = 0
    let vn = 0
    const writeShaft = (x: number, z: number, w: number, len: number, a: number) => {
      const local = Math.abs(x - FOREST_ENCOUNTER.landmarkX) < FOREST_ENCOUNTER.sceneryPrepareRadius
      rot.set(0, 0, S.lean)
      _q.setFromEuler(rot)
      _m.compose(_p.set(x, 0, z), _q, _s.set(w, len, 1))
      shafts.current.setMatrixAt(n, _m)
      shafts.current.setColorAt(n, col.setScalar(local ? 0 : a))
      if (local) {
        _m.compose(_p.set(x, 0, z), _q, _s.set(w, len, w))
        volumes.current.setMatrixAt(vn, _m)
        volumes.current.setColorAt(vn++, col.setScalar(a))
      }
    }
    // Slots are laid out in the shafts' own depth-averaged frame; each shaft is
    // then parallaxed by its own depth.
    const rMid = rateAt((S.z[0] + S.z[1]) / 2)
    const centre = camX * rMid
    const i0 = Math.floor((centre - half) / S.every) - 1
    const i1 = Math.ceil((centre + half) / S.every) + 1
    for (let i = i0; i <= i1 && n < slots; i++) {
      const r = (salt: number) => hash3(i, 77, salt)
      if (r(0) > S.fill) continue
      const z = lerp(S.z[0], S.z[1], r(1))
      const x = (i + r(2)) * S.every + camX * (1 - rateAt(z))
      const w = lerp(S.width[0], S.width[1], r(3))
      const len = lerp(S.length[0], S.length[1], r(4))
      // Slow breathing, out of step shaft to shaft; nearer shafts read stronger.
      const breathe = 0.55 + 0.45 * Math.sin(t * (0.12 + r(5) * 0.1) + r(6) * 6.28)
      const near = THREE.MathUtils.mapLinear(z, S.z[0], S.z[1], 0.55, 1)
      const a = S.opacity * breathe * near * (0.7 + r(7) * 0.6)

      writeShaft(x, z, w, len, a)
      _q.identity()
      _m.compose(_p.set(x, 0.03, z), _q, _s.set(w * 3, 1, w * 1.6))
      pools.current.setMatrixAt(n, _m)
      const pa = a * 1.2
      pools.current.setColorAt(n, col.setRGB(pa, pa, pa))
      n++
    }
    // The rays on the path: straight onto the trail, a broad pool where they land.
    for (let i = Math.floor((camX - half) / PS.every) - 1; i <= Math.ceil((camX + half) / PS.every) + 1 && n < slots; i++) {
      const ps = pathShaftAt(i)
      if (!ps) continue
      const a = PS.opacity * rayBreath(t, ps)
      writeShaft(ps.x, -0.6, ps.w, ps.len, a)
      _q.identity()
      _m.compose(_p.set(ps.x, 0.03, 0.1), _q, _s.set(ps.w * 2.4, 1, 3.2))
      pools.current.setMatrixAt(n, _m)
      const pa = a * 0.9
      pools.current.setColorAt(n, col.setRGB(pa, pa, pa))
      n++
    }
    for (const m of [shafts.current, pools.current]) {
      m.count = n
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
    volumes.current.count = vn
    volumes.current.instanceMatrix.needsUpdate = true
    if (volumes.current.instanceColor) volumes.current.instanceColor.needsUpdate = true
  })

  const init = (m: THREE.InstancedMesh | null, into: { current: THREE.InstancedMesh }) => {
    if (!m) return
    into.current = m
    // allocate instanceColor up front so the material compiles with it
    if (!m.instanceColor) for (let i = 0; i < m.count; i++) m.setColorAt(i, new THREE.Color(0, 0, 0))
  }
  return (
    <>
      <instancedMesh ref={(m) => init(m, shafts)} args={[assets.card, assets.shaftMat, slots]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={(m) => init(m, volumes)} args={[assets.volumeCard, assets.volumeMat, slots]} frustumCulled={false} renderOrder={2} />
      <instancedMesh ref={(m) => init(m, pools)} args={[assets.flat, assets.poolMat, slots]} frustumCulled={false} renderOrder={1} />
    </>
  )
}

/**
 * A warm light hung under whichever path ray is nearest Leonard, so walking
 * through a ray lights him up (and the trail and anything standing in it).
 */
function PathRayLight() {
  const light = useRef<THREE.PointLight>(null!)
  const PS = FOREST.pathShafts
  useFrame(({ clock }) => {
    const x = forestView.walkerX
    let best: ReturnType<typeof pathShaftAt> = null
    for (let i = Math.floor(x / PS.every) - 1; i <= Math.floor(x / PS.every) + 1; i++) {
      const ps = pathShaftAt(i)
      if (ps && (!best || Math.abs(ps.x - x) < Math.abs(best.x - x))) best = ps
    }
    if (!best) {
      light.current.intensity = 0
      return
    }
    light.current.position.set(best.x - Math.sin(FOREST.shafts.lean) * 2.6, 2.6, 0.6)
    light.current.intensity = PS.light * rayBreath(clock.elapsedTime, best)
  })
  return <pointLight ref={light} color={P.shaft} distance={PS.reach} decay={1.5} />
}

/**
 * Glowing motes drifting in the still air — dust in the light, the odd firefly.
 * Each keeps its own depth (so it parallaxes with the trees around it) and
 * wraps around the view, so there are always a few about wherever you walk.
 */
function Motes() {
  const size = useThree((s) => s.size)
  const mesh = useRef<THREE.InstancedMesh>(null!)
  const M = FOREST.motes
  const assets = useMemo(() => {
    const tex = glowTexture()
    return {
      tex,
      card: new THREE.PlaneGeometry(1, 1),
      mat: new THREE.MeshBasicMaterial({
        map: tex,
        // Hue is per mote (instance colour); this is just the glow strength.
        color: new THREE.Color(1, 1, 1).multiplyScalar(IS_MOBILE ? 1 : 2.2),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
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
  const motes = useMemo(
    () =>
      Array.from({ length: M.count }, (_, i) => {
        const r = (salt: number) => hash3(i, 55, salt)
        const z = lerp(M.z[0], M.z[1], r(0))
        return {
          z,
          rate: rateAt(z),
          x: r(1),
          y: lerp(M.y[0], M.y[1], Math.pow(r(2), 1.3)),
          size: lerp(M.size[0], M.size[1], r(3)),
          drift: 0.1 + r(4) * 0.25,
          bob: 0.6 + r(5) * 0.9,
          phase: r(6) * 6.28,
          tw: 0.6 + r(7) * 1.6,
          hue: new THREE.Color(r(8) < 0.2 ? P.moteCool : P.mote),
        }
      }),
    [M],
  )
  const col = useMemo(() => new THREE.Color(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const camX = forestView.camX
    const half = forestFrame(size.width / Math.max(size.height, 1)).halfX + 2
    const span = half * 2
    for (let i = 0; i < motes.length; i++) {
      const o = motes[i]
      // Where it sits relative to the camera once parallaxed, wrapped into view.
      const rel = o.x * span + Math.sin(t * o.drift + o.phase) * 1.2 + t * o.drift * 0.4 - camX * o.rate
      const wrapped = ((((rel + half) % span) + span) % span) - half
      _p.set(camX + wrapped, o.y + Math.sin(t * o.bob * 0.5 + o.phase) * 0.35, o.z)
      _m.compose(_p, _q.identity(), _s.setScalar(o.size))
      mesh.current.setMatrixAt(i, _m)
      // Twinkle: mostly a soft glow, now and then brightening, now and then out.
      const k = Math.max(0, Math.sin(t * o.tw + o.phase))
      const b = 0.25 + 0.75 * k * k
      mesh.current.setColorAt(i, col.copy(o.hue).multiplyScalar(b))
    }
    mesh.current.instanceMatrix.needsUpdate = true
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(m) => {
        if (!m) return
        mesh.current = m
        if (!m.instanceColor) for (let i = 0; i < m.count; i++) m.setColorAt(i, new THREE.Color(1, 1, 1))
      }}
      args={[assets.card, assets.mat, M.count]}
      frustumCulled={false}
      renderOrder={3}
    />
  )
}

// --- Obstacles -------------------------------------------------------------------------------

const OB = FOREST.obstacles
const OB_KINDS = Object.keys(OB.kinds) as ObstacleKind[]
const OB_POOL = 24

/** Merge parts that share a colour into one geometry each. */
function byColor(parts: [THREE.BufferGeometry, string][]): { geom: THREE.BufferGeometry; color: string }[] {
  const groups = new Map<string, THREE.BufferGeometry[]>()
  for (const [g, c] of parts) {
    if (!groups.has(c)) groups.set(c, [])
    groups.get(c)!.push(prep(g))
  }
  return [...groups].map(([color, gs]) => ({ geom: mergeGeometries(gs)!, color }))
}

/** One mesh per colour per kind, modelled at the kind's w × h (centred on x). */
function obstacleParts(kind: ObstacleKind): { geom: THREE.BufferGeometry; color: string }[] {
  const { w, h } = OB.kinds[kind]
  const C = OB.colors
  switch (kind) {
    case 'rock': {
      const g = new THREE.DodecahedronGeometry(0.5, 0).scale(w, h * 1.25, 0.9).translate(0, h * 0.42, 0)
      return byColor([[g, C.rock]])
    }
    case 'fallenTree': {
      // A trunk lying across the path (along z): a root plate at the far end,
      // a few snapped branches, moss along its back.
      const r = h / 2
      const L = 9
      const trunk = new THREE.CylinderGeometry(r * 0.85, r, L, 9, 4).rotateX(Math.PI / 2).translate(0, r, -1.5)
      const parts: [THREE.BufferGeometry, string][] = [[trunk, C.bark]]
      const plate = new THREE.CylinderGeometry(r * 2.6, r * 2.2, 0.35, 9).rotateX(Math.PI / 2).translate(0, r * 1.3, -1.5 - L / 2)
      parts.push([plate, C.bark])
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2
        const root = new THREE.ConeGeometry(0.12, 1.4, 5)
          .rotateZ(Math.PI / 2)
          .rotateY(-Math.PI / 2)
          .rotateZ(a)
          .translate(Math.cos(a) * r * 2.3, r * 1.3 + Math.sin(a) * r * 2.3, -1.7 - L / 2)
        parts.push([root, C.bark])
      }
      for (let k = 0; k < 3; k++) {
        const z = -4 + k * 2.6
        const stub = new THREE.CylinderGeometry(0.05, 0.11, 1.1, 5)
          .translate(0, 0.55, 0)
          .rotateZ((k % 2 ? 1 : -1) * 0.7)
          .translate(0, h * 0.9, z)
        parts.push([stub, C.bark])
      }
      const end = new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.04, 9).rotateX(Math.PI / 2).translate(0, r, -1.5 + L / 2)
      parts.push([end, C.wood])
      const moss = new THREE.CylinderGeometry(r * 0.75, r * 0.75, L * 0.7, 9, 1, false, -0.9, 1.8)
        .rotateX(Math.PI / 2)
        .translate(0, r * 1.18, -2)
      parts.push([moss, C.moss])
      return byColor(parts)
    }
    case 'boulder': {
      const body = new THREE.DodecahedronGeometry(0.5, 1).scale(w, h * 1.02, w * 0.85).translate(0, h * 0.49, 0)
      // A cap of moss on top, where the light lands.
      const moss = new THREE.DodecahedronGeometry(0.5, 1).scale(w * 0.82, h * 0.38, w * 0.7).translate(0, h * 0.8, 0)
      return byColor([
        [body, C.rock],
        [moss, C.moss],
      ])
    }
    case 'skull': {
      // An ancient creature's skull half sunk in the moss, snout toward −x:
      // a domed cranium you can stand on, long snout and jaw, dark sockets,
      // swept-back horns and a row of teeth.
      const parts: [THREE.BufferGeometry, string][] = []
      const ball = (rx: number, ry: number, rz: number, x: number, y: number, z: number, d = 1) =>
        new THREE.IcosahedronGeometry(0.5, d).scale(rx * 2, ry * 2, rz * 2).translate(x, y, z)
      parts.push([ball(1.15, 1.2, 1.15, 0.55, 1.95, 0), C.bone]) // cranium
      parts.push([ball(1.0, 0.75, 0.95, -0.55, 1.55, 0), C.bone]) // brow
      parts.push([ball(0.95, 0.5, 0.7, -1.35, 1.2, 0), C.bone]) // snout
      parts.push([ball(0.85, 0.22, 0.6, -1.05, 0.22, 0), C.bone]) // lower jaw on the ground
      parts.push([ball(0.3, 0.75, 0.3, 1.2, 0.7, 0.55), C.bone]) // jaw hinge / cheek pillars
      parts.push([ball(0.3, 0.75, 0.3, 1.2, 0.7, -0.55), C.bone])
      for (const side of [1, -1]) {
        parts.push([ball(0.32, 0.3, 0.2, -0.55, 1.75, side * 0.85), C.socket]) // eye socket
        const horn = new THREE.TorusGeometry(1.0, 0.17, 5, 8, 1.7).rotateZ(Math.PI * 0.45).translate(1.25, 2.1, side * 0.75)
        parts.push([horn, C.bone])
      }
      parts.push([ball(0.18, 0.16, 0.25, -2.25, 1.25, 0), C.socket]) // nasal hole
      for (let k = 0; k < 5; k++) {
        const tooth = new THREE.ConeGeometry(0.08, 0.45, 4).rotateZ(Math.PI).translate(-1.95 + k * 0.32, 0.72, 0.42 - (k % 2) * 0.84)
        parts.push([tooth, C.bone])
      }
      parts.push([ball(0.95, 0.32, 0.9, 0.55, 3.0, 0), C.moss]) // moss on the crown
      parts.push([ball(0.5, 0.18, 0.5, -0.6, 2.18, 0.15), C.moss])
      return byColor(parts)
    }
  }
}

/** The path's obstacles, drawn from the same hashed slots the walker collides with. */
function Obstacles() {
  const size = useThree((s) => s.size)
  const refs = useRef<Record<string, THREE.InstancedMesh | null>>({})
  const range = useRef('')
  const parts = useMemo(
    () =>
      OB_KINDS.flatMap((kind) =>
        obstacleParts(kind).map((p, k) => ({
          key: `${kind}${k}`,
          kind,
          geom: p.geom,
          mat: (() => {
            const m = new THREE.MeshStandardMaterial({ color: p.color, flatShading: true, roughness: 0.95 })
            // Bone and stone mottle and gather moss; bark streaks; moss/wood just vary.
            const C = OB.colors
            const kind = p.color === C.bark ? 'bark' : p.color === C.rock || p.color === C.bone ? 'stone' : 'leaf'
            return paint(m, kind)
          })(),
        })),
      ),
    [],
  )
  useEffect(
    () => () => {
      for (const p of parts) {
        p.geom.dispose()
        p.mat.dispose()
      }
    },
    [parts],
  )
  useFrame(() => {
    const camX = forestView.camX
    const half = forestFrame(size.width / Math.max(size.height, 1)).halfX + MARGIN
    const lo = Math.floor(camX - half)
    const hi = Math.ceil(camX + half)
    const key = `${lo}|${hi}`
    if (key === range.current) return
    range.current = key
    const list = obstaclesIn(lo, hi)
    for (const p of parts) {
      const m = refs.current[p.key]
      if (!m) continue
      let n = 0
      for (const o of list) {
        if (o.kind !== p.kind || n >= OB_POOL) continue
        // Rocks + boulders turn any way; the tree lies roughly across the path; the
        // skull faces either way along it.
        const r = hash3(o.i, 5, 1)
        const rotY =
          o.kind === 'fallenTree' ? (r - 0.5) * 0.5 : o.kind === 'skull' ? (r < 0.5 ? 0 : Math.PI) + (r - 0.5) * 0.3 : (r - 0.5) * 2
        put(m, n++, o.x, 0, rotY, 1, 1, 1)
      }
      m.count = n
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
  })
  return (
    <>
      {parts.map((p) => (
        <instancedMesh
          key={p.key}
          ref={(m) => {
            refs.current[p.key] = m
          }}
          args={[p.geom, p.mat, OB_POOL]}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </>
  )
}

// --- Walker ----------------------------------------------------------------------------------

/** Turned a little toward the camera when standing still, so he isn't in flat profile. */
const IDLE_TURN = 0.45
const MODEL = '/models/character.glb'
const FADE = 0.15
/** Ground speed each clip depicts at timeScale 1 (as RiggedFigure). */
const STRIDE: Record<string, number> = { walk: 1.5, run: 4.0 }
/** Path covered per footfall (half a clip cycle). */
const STEP_EVERY = { walk: 0.75, run: 2 } as const
const AIR_CLIP = 'jump-run'
/** How far up he climbs a wall per second, and the climb loop's own rise per
 *  cycle at timeScale 1 (tools/build-character.py log: 0.499 bu × 0.9 scale). */
const CLIMB_SPEED = 0.75
const CLIMB_CYCLE_RISE = 0.45
/** The pull-up (climb-over) ends with him standing this much higher and this
 *  much further forward than where its root is — measured off the head bone
 *  (end 2.182 up / 0.534 fwd vs idle 1.088 / 0.020). The root is moved by
 *  exactly that at the hand-off to idle, so nothing jumps. */
const PULL_UP = 1.094
const PULL_FORWARD = 0.51
/** The pull-up's first frame holds his head 0.22 higher than the climb loop
 *  (1.252 vs 1.032), so the climb stops that much short — head continuous. */
const PULL_SEAM = 0.22
/** Playback speeds for the one-shots (the Mixamo takes are slow and deliberate). */
const TS = { pullUp: 1.5, crouch: 1.4, rise: 1.6 }

type Mode = 'free' | 'climb' | 'pullUp' | 'crouch' | 'rise'

/** Hot walker state (Ninja Run's jump physics, plus walking, crouching, climbing). */
interface WalkerState {
  y: number
  vy: number
  grounded: boolean
  jumpBuffer: number
  airJumpsUsed: number
  /** Bumped on every take-off (ground or air), so the figure restarts the leap clip. */
  leapSeq: number
  /** Expected seconds aloft for the current leap, to stretch the clip over. */
  leapAir: number
  speed: number
  gait: 'idle' | 'walk' | 'run'
  mode: Mode
  /** Bumped on entering a mode, so the figure (re)starts its clip. */
  modeSeq: number
  modeT: number
  /** What he's climbing: its face x (where his chest is) and top. */
  climb: { faceX: number; top: number } | null
  /** Clip lengths (s at timeScale 1), filled in by the figure once loaded. */
  clipSecs: Record<string, number>
  /** The pull-up clip, for its fade-out weight (see the walker's offset). */
  pullUpAction: THREE.AnimationAction | null
  airSteps: AirStep[]
  nextId: number
}

/** Airtime from height `y` rising at `vy` back down to `floor`. */
function airTime(vy: number, y: number, floor: number) {
  const g = N.gravity
  return (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (y - floor)))) / g
}

/**
 * The town character, but driven like Ninja Run's runner: the leap clip is
 * stretched over the real airtime (restarted for the air step), so the
 * landing lines up; walk / run cadence follows ground speed; climbing,
 * pulling up and crouching play their own clips.
 */
function WalkerFigure({ w }: { w: { current: WalkerState } }) {
  const { scene, animations } = useTownGLTF(MODEL)
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, model)
  const playing = useRef('')
  const lastLeap = useRef(0)
  const lastMode = useRef(0)

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
        m.layers.enable(CHARACTER_LAYER) // drawn into the "keep him crisp" mask
      }
    })
  }, [model])
  useEffect(() => {
    for (const [name, a] of Object.entries(actions)) if (a) w.current.clipSecs[name] = a.getClip().duration
    w.current.pullUpAction = actions['climb-over'] ?? null
  }, [actions, w])

  // Leaving a held one-shot (the pull-up, the crouch) blends a little longer,
  // smoothing what's left between its last pose and the next clip's first.
  const SOFT = new Set(['climb-over', 'stand-to-crouch', 'crouch-to-stand'])
  const to = (name: string, once = false, timeScale = 1) => {
    const next = actions[name]
    if (!next) return
    if (playing.current === name && next.isRunning() && !once) {
      next.timeScale = timeScale
      return
    }
    const fade = SOFT.has(playing.current) ? 0.35 : once ? 0.1 : FADE
    if (playing.current !== name) actions[playing.current]?.fadeOut(fade)
    next.reset()
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity)
    next.clampWhenFinished = once
    next.timeScale = timeScale
    next.fadeIn(fade).play()
    playing.current = name
  }

  useFrame(() => {
    const s = w.current
    const fresh = s.modeSeq !== lastMode.current
    lastMode.current = s.modeSeq
    switch (s.mode) {
      case 'climb':
        to('climb', false, CLIMB_SPEED / (CLIMB_CYCLE_RISE / (s.clipSecs.climb ?? 1.1)))
        return
      case 'pullUp':
        if (fresh) to('climb-over', true, TS.pullUp)
        return
      case 'crouch':
        if (fresh) to('stand-to-crouch', true, TS.crouch)
        return
      case 'rise':
        if (fresh) to('crouch-to-stand', true, TS.rise)
        return
    }
    if (!s.grounded) {
      if (s.leapSeq !== lastLeap.current) {
        lastLeap.current = s.leapSeq
        const dur = actions[AIR_CLIP]?.getClip().duration ?? s.leapAir
        to(AIR_CLIP, true, dur / Math.max(0.2, s.leapAir))
      } else if (playing.current !== AIR_CLIP) {
        to('fall') // walked off the edge of something
      }
      return
    }
    lastLeap.current = s.leapSeq
    to(s.gait)
    const clip = actions[s.gait]
    const stride = STRIDE[s.gait]
    if (clip && stride) clip.timeScale = s.speed / stride
  })

  return (
    <group scale={N.figureScale}>
      <primitive object={model} />
    </group>
  )
}

/**
 * Leonard on the path. Left / right walks (breaking into a run after a while,
 * like in town); Space jumps with Ninja Run's physics — and again in mid-air,
 * stepping on the air in a puff of mist once the wisp has taught it. Rocks and fallen trees
 * block the way until you hop them. Climbing is reserved for a later lesson.
 * You can stand on obstacles, and walk off their edges into the lower hollow.
 */
function Walker() {
  const group = useRef<THREE.Group>(null!)
  const offset = useRef<THREE.Group>(null!)
  const w = useRef<WalkerState>({
    y: import.meta.env.DEV && new URLSearchParams(window.location.search).has('hollow') ? -O.gap.depth : 0,
    vy: 0,
    grounded: true,
    jumpBuffer: 0,
    airJumpsUsed: 0,
    leapSeq: 0,
    leapAir: 0.6,
    speed: 0,
    gait: 'idle',
    mode: 'free',
    modeSeq: 0,
    modeT: 0,
    climb: null,
    clipSecs: {},
    pullUpAction: null,
    airSteps: [],
    nextId: 1,
  })
  const yaw = useRef(Math.PI / 2 - IDLE_TURN)
  const held = useRef(0)
  const jumpHeld = useRef(false)
  const pushing = useRef(0)
  const stride = useRef(0)
  const [, getKeys] = useKeyboardControls()

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const win = window as unknown as Record<string, unknown>
    win.__walker = w.current
    return () => {
      delete win.__walker
    }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const s = w.current
    const st = useGame.getState()
    const typing = typeof document !== 'undefined' && isTypingTarget(document.activeElement)
    const revealing = useForestEncounter.getState().phase === 'reveal'
    const canMove = !st.dialogue && !st.transition && !typing && !revealing
    if (revealing) {
      s.speed = 0
      s.jumpBuffer = 0
      held.current = 0
    }
    const keys = getKeys() as { left: boolean; right: boolean; jump: boolean; back: boolean; forward: boolean }
    const sounds: ForestSound[] = []
    const hw = FOREST.walkerHalfW
    const near = obstaclesIn(forestView.walkerX - 5, forestView.walkerX + 5)
    const floorAt = (px: number) => {
      let f = forestFloorAt(px, hw)
      for (const o of near) if (px + hw > o.x - o.hw && px - hw < o.x + o.hw) f = Math.max(f, o.h)
      return f
    }
    const enter = (m: Mode) => {
      s.mode = m
      s.modeSeq++
      s.modeT = 0
    }
    s.modeT += dt

    let dir = 0
    if (canMove) {
      if (keys.left) dir -= 1
      if (keys.right) dir += 1
      if (dir === 0) dir = forestTouch.dir
    }
    const M = FOREST.moves
    const press = M.jump && canMove && (forestTouch.jump || (keys.jump && !jumpHeld.current))
    jumpHeld.current = keys.jump
    forestTouch.jump = false
    const crouchHeld = M.crouch && canMove && (keys.back || forestTouch.crouch)

    // --- climbing: up the face, then the pull-up onto the top ----------------------
    if (s.mode === 'climb' && s.climb) {
      s.speed = 0
      // Ease in against the face (he stops a hand's width short when walking).
      forestView.walkerX += (s.climb.faceX - forestView.walkerX) * Math.min(1, dt * 12)
      const stop = s.climb.top - PULL_UP + PULL_SEAM
      s.y = Math.min(s.y + CLIMB_SPEED * dt, stop)
      if (s.y >= stop - 1e-3) {
        s.y = s.climb.top - PULL_UP
        enter('pullUp')
      }
    } else if (s.mode === 'pullUp' && s.climb) {
      // The clip itself lifts him up and over the lip; the root holds still
      // until it ends, then moves to exactly where the clip left him standing.
      const dur = (s.clipSecs['climb-over'] ?? 3.7) / TS.pullUp
      forestView.walkerX = s.climb.faceX
      if (s.modeT >= dur) {
        s.y = s.climb.top
        forestView.walkerX = s.climb.faceX + forestView.facing * PULL_FORWARD
        s.vy = 0
        s.grounded = true
        s.airJumpsUsed = 0
        s.climb = null
        enter('free')
        stride.current = 0
      }
    } else if (s.mode === 'crouch') {
      s.speed = 0
      if (!crouchHeld && s.modeT > 0.25) enter('rise')
    } else if (s.mode === 'rise') {
      s.speed = 0
      if (s.modeT >= (s.clipSecs['crouch-to-stand'] ?? 1.4) / TS.rise) enter('free')
    }

    if (s.mode === 'free') {
      // --- walking ----------------------------------------------------------------
      if (dir !== 0) {
        held.current += dt
        forestView.facing = dir > 0 ? 1 : -1
      } else {
        held.current = 0
      }
      const running = FOREST.moves.run && held.current >= FOREST.runAfter
      const target = dir === 0 ? 0 : running ? FOREST.runSpeed : FOREST.walkSpeed
      s.speed += (target - s.speed) * Math.min(1, dt * FOREST.accel)
      if (dir === 0 && s.speed < 0.05) s.speed = 0

      // Move along x, stopping against the side of anything taller than his feet.
      let x = forestView.walkerX + forestView.facing * s.speed * dt
      let wall: (typeof near)[number] | null = null
      for (const o of near) {
        if (s.y >= o.h - 0.02) continue // above it: no side to hit
        const left = o.x - o.hw - hw
        const right = o.x + o.hw + hw
        if (x > left && x < right) {
          x = forestView.walkerX <= o.x ? left : right
          wall = o
        }
      }
      x = constrainForestHollowX(x, s.y, hw)
      forestView.walkerX = x
      if (wall && s.grounded) s.speed = 0

      // Into the face of something tall: hold against it a moment (or hit it
      // mid-air) and he takes hold and climbs.
      const facingWall = wall && Math.sign(wall.x - x) === forestView.facing
      if (M.climb && wall && facingWall && wall.h >= OB.climbFrom && (dir === forestView.facing || !s.grounded)) {
        pushing.current += s.grounded ? dt : 1
        if (pushing.current > 0.18) {
          const side = forestView.facing
          s.climb = { faceX: wall.x - side * (wall.hw + hw * 0.4), top: wall.h }
          s.vy = 0
          s.grounded = false
          s.airJumpsUsed = 0
          pushing.current = 0
          s.airSteps.length = 0
          // Already high enough (a jump that reached the lip): straight to the pull-up.
          const lip = s.y >= wall.h - PULL_UP
          if (lip) s.y = wall.h - PULL_UP
          enter(lip ? 'pullUp' : 'climb')
        }
      } else {
        pushing.current = 0
      }
    }

    if (s.mode === 'free') {
      const x = forestView.walkerX
      // --- jumping (Ninja Run's rules) ------------------------------------------
      if (press && useForestOpening.getState().doubleJump && !s.grounded && s.airJumpsUsed < N.airJumps) {
        // He steps on the air and kicks off again from wherever he is.
        s.vy = Math.sqrt(2 * N.gravity * N.doubleJumpHeight)
        s.airJumpsUsed++
        s.jumpBuffer = 0
        s.airSteps.push({ id: s.nextId++, x, y: s.y, age: 0 })
        s.leapSeq++
        s.leapAir = airTime(s.vy, s.y, floorAt(x))
        sounds.push('doubleJump')
        noteForestDoubleJump()
      } else if (press) s.jumpBuffer = N.jumpBuffer
      else s.jumpBuffer = Math.max(0, s.jumpBuffer - dt)
      if (s.grounded && s.jumpBuffer > 0 && canMove) {
        s.vy = Math.sqrt(2 * N.gravity * N.jumpHeight)
        s.grounded = false
        s.jumpBuffer = 0
        s.leapSeq++
        s.leapAir = airTime(s.vy, s.y, floorAt(x))
        sounds.push('jump')
      }

      // --- gravity, landing on the ground or on top of things ---------------------
      const floor = floorAt(x)
      if (s.grounded && s.y > floor + 0.01) s.grounded = false // walked off an edge
      if (!s.grounded) {
        s.vy -= N.gravity * dt
        s.y += s.vy * dt
        if (s.y <= floor && s.vy <= 0) {
          s.y = floor
          s.vy = 0
          s.grounded = true
          s.airJumpsUsed = 0
          sounds.push('land')
          stride.current = 0
        }
      }

      // ↓ on the ground: crouch.
      if (crouchHeld && s.grounded && s.speed < 0.5) {
        s.speed = 0
        enter('crouch')
      }
    }

    for (const a of s.airSteps) a.age += dt
    if (s.airSteps.length && s.airSteps[0].age > N.airStepSecs) {
      s.airSteps = s.airSteps.filter((a) => a.age < N.airStepSecs)
    }

    // --- gait + footfalls -----------------------------------------------------------
    const moving = s.mode === 'free' && s.speed > 0.2
    const running = FOREST.moves.run && held.current >= FOREST.runAfter
    s.gait = !moving ? 'idle' : running && s.speed > FOREST.walkSpeed + 0.4 ? 'run' : 'walk'
    if (s.grounded && moving && s.gait !== 'idle') {
      stride.current += s.speed * dt
      const every = STEP_EVERY[s.gait]
      if (stride.current >= every) {
        stride.current %= every
        sounds.push(s.gait === 'run' ? 'runStep' : 'step')
      }
    } else if (!moving) {
      stride.current = STEP_EVERY.walk * 0.6 // first step lands soon after setting off
    }
    playForestSfx(sounds)

    // Face the way he walks (the wall, when climbing); ease a little toward the
    // camera when he stands still.
    const still = s.mode === 'free' && !moving && s.grounded
    const want = forestView.facing * (Math.PI / 2 - (still ? IDLE_TURN : 0))
    yaw.current += (want - yaw.current) * Math.min(1, dt * (still ? 4 : 12))
    group.current.position.set(forestView.walkerX, s.y, 0)
    forestView.walkerY = s.y
    advanceForestOpening(dt, forestView.walkerX, s.y, s.grounded, !canMove || document.hidden)
    // Turn toward the discovery only in the shot; walking facing stays intact.
    group.current.rotation.y = forestReveal.perspective
      ? Math.atan2(FOREST_ENCOUNTER.landmarkX - forestView.walkerX, FOREST_ENCOUNTER.landmarkZ)
      : yaw.current

    // After the pull-up hands over, the root has just jumped up + forward to
    // where he stands, but while the pull-up clip fades out it still poses him
    // relative to the OLD root. Shift the figure back by its remaining weight
    // (in the same frame as the root moves), so the blend lands in place.
    const over = s.pullUpAction
    const k = s.mode !== 'pullUp' && over?.isScheduled() ? over.getEffectiveWeight() : 0
    // Likewise on the way in: the root drops PULL_SEAM as the pull-up starts,
    // while the climb pose (head that much lower) is still fading out.
    const seam = s.mode === 'pullUp' ? 1 - Math.min(1, s.modeT / 0.1) : 0
    offset.current.position.set(0, -k * PULL_UP + seam * PULL_SEAM, -k * PULL_FORWARD)
  })

  return (
    <>
      <group ref={group}>
        <group ref={offset}>
          <WalkerFigure w={w} />
        </group>
      </group>
      <AirSteps state={w} />
    </>
  )
}

// --- World -----------------------------------------------------------------------------------

export function ForestWorld() {
  const assets = useForestAssets()

  // A fresh lesson every visit; authoring previews may bypass the opening.
  useEffect(() => {
    // Local previews: remains, stones, the gap approach, or the lower hollow.
    const params = new URLSearchParams(window.location.search)
    const preview = import.meta.env.DEV && params.has('viewpoint')
    const stones = import.meta.env.DEV && params.has('stones')
    const hollow = import.meta.env.DEV && params.has('hollow')
    const opening = import.meta.env.DEV && params.has('opening')
    resetForestOpening(preview || stones)
    forestView.walkerX = preview ? FOREST_ENCOUNTER.viewpointX : stones ? 34 : hollow ? 55 : opening ? 48 : 0
    forestView.walkerY = hollow ? -O.gap.depth : 0
    forestView.camY = hollow ? -1.6 : 0
    forestView.facing = 1
    forestView.camX = forestView.walkerX
    forestView.snap = true
    forestTouch.dir = 0
    forestTouch.jump = false
    return () => resetForestOpening()
  }, [])

  // The forest's own sound: wind in the canopy, leaves, distant birds.
  useEffect(() => startForestAmbience(), [])

  // Dev handle: `__forest.tp(x)` jumps along the path, `__forest.view` to peek.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as Record<string, unknown>
    w.__forest = {
      view: forestView,
      opening: useForestOpening,
      tp: (x: number) => {
        forestView.walkerX = x
        forestView.snap = true
      },
    }
    return () => {
      delete w.__forest
    }
  }, [])

  return (
    <group>
      <Atmosphere />
      <Backdrop />
      <Canopy />
      <Ground />
      {FOREST.layers.map((layer, li) => (
        <TreeBand key={li} li={li} layer={layer} assets={assets} />
      ))}
      <Understory assets={assets} />
      <Suspense fallback={null}>
        <ForestStones />
      </Suspense>
      <Grass assets={assets} />
      <Obstacles />
      <Shafts />
      <PathRayLight />
      <Motes />
      <Walker />
      <ForestEncounter />
      <WispGuide />
      <Foreground />
      {/* Desktop only, like the painterly filter it feeds. */}
      {!IS_MOBILE && <CharacterMask />}
    </group>
  )
}
