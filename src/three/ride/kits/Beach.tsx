import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MOTION, SPAN, mulberry32 } from '../motion'
import { RIDE } from '../../../config/ride'

/**
 * Beach kit — a reusable roadside component for the ride scene: a sandy shoulder
 * and, beyond it, a rippling sea running down one side of the road. Unlike the
 * scrolling prop fields it's built from long fixed strips, but it still conveys
 * forward travel: the swell scrolls toward the camera in lockstep with the world
 * (MOTION.speed) and a field of foam streaks scrolls and recycles along the
 * shoreline — so the sea side moves with the land instead of sitting as a
 * detached "fluid" layer.
 *
 * `side` is the screen-space x sign the beach sits on (+1 = screen-right, −1 =
 * screen-left); the caller maps the rider-relative side to a screen side.
 */

const Z_CENTER = -12
const DEPTH = 120
// The ride's ortho frustum is tight (visible x only ~±6, the road fills most of
// it), so the sand is a thin shoulder and the sea starts right at the road edge.
const SAND_INNER = 3.4
const SAND_WIDTH = 1.2
const SEA_INNER = 4.4
const SEA_WIDTH = 48
const FOAM_WIDTH = 0.8

const SEA_COLOR = 0x35a8d2
const SAND_COLOR = 0xdcc790
const SHORE_FOAM = 0xf3eede
const CREST_FOAM = 0xdfeef2

interface SeaShader {
  uniforms: { uTime: { value: number }; uScroll: { value: number } }
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Calm sea: a flat-shaded plane whose vertices roll on layered sines (the facets
 *  tilt and catch the sun, no reflection pass). `uScroll` slides the swell toward
 *  the camera in step with the world so the water reads as moving, not wobbling. */
function makeSeaMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: SEA_COLOR,
    roughness: 0.42,
    metalness: 0.06,
    flatShading: true,
    // Ignore the scene's warm haze so the sea stays blue to the horizon.
    fog: false,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uScroll = { value: 0 }
    ;(mat.userData as { shader?: SeaShader }).shader = shader as unknown as SeaShader
    // Plane is authored in XY (normal +Z), tilted −90° about X so its normal points
    // up; local x,y → world x,z. Displace along the normal (local z). `uScroll`
    // shifts the along-shore phase so crests travel with the world.
    shader.vertexShader =
      'uniform float uTime;\nuniform float uScroll;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
           float yy = transformed.y + uScroll;
           float sw = sin(transformed.x * 0.35 + uTime * 0.7) * 0.055
                    + sin(yy * 0.6 - uTime * 0.55) * 0.05
                    + sin((transformed.x + yy) * 0.9 + uTime * 1.0) * 0.025;
           transformed.z += sw;`,
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

/** Foam — soft whitecaps that scroll and recycle along the shore, biased toward
 *  the waterline, giving the sea real in-motion detail (the same trick as the
 *  land's scrolling ground patches). */
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
    const out: { x: number; z: number; rot: number; scale: number }[] = []
    for (let i = 0; i < COUNT; i++) {
      // r()² biases toward the waterline (SEA_INNER); a few range out to sea.
      const t = r()
      out.push({
        x: side * (SEA_INNER + 0.3 + t * t * 7.5),
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
      _p.set(it.x, 0.16, it.z)
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
  const seaMat = useMemo(makeSeaMaterial, [])
  const clock = useRef(0)
  useEffect(() => () => seaMat.dispose(), [seaMat])
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    clock.current += dt
    const sh = (seaMat.userData as { shader?: SeaShader }).shader
    if (sh) {
      sh.uniforms.uTime.value = clock.current
      sh.uniforms.uScroll.value += MOTION.speed * dt // swell travels with the world
    }
  })

  const sandX = side * (SAND_INNER + SAND_WIDTH / 2)
  const seaX = side * (SEA_INNER + SEA_WIDTH / 2)
  const foamX = side * (SEA_INNER + FOAM_WIDTH / 2 - 0.15)

  return (
    <group>
      {/* Sea (rippling, scrolling). Lifted above the grass plane (both were at y=0
          and z-fought, hiding the water). */}
      <mesh material={seaMat} rotation={[-Math.PI / 2, 0, 0]} position={[seaX, 0.08, Z_CENTER]} receiveShadow>
        <planeGeometry args={[SEA_WIDTH, DEPTH, 44, 110]} />
      </mesh>
      {/* Sandy shoulder, over the water's inner edge so it reads as the dry shore. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sandX, 0.12, Z_CENTER]} receiveShadow>
        <planeGeometry args={[SAND_WIDTH, DEPTH]} />
        <meshStandardMaterial color={SAND_COLOR} roughness={1} />
      </mesh>
      {/* Static foam line at the waterline; the scrolling streaks ride over it. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[foamX, 0.14, Z_CENTER]}>
        <planeGeometry args={[FOAM_WIDTH, DEPTH]} />
        <meshStandardMaterial color={SHORE_FOAM} roughness={0.8} fog={false} />
      </mesh>
      <SeaFoam side={side} />
    </group>
  )
}
