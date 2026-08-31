import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Airborne dust drifting over the town — the same idea as the ride scene's motes
// (soft additive points that twinkle as they catch the low golden-hour sun), but
// tuned for a static world: each speck wobbles and slowly drifts around its home
// point on the GPU rather than scrolling past, so nothing streams by while you
// stand still. A gentle warm haze of light in the air.
const DUST = {
  count: 260,
  xHalf: 26,
  zHalf: 20,
  zCentre: -8, // bias toward the town core / river, away from the empty south grass
  yLo: 0.6,
  yHi: 9,
  color: 0xffe7bf,
  size: 9,
} as const

function makeDiscTexture(): THREE.CanvasTexture {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

// Each speck orbits its home point (a slow lissajous drift) and twinkles on its
// own phase, so the field shimmers without any of it translating across the view.
const VERT = `
  uniform float uTime;
  uniform float uSize;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aSize;
  varying float vTw;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.18 + aPhase) * 1.1;
    p.y += sin(uTime * 0.26 + aPhase * 1.7) * 0.5;
    p.z += cos(uTime * 0.15 + aPhase * 0.8) * 1.1;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float tw = 0.25 + 0.75 * pow(sin(uTime * aSpeed + aPhase) * 0.5 + 0.5, 2.0);
    vTw = tw;
    gl_PointSize = uSize * aSize * tw;
    gl_Position = projectionMatrix * mv;
  }
`
const FRAG = `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  varying float vTw;
  void main() {
    float a = texture2D(uTex, gl_PointCoord).a;
    gl_FragColor = vec4(uColor, a * vTw * 0.85);
  }
`

/** Floating golden dust over the town. */
export function TownDust() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(DUST.count * 3)
    const aPhase = new Float32Array(DUST.count)
    const aSpeed = new Float32Array(DUST.count)
    const aSize = new Float32Array(DUST.count)
    let seed = 0x1d05
    const r = () => {
      seed |= 0
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    for (let i = 0; i < DUST.count; i++) {
      pos[i * 3] = (r() * 2 - 1) * DUST.xHalf
      pos[i * 3 + 1] = DUST.yLo + r() * (DUST.yHi - DUST.yLo)
      pos[i * 3 + 2] = DUST.zCentre + (r() * 2 - 1) * DUST.zHalf
      aPhase[i] = r() * Math.PI * 2
      aSpeed[i] = 0.5 + r() * 1.6
      aSize[i] = 0.5 + r() * 1.2
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1))
    return g
  }, [])
  const tex = useMemo(makeDiscTexture, [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSize: { value: DUST.size },
          uTex: { value: tex },
          uColor: { value: new THREE.Color(DUST.color) },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
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
    if (matRef.current) matRef.current.uniforms.uTime.value += Math.min(delta, 0.05)
  })
  return (
    <points geometry={geom} frustumCulled={false}>
      <primitive object={mat} ref={matRef} attach="material" />
    </points>
  )
}
