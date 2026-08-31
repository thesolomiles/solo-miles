import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MOTION, SPAN, mulberry32, roadX, curveSlope } from '../motion'
import { RIDE } from '../../../config/ride'

/**
 * Beach kit — a sandy shoulder and a rippling sea running down one side of the
 * road. Like the road ribbon itself, it's dynamic geometry that FOLLOWS the road:
 * every frame each strip's inner edge hugs the road's edge and the sea extends
 * outward from there, so the shoreline curves with the bends instead of sitting as
 * a fixed straight slab with a grass wedge between it and the road. The sea's swell
 * scrolls with MOTION.speed and a field of foam whitecaps (also road-tracked)
 * scrolls and recycles down the shore, so the water reads as coast moving past you.
 *
 * `side` is the screen-space x sign the beach sits on (+1 = screen-right, −1 =
 * screen-left); the caller maps the rider-relative side to a screen side.
 */

const HW = RIDE.roadHalfWidth // road half-width — the beach starts at the road edge
const SAND_W = 2.8 // width of the sandy shoulder
const SEA_W = 55 // sea reaches well off-frame / to the horizon
// Offsets are magnitudes from the road centre; `side` picks left/right.
const SAND_I = HW - 0.2
const SAND_O = HW + SAND_W
const SEA_I = HW + SAND_W - 0.4
const SEA_O = HW + SAND_W + SEA_W
const SAND_Y = 0.12
const SEA_Y = 0.08
const FOAM_Y = 0.17

// Along-road sample band (covers the visible depth and fades into fog).
const Z_FAR = -56
const Z_NEAR = 30
const SAMPLES = 60
const SEA_ACROSS = 10 // across-subdivisions of the sea, so the ripple shows

const SEA_COLOR = 0x35a8d2
const SAND_COLOR = 0xdcc790
const CREST_FOAM = 0xdfeef2

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

/** A soft elongated foam sprite so whitecaps read as wispy foam, not hard planks. */
function makeFoamTexture(): THREE.CanvasTexture {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

/** Foam whitecaps that scroll and recycle down the shore, tracking the road curve
 *  (x = roadX(z) + offset) so they ride the water as it bends, biased toward the
 *  waterline. */
function SeaFoam({ side }: { side: 1 | -1 }) {
  const COUNT = 70
  const tex = useMemo(makeFoamTexture, [])
  const geom = useMemo(() => new THREE.PlaneGeometry(1.9, 0.85).rotateX(-Math.PI / 2), [])
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: tex,
        color: CREST_FOAM,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        fog: false,
      }),
    [tex],
  )
  const ref = useRef<THREE.InstancedMesh>(null!)
  const insts = useMemo(() => {
    const r = mulberry32(0x5ea + (side > 0 ? 1 : 0))
    const out: { off: number; z: number; rot: number; scale: number }[] = []
    for (let i = 0; i < COUNT; i++) {
      const t = r() // t² biases toward the waterline (SEA_I); a few range out to sea
      out.push({
        off: side * (SEA_I + 0.4 + t * t * 8),
        z: RIDE.spawnZ + ((i + r() * 0.8) / COUNT) * SPAN,
        rot: (r() - 0.5) * 0.5,
        scale: 0.6 + r() * 1.5,
      })
    }
    return out
  }, [side])
  useEffect(() => () => {
    geom.dispose()
    mat.dispose()
    tex.dispose()
  }, [geom, mat, tex])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < COUNT; i++) {
      const it = insts[i]
      it.z -= MOTION.speed * dt
      if (it.z < RIDE.spawnZ) it.z += SPAN
      _p.set(roadX(it.z) + it.off, FOAM_Y, it.z)
      _q.setFromAxisAngle(_up, it.rot)
      _s.set(it.scale, 1, it.scale)
      _m.compose(_p, _q, _s)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geom, mat, COUNT]} frustumCulled={false} />
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
      <SeaFoam side={side} />
    </group>
  )
}
