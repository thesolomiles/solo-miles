import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MOTION, SPAN, mulberry32, roadX, curveSlope } from '../motion'
import { RIDE } from '../../../config/ride'
import { makeVolcanicRock } from '../assets'

/**
 * Beach kit — a wide sandy shoulder and a rippling sea running down one side of the
 * road, strewn with black volcanic (basalt) rocks along the shore — the classic
 * Jeju coast. Like the road ribbon itself, it's dynamic geometry that FOLLOWS the
 * road: every frame each strip's inner edge hugs the road's edge and the sea
 * extends outward from there, so the shoreline curves with the bends instead of
 * sitting as a fixed straight slab with a grass wedge between it and the road. The
 * sea's swell scrolls with MOTION.speed; the basalt rocks (also road-tracked)
 * scroll and recycle down the shore, so the water reads as coast moving past you.
 *
 * `side` is the screen-space x sign the beach sits on (+1 = screen-right, −1 =
 * screen-left); the caller maps the rider-relative side to a screen side.
 */

const HW = RIDE.roadHalfWidth // road half-width — the beach starts at the road edge
const SAND_W = 7 // width of the sandy shoulder (a proper open beach)
const SEA_W = 55 // sea reaches well off-frame / to the horizon
// Offsets are magnitudes from the road centre; `side` picks left/right.
const SAND_I = HW - 0.2
const SAND_O = HW + SAND_W
const SEA_I = HW + SAND_W - 0.4
const SEA_O = HW + SAND_W + SEA_W
const SAND_Y = 0.12
const SEA_Y = 0.08

// Along-road sample band (covers the visible depth and fades into fog).
const Z_FAR = -56
const Z_NEAR = 30
const SAMPLES = 60
const SEA_ACROSS = 10 // across-subdivisions of the sea, so the ripple shows

const SEA_COLOR = 0x35a8d2
const SAND_COLOR = 0xdcc790

