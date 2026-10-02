import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { glowTexture, hash3 } from './forestAssets'
import { CHARACTER_LAYER } from './CharacterMask'
import { FOREST } from '../../config/forest'
import { forestFrame, forestView } from '../../systems/forestView'

/**
 * The forest wisp — a small, cute spirit that floats ahead of Leonard and
 * playfully leads him somewhere (Leonard's idea, 2026-10-02). Of four look-dev
 * variants he picked "sprout" in "mochi"'s pale blue, made of vapour rather
 * than solid, its tail trailing behind as it moves:
 *
 * - a plain round head and little arms, with a soft, blurred face: two dark
 *   smudges for eyes and a faint smile, abstract like a glow seen through
 *   mist;
 * - the body is gas: hand-brushed felt strokes (like the foreground's baked
 *   brushwork, so it's painted like the forest) fading out toward its edges,
 *   with slow noise drifting up through the fade;
 * - the tail is a chain that follows where the body has been, so it streams
 *   behind when the wisp darts and settles into a hanging curl at rest, and
 *   it sheds little puffs of vapour.
 *
 * The body goes through the brush filter; the face's smudges skip it (it
 * would paint them away), their softness coming from the blur instead.
 * How it behaves: WispGuide below (knobs: FOREST.wisp). Dev: `__wisp`.
 */

const COLOR = '#bfe6ff'

/** Felted brushwork: a pale base worked over with short, mostly upright
 *  strokes, lighter and darker. Tinted by the material colour. */
function feltTexture(): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#e6e6e6'
  g.fillRect(0, 0, S, S)
  g.lineCap = 'round'
  for (let k = 0; k < 2200; k++) {
    const r = (s: number) => hash3(k, 61, s)
    const x = r(1) * S
    const y = r(2) * S
    const len = 4 + r(3) * 12
    const a = Math.PI / 2 + (r(4) - 0.5) * 0.9
    const t = r(5)
    g.strokeStyle = t < 0.45 ? '#ffffff' : t < 0.85 ? '#bdbdbd' : '#9a9a9a'
    g.globalAlpha = 0.25 + r(6) * 0.35
    g.lineWidth = 1 + r(7) * 2
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        g.beginPath()
        g.moveTo(x + ox - (Math.cos(a) * len) / 2, y + oy - (Math.sin(a) * len) / 2)
        g.lineTo(x + ox + (Math.cos(a) * len) / 2, y + oy + (Math.sin(a) * len) / 2)
        g.stroke()
      }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

const GAS_NOISE = /* glsl */ `
float gHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float gNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
`

/**
 * Vapour: the felt-painted glow, see-through toward the silhouette (where you
 * look through the least of it) and broken up by noise drifting upward. With
 * `fade`, an `aFade` vertex attribute (1 → 0) thins it out along the tail.
 */