interface SeaShader {
  uniforms: { uTime: { value: number }; uScroll: { value: number } }
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** A strip of geometry `across`+1 columns wide and `S` samples long (across=1 → a
 *  2-vertex ribbon). Positions are filled in each frame by `updateStrip`. */
function buildStrip(S: number, across: number, y: number): THREE.BufferGeometry {
  const cols = across + 1
  const pos = new Float32Array(S * cols * 3)
  const nor = new Float32Array(S * cols * 3)
  for (let i = 0; i < S; i++)
    for (let k = 0; k < cols; k++) {
      const vi = i * cols + k
      pos[vi * 3 + 1] = y
      nor[vi * 3 + 1] = 1
    }
  const idx: number[] = []
  for (let i = 0; i < S - 1; i++)
    for (let k = 0; k < across; k++) {
      const a = i * cols + k
      const b = a + 1
      const c = (i + 1) * cols + k
      const d = c + 1
      idx.push(a, c, b, b, c, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
  g.setIndex(idx)
  return g
}

/** Re-lay a strip so it follows the road: each vertex sits at a signed offset
 *  along the road normal (like the road's own ribbon), lerped from inner→outer. */
function updateStrip(
  g: THREE.BufferGeometry,
  zs: number[],
  side: number,
  across: number,
  oInner: number,
  oOuter: number,
  y: number,
) {
  const cols = across + 1
  const p = g.attributes.position.array as Float32Array
  for (let i = 0; i < zs.length; i++) {
    const zc = zs[i]
    const cx = roadX(zc)
    const s = curveSlope(zc)
    const invL = 1 / Math.hypot(1, s)
    const sInvL = s * invL
    for (let k = 0; k < cols; k++) {
      const o = side * (oInner + (oOuter - oInner) * (k / across))
      const vi = (i * cols + k) * 3
      p[vi] = cx + o * invL
      p[vi + 1] = y
      p[vi + 2] = zc - o * sInvL
    }
  }
  g.attributes.position.needsUpdate = true
}

/** Calm sea material: flat-shaded so facets catch the sun, ripples on the GPU,
 *  swell scrolls with `uScroll`, and `fog:false` keeps it blue in the warm haze. */
function makeSeaMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: SEA_COLOR,
    roughness: 0.42,
    metalness: 0.06,
    flatShading: true,
    fog: false,
    side: THREE.DoubleSide,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uScroll = { value: 0 }
    ;(mat.userData as { shader?: SeaShader }).shader = shader as unknown as SeaShader
    // Geometry is built in world XZ (y up); displace along y. uScroll slides the
    // along-shore phase so crests travel with the world.
    shader.vertexShader =
      'uniform float uTime;\nuniform float uScroll;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
           float zz = transformed.z + uScroll;
           float sw = sin(transformed.x * 0.35 + uTime * 0.7) * 0.05
                    + sin(zz * 0.6 - uTime * 0.55) * 0.045
                    + sin((transformed.x + zz) * 0.9 + uTime * 1.0) * 0.022;
           transformed.y += sw;`,
      )
  }
  return mat
}

// The Jeju coast alternates ALONG the road: a stretch of open sand, then a stretch
// packed with dark basalt, and so on. So rocks live in a few long "outcrops" (each
// a densely-filled stretch spanning most of the beach width) with open sand
// between them. Rocks never touch the road — they start a sand margin out from the
// edge and reach into the shallows.
const ROCK_INNER = HW + 2.2 // clear sand between the road and the rocks
const ROCK_OUTER = HW + SAND_W + 1.5 // out to the waterline / just into the shallows
const OUTCROPS = 3 // rocky stretches per recycle band (sand stretches between)
const OUTCROP_LEN = 12 // along-shore length of each rocky stretch
const PER_OUTCROP = 30 // rocks packed into each stretch (dense)

/** Black volcanic (basalt) rocks lining the shore in long outcrop stretches — the
 *  signature of Jeju's coast, where a run of open sand gives way to a run of dark
 *  rock. Each outcrop is a densely-packed stretch that fills most of the beach
 *  width; open sand lies between them. The outcrops scroll and recycle down the
 *  beach, tracking the road curve so they ride the shoreline as it bends. Two
 *  craggy geometries, vertex-coloured near-black. */
function ShoreRocks({ side }: { side: 1 | -1 }) {
  const geoms = useMemo(() => [makeVolcanicRock(0x5a17), makeVolcanicRock(0x5a29)], [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
    [],
  )
  const refs = [useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!)]
  // Outcrop centres (live z scrolls) and the rocks packed into each (local jitter
  // off the centre, so a whole outcrop moves together).
  const outcrops = useMemo(() => {
    const r = mulberry32(0x5ec1 + (side > 0 ? 1 : 0))
    const out: { z: number; len: number }[] = []
    for (let i = 0; i < OUTCROPS; i++) {
      out.push({
        z: RIDE.spawnZ + ((i + 0.5) / OUTCROPS) * SPAN,
        len: OUTCROP_LEN * (0.8 + r() * 0.5),
      })
    }
    return out
  }, [side])
  const rocks = useMemo(() => {
    const r = mulberry32(0x5ed2 + (side > 0 ? 1 : 0))
    const out: { oi: number; off: number; dz: number; rot: number; scale: number; g: number }[] = []
    outcrops.forEach((oc, oi) => {
      for (let j = 0; j < PER_OUTCROP; j++) {
        const t = r() // slight waterline bias for lateral position
        out.push({
          oi,
          off: ROCK_INNER + (0.15 + 0.85 * t) * (ROCK_OUTER - ROCK_INNER),
          dz: (r() - 0.5) * oc.len,
          rot: r() * Math.PI * 2,
          scale: 0.4 + r() * r() * 1.5, // mostly small, packed, the odd big boulder
          g: r() < 0.5 ? 0 : 1,
        })
      }
    })
    return out
  }, [outcrops])
  const byGeom = useMemo(() => {
    const g: number[][] = [[], []]
    rocks.forEach((it, i) => g[it.g].push(i))
    return g
  }, [rocks])
  useEffect(() => () => {
    geoms.forEach((g) => g.dispose())
    mat.dispose()
  }, [geoms, mat])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    for (let i = 0; i < outcrops.length; i++) {
      outcrops[i].z -= MOTION.speed * dt
      if (outcrops[i].z < RIDE.spawnZ) outcrops[i].z += SPAN
    }
    for (let gi = 0; gi < 2; gi++) {
      const mesh = refs[gi].current
      if (!mesh) continue
      const idxs = byGeom[gi]
      for (let k = 0; k < idxs.length; k++) {
        const it = rocks[idxs[k]]
        const z = outcrops[it.oi].z + it.dz
        const off = side * Math.max(ROCK_INNER, it.off) // never onto the road
        const sl = curveSlope(z)
        const invL = 1 / Math.hypot(1, sl)
        _p.set(roadX(z) + off * invL, SAND_Y - 0.02, z - off * sl * invL)
        _q.setFromAxisAngle(_up, it.rot)
        _s.setScalar(it.scale)
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(k, _m)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <>
      {geoms.map((g, gi) => (
        <instancedMesh key={gi} ref={refs[gi]} args={[g, mat, byGeom[gi].length]} castShadow receiveShadow frustumCulled={false} />
      ))}
    </>
  )
}

export function Beach({ side }: { side: 1 | -1 }) {
  const zs = useMemo(() => {
    const a = new Array<number>(SAMPLES)
    for (let i = 0; i < SAMPLES; i++) a[i] = Z_FAR + (i / (SAMPLES - 1)) * (Z_NEAR - Z_FAR)
    return a
  }, [])
  const sandGeom = useMemo(() => buildStrip(SAMPLES, 1, SAND_Y), [])
  const seaGeom = useMemo(() => buildStrip(SAMPLES, SEA_ACROSS, SEA_Y), [])
  const seaMat = useMemo(makeSeaMaterial, [])
  const clock = useRef(0)
  useEffect(() => () => {
    sandGeom.dispose()
    seaGeom.dispose()
    seaMat.dispose()
  }, [sandGeom, seaGeom, seaMat])
  useFrame((_, delta) => {
    updateStrip(sandGeom, zs, side, 1, SAND_I, SAND_O, SAND_Y)
    updateStrip(seaGeom, zs, side, SEA_ACROSS, SEA_I, SEA_O, SEA_Y)
    const dt = Math.min(delta, 0.05)
    clock.current += dt
    const sh = (seaMat.userData as { shader?: SeaShader }).shader
    if (sh) {
      sh.uniforms.uTime.value = clock.current
      sh.uniforms.uScroll.value += MOTION.speed * dt
    }
  })

  return (
    <group>
      <mesh geometry={seaGeom} material={seaMat} receiveShadow />
      <mesh geometry={sandGeom} receiveShadow>
        <meshStandardMaterial color={SAND_COLOR} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <ShoreRocks side={side} />
    </group>
  )
}