function gasMaterial(felt: THREE.Texture, time: { value: number }, fade: boolean) {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(COLOR).multiplyScalar(0.72),
    map: felt,
    emissive: COLOR,
    emissiveMap: felt,
    emissiveIntensity: 0.45,
    roughness: 1,
    transparent: true,
    depthWrite: false,
    // Front faces only on the head (its back adding up behind would make it
    // read solid); the thin tail shows both.
    side: fade ? THREE.DoubleSide : THREE.FrontSide,
  })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vGasPos;\n' + (fade ? 'attribute float aFade;\nvarying float vFade;\n' : ''),
      )
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGasPos = position;\n' + (fade ? 'vFade = aFade;\n' : ''))
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nvarying vec3 vGasPos;\n' + (fade ? 'varying float vFade;\n' : '') + GAS_NOISE,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          // Thickest through the middle, thinning to nothing at the rim; the
          // rim itself frayed by noise drifting upward, so it smokes.
          float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
          float n = gNoise(vGasPos * 8.0 + vec3(0.0, -uTime * 1.3, uTime * 0.4));
          float n2 = gNoise(vGasPos * 20.0 + vec3(uTime * 0.7, -uTime * 2.1, 0.0));
          float core = smoothstep(0.15, 0.95, facing);
          float a = (0.12 + 0.5 * core) * (0.45 + 0.8 * n);
          a *= smoothstep(0.0, 0.45, facing + (n2 - 0.5) * 0.5);
          diffuseColor.a *= clamp(a, 0.0, 0.7)${fade ? ' * vFade' : ''};
        }`,
      )
  }
  m.customProgramCacheKey = () => 'wisp-gas-' + fade
  return m
}

/** The face as one soft image: two dark smudges and a faint smile, drawn
 *  blurred so it reads abstract, like a face glimpsed in mist. */
function faceTexture(): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.filter = 'blur(6px)'
  g.fillStyle = '#081620'
  for (const x of [S * 0.32, S * 0.68]) {
    g.beginPath()
    g.ellipse(x, S * 0.43, S * 0.095, S * 0.12, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.filter = 'blur(5px)'
  g.strokeStyle = '#081620'
  g.globalAlpha = 0.8
  g.lineWidth = S * 0.035
  g.lineCap = 'round'
  g.beginPath()
  g.arc(S / 2, S * 0.6, S * 0.07, Math.PI * 0.2, Math.PI * 0.8)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// --- The trailing tail ---------------------------------------------------------------

/** Points in the tail chain, ring segments round it, and the gap between points. */
const TAIL_N = 16
const TAIL_SIDES = 10
const TAIL_SEG = 0.045
/** Radius at the chest (where it grows out from under the head) and the tip. */
const TAIL_R0 = 0.11

/** A tube whose rings are rebuilt each frame along the chain. */
function tailGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  const verts = TAIL_N * (TAIL_SIDES + 1)
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
  const uv = new Float32Array(verts * 2)
  const fade = new Float32Array(verts)
  for (let i = 0; i < TAIL_N; i++)
    for (let j = 0; j <= TAIL_SIDES; j++) {
      const v = i * (TAIL_SIDES + 1) + j
      uv[v * 2] = j / TAIL_SIDES
      uv[v * 2 + 1] = (i / (TAIL_N - 1)) * 1.5
      const t = i / (TAIL_N - 1)
      fade[v] = Math.pow(1 - t, 0.9)
    }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aFade', new THREE.BufferAttribute(fade, 1))
  const idx: number[] = []
  for (let i = 0; i < TAIL_N - 1; i++)
    for (let j = 0; j < TAIL_SIDES; j++) {
      const a = i * (TAIL_SIDES + 1) + j
      const b = a + TAIL_SIDES + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  g.setIndex(idx)
  return g
}

const _t = new THREE.Vector3()
const _n = new THREE.Vector3()
const _b = new THREE.Vector3()
const _d = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)

/** Lay the tube's rings along the chain, thinning to a point. */
function writeTail(g: THREE.BufferGeometry, pts: THREE.Vector3[], swell: number) {
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < TAIL_N; i++) {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(TAIL_N - 1, i + 1)]
    _t.subVectors(b, a).normalize()
    _n.crossVectors(_t, _z)
    if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0)
    _n.normalize()
    _b.crossVectors(_t, _n).normalize()
    const t = i / (TAIL_N - 1)
    const r = TAIL_R0 * Math.pow(1 - t, 0.85) * swell + 0.004
    for (let j = 0; j <= TAIL_SIDES; j++) {
      const ang = (j / TAIL_SIDES) * Math.PI * 2
      const c = Math.cos(ang) * r
      const s = Math.sin(ang) * r
      pos.setXYZ(
        i * (TAIL_SIDES + 1) + j,
        pts[i].x + _n.x * c + _b.x * s,
        pts[i].y + _n.y * c + _b.y * s,
        pts[i].z + _n.z * c + _b.z * s,
      )
    }
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  g.computeBoundingSphere()
}

// --- Puffs shed from the tail ----------------------------------------------------------

const PUFFS = 12
interface Puff {
  age: number
  life: number
  pos: THREE.Vector3
  vel: THREE.Vector3
}

// --- The wisp ----------------------------------------------------------------------------

/**
 * The wisp. `motion(t)` says where its body is at time t (in the parent's
 * space); the tail and puffs work out the rest from how it actually moved.
 */
export function Wisp({ motion }: { motion: (t: number, out: THREE.Vector3) => void }) {
  const body = useRef<THREE.Group>(null!)
  const tail = useRef<THREE.Mesh>(null!)
  const puffRefs = useRef<(THREE.Sprite | null)[]>([])

  const assets = useMemo(() => {
    const felt = feltTexture()
    const time = { value: 0 }
    const gas = gasMaterial(felt, time, false)
    const tailGas = gasMaterial(felt, time, true)
    const halo = glowTexture()
    const face = faceTexture()
    return {
      felt,
      time,
      gas,
      tailGas,
      tailGeom: tailGeometry(),
      face,
      faceMat: new THREE.MeshBasicMaterial({ map: face, transparent: true, depthWrite: false }),
      // Where the smudges are, the face skips the brush filter (CharacterMask),
      // which would otherwise paint it away at this size; its softness is the
      // blur in the texture.
      faceMask: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: face, alphaTest: 0.3 }),
      faceGeom: new THREE.PlaneGeometry(0.34, 0.34),
      halo,
      haloMat: new THREE.SpriteMaterial({
        map: halo,
        color: COLOR,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.32,
      }),
      coreMat: new THREE.SpriteMaterial({
        map: halo,
        color: '#eaf7ff',
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.55,
      }),
      puffMat: Array.from(
        { length: PUFFS },
        () =>
          new THREE.SpriteMaterial({
            map: halo,
            color: COLOR,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0,
          }),
      ),
    }
  }, [])
  useEffect(
    () => () => {
      const { time: _time, puffMat, ...rest } = assets
      for (const v of Object.values(rest)) v.dispose()
      puffMat.forEach((m) => m.dispose())
    },
    [assets],
  )

  const sim = useMemo(
    () => ({
      pts: Array.from({ length: TAIL_N }, (_, i) => new THREE.Vector3(0, 0.36 - i * TAIL_SEG, 0)),
      prev: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      root: new THREE.Vector3(),
      puffs: Array.from({ length: PUFFS }, (): Puff => ({ age: 1, life: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3() })),
      nextPuff: 0,
      puffClock: 0,
      started: false,
    }),
    [],
  )

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const t = clock.elapsedTime
    assets.time.value = t
    const b = body.current

    // Body: wherever the motion puts it, leaning into its speed, breathing.
    motion(t, b.position)
    if (!sim.started) {
      sim.prev.copy(b.position)
      sim.started = true
    }
    sim.vel.subVectors(b.position, sim.prev).divideScalar(Math.max(dt, 1e-4))
    sim.prev.copy(b.position)
    b.rotation.z = THREE.MathUtils.clamp(-sim.vel.x * 0.09, -0.5, 0.5) + 0.06 * Math.sin(t * 1.3)
    b.rotation.y = 0.25 * Math.sin(t * 0.6)
    const s = 1 + 0.04 * Math.sin(t * 3.4)
    b.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s))
    b.updateMatrix()

    // Tail: the root sits under the head; each point after it hangs off the
    // one before, easing toward a lazy curl but lagging behind when the body
    // moves, so it streams out behind.
    const P = sim.pts
    P[0].set(0, 0.36, 0).applyMatrix4(b.matrix)
    const ease = 1 - Math.exp(-dt * 4.5)
    const side = sim.vel.x > 0.3 ? -1 : 1
    for (let i = 1; i < TAIL_N; i++) {
      const k = i / (TAIL_N - 1)
      const curlA = side * (0.15 + 1.1 * k * k) + 0.25 * Math.sin(t * 2.6 - i * 0.55)
      _d.subVectors(P[i], P[i - 1])
      _d.x += (Math.sin(curlA) * TAIL_SEG - _d.x) * ease
      _d.y += (-Math.cos(curlA) * TAIL_SEG - _d.y) * ease
      _d.z *= 1 - ease
      _d.setLength(TAIL_SEG)
      P[i].addVectors(P[i - 1], _d)
    }
    writeTail(assets.tailGeom, P, 1 + 0.06 * Math.sin(t * 4))

    // Puffs: shed from the tip, more often the faster it goes; they drift up,
    // swell and fade.
    const speed = sim.vel.length()
    sim.puffClock -= dt
    if (sim.puffClock <= 0) {
      sim.puffClock = speed > 1.5 ? 0.06 : 0.35
      const p = sim.puffs[sim.nextPuff]
      sim.nextPuff = (sim.nextPuff + 1) % PUFFS
      p.age = 0
      p.life = 0.9 + Math.random() * 0.6
      p.pos.copy(P[TAIL_N - 1 - Math.floor(Math.random() * 4)])
      p.vel.set((Math.random() - 0.5) * 0.3, 0.25 + Math.random() * 0.2, 0)
    }
    sim.puffs.forEach((p, i) => {
      const spr = puffRefs.current[i]
      if (!spr) return
      p.age += dt
      const k = Math.min(1, p.age / p.life)
      p.pos.addScaledVector(p.vel, dt)
      spr.position.copy(p.pos)
      const sz = 0.12 + 0.3 * k
      spr.scale.set(sz, sz, 1)
      assets.puffMat[i].opacity = k >= 1 ? 0 : 0.28 * Math.sin(Math.PI * k)
    })
  })

  return (
    <group>
      <group ref={body}>
        {/* Arms */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.17, 0.33, 0]} rotation={[0, 0, s * -1.0]} scale={[0.5, 1, 0.5]} material={assets.gas}>
            <sphereGeometry args={[0.07, 12, 10]} />
          </mesh>
        ))}
        <mesh position={[0, 0.6, 0]} scale={[1.1, 1, 1]} material={assets.gas}>
          <sphereGeometry args={[0.24, 28, 20]} />
        </mesh>
        <mesh
          position={[0, 0.58, 0.25]}
          geometry={assets.faceGeom}
          material={assets.faceMat}
          userData={{ maskMaterial: assets.faceMask }}
          layers-mask={1 | (1 << CHARACTER_LAYER)}
        />
        {/* A brighter core glowing through the vapour, and the halo round it. */}
        <sprite material={assets.coreMat} position={[0, 0.55, 0]} scale={[0.75, 0.75, 1]} />
        <sprite material={assets.haloMat} position={[0, 0.5, 0]} scale={[1.8, 1.8, 1]} />
        {/* Below it, so it lights the ground and the ferns, not its own face. */}
        <pointLight color={COLOR} intensity={3} distance={4} decay={2} position={[0, -0.25, 0.2]} />
      </group>
      <mesh ref={tail} geometry={assets.tailGeom} material={assets.tailGas} frustumCulled={false} />
      {assets.puffMat.map((m, i) => (
        <sprite
          key={i}
          material={m}
          ref={(s) => {
            puffRefs.current[i] = s
          }}
        />
      ))}
    </group>
  )
}

/** Smoothstep with the edges given. */
const sstep = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b)

/**
 * The wisp's mind (FOREST.wisp). It's leading him somewhere to the right
 * (+x), and only ever keeps to that side. It turns up once Leonard has
 * started walking, swooping in from the right edge of the frame. While he
 * walks right it stays in front, drifting about, now and then darting out of
 * frame and peeking back in — come on, this way. Walking left, it hangs back
 * on the right of the frame, beckoning him round. When he stops it waits (bobbing
 * forward, beckoning); after a while it drifts closer, closer the longer he
 * stands, until it's circling him. The moment he walks on it races back out
 * in front.
 */
export function WispGuide() {
  const size = useThree((s) => s.size)
  const frame = useRef({ halfX: 8 })
  frame.current.halfX = forestFrame(size.width / Math.max(size.height, 1)).halfX

  const motion = useMemo(() => {
    const W = FOREST.wisp
    const st = {
      lastT: -1,
      startX: NaN,
      started: false,
      prevX: 0,
      prevCam: NaN,
      speed: 0,
      idle: 0,
      rush: 0,
      waitLead: 2,
      orbitA: 0,
      cycleStart: 0,
      cycleN: 0,
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
    }
    return (t: number, out: THREE.Vector3) => {
      if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__wisp = st
      const dt = st.lastT < 0 ? 1 / 60 : Math.min(0.05, Math.max(0, t - st.lastT))
      st.lastT = t
      const halfX = frame.current.halfX
      const wx = forestView.walkerX
      const camX = forestView.camX
      if (Number.isNaN(st.startX)) {
        st.startX = wx
        st.prevX = wx
      }
      // His pace, smoothed (teleports aside).
      const v = Math.abs(wx - st.prevX) / Math.max(dt, 1e-4)
      st.prevX = wx
      st.speed += ((v > 20 ? 0 : v) - st.speed) * Math.min(1, dt * 10)
      const moving = st.speed > 0.4
      // Where it's leading him: always to the right (+x). Leonard: the wisp
      // only ever stays on that side.
      const towards = forestView.facing > 0
      const offscreen = camX + halfX + 3

      // Not yet: it waits just out of frame ahead, unseen.
      if (!st.started) {
        st.pos.set(offscreen, W.height + 0.6, -0.3)
        out.copy(st.pos)
        if (Math.abs(wx - st.startX) > W.appearAfter) {
          st.started = true
          st.cycleStart = t
        }
        return
      }

      const bob = 0.28 * Math.sin(t * 1.3) + 0.12 * Math.sin(t * 2.9 + 1)
      let rate: number = W.follow
      if (moving) {
        if (st.idle > 0.4) st.rush = W.rushFor // he's off again: race ahead
        st.idle = 0
        const z = -0.3 + 0.35 * Math.sin(t * 0.7)
        if (towards) {
          // Zipping in and out of the frame ahead: in to a spot well ahead of
          // him, anywhere from the ferns to up among the trunks; hover there,
          // looping loosely; zip back out past the edge; stay out a moment.
          const h = (salt: number) => hash3(st.cycleN, 5, salt)
          const lerp = THREE.MathUtils.lerp
          const hold = lerp(W.hold[0], W.hold[1], h(1))
          const away = lerp(W.away[0], W.away[1], h(2))
          let e = t - st.cycleStart
          if (e > W.zip * 2 + hold + away) {
            st.cycleN++
            st.cycleStart = t
            e = 0
          }
          const spotX = camX + halfX * lerp(W.spotK[0], W.spotK[1], h(3))
          const spotY = lerp(W.spotY[0], W.spotY[1], h(4))
          const outX = camX + halfX * W.outK
          const outY = lerp(W.outY[0], W.outY[1], h(5))
          if (e < W.zip) {
            // Zip in, swooping a little on the way.
            st.target.set(spotX, spotY + 0.8 * Math.sin((e / W.zip) * Math.PI), z)
            rate = W.dart
          } else if (e < W.zip + hold) {
            st.target.set(spotX + 0.5 * Math.sin(t * 1.7), spotY + 0.45 * Math.sin(t * 2.3 + 1), z)
          } else if (e < W.zip * 2 + hold) {
            st.target.set(outX, outY + 0.8 * Math.sin(((e - W.zip - hold) / W.zip) * Math.PI), z)
            rate = W.dart
          } else st.target.set(outX, outY, z)
        } else {
          // Walking away from where it's leading: it hangs back on the right
          // of the frame, never leaving it, beckoning him to turn round, and
          // roaming up and down.
          const k = 0.6 + 0.15 * Math.sin(t * 0.8) + 0.12 * Math.pow(Math.max(0, Math.sin(t * 2.4)), 3)
          st.target.set(camX + halfX * k, W.height + 1.6 * (0.5 + 0.5 * Math.sin(t * 0.45)) + bob, z)
        }
        st.orbitA = 0 // circling starts on his right
      } else {
        if (st.idle === 0) {
          // Just stopped: hold about here, but back inside the frame.
          const ahead = st.pos.x - wx
          const edge = camX - wx + halfX * 0.8
          st.waitLead = THREE.MathUtils.clamp(ahead, W.closest, Math.max(W.closest, edge))
        }
        st.idle += dt
        // Waiting, with little forward bobs — this way! Then closer and
        // closer the longer he stands there, and in the end, circling him.
        const close = sstep(W.waitAfter, W.waitAfter + W.closeIn, st.idle)
        const lead = THREE.MathUtils.lerp(st.waitLead, W.closest, close)
        const beckon = (1 - close) * 0.35 * Math.pow(Math.max(0, Math.sin(t * 2.4)), 3)
        // In polar terms round him (angle 0 = his right), so going from
        // waiting in front to circling slides round the circle rather than
        // cutting across it, past his nose.
        const orbit = sstep(W.waitAfter + W.closeIn * 0.7, W.waitAfter + W.closeIn + 2, st.idle)
        st.orbitA += W.orbitSpeed * dt * orbit
        const r = THREE.MathUtils.lerp(lead + beckon, W.orbitR, orbit)
        st.target.set(
          wx + r * Math.cos(st.orbitA), // from 0: on his right
          // Side-on, crossing behind or in front of him would sit it right on
          // him on screen, so it arcs up over his head as it crosses.
          THREE.MathUtils.lerp(
            W.height + bob + 1.0 * (0.5 + 0.5 * Math.sin(t * 0.4)), // waiting, drifting up and down
            W.height * 0.9 + W.orbitLift * (1 - Math.abs(Math.cos(st.orbitA))) + 0.1 * Math.sin(st.orbitA * 2),
            orbit,
          ),
          THREE.MathUtils.lerp(-0.3, 0, orbit) + r * 0.95 * Math.sin(st.orbitA),
        )
        rate = W.follow * 0.8
      }
      if (st.rush > 0) {
        st.rush -= dt
        rate = W.rush
      }
      // Ride along with the camera, then ease toward the target: otherwise,
      // chasing a target that moves with the frame, it trails behind it
      // (into his face) by the walking speed over the rate.
      if (!Number.isNaN(st.prevCam)) st.pos.x += camX - st.prevCam
      st.prevCam = camX
      st.pos.lerp(st.target, 1 - Math.exp(-rate * dt))
      out.copy(st.pos)
    }
  }, [])

  return <Wisp motion={motion} />
}
