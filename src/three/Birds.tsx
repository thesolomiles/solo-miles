import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CAMERA } from '../config/constants'
import { useGame } from '../state/store'

// Flocks of birds crossing the town every so often — a lone bird, a handful, or
// now and then a big loose flock; sometimes in a V. From the 3/4 ortho camera a
// bird is a few pixels, so there's no Blender model: each one is a tiny chevron
// (body + two swept wings) built here, with the wing beat in the vertex shader.
//
// Flocks are aimed at whatever the camera is looking at: each starts just off one
// edge of the view (on the plane at its flying height) and crosses to the other,
// then the next is scheduled after a random gap. They fly well above the roofs,
// and cast shadows — at golden hour those sweep across the ground a long way
// off from the birds themselves (the sun is low, from the south-east).
//
// One InstancedMesh (pool of BIRDS.pool), one draw + one shadow draw.
const BIRDS = {
  pool: 26,
  gap: [25, 70], // seconds between one flock leaving and the next arriving
  firstGap: [6, 14], // after the intro lands
  height: [8, 11],
  speed: [11, 15], // world units / s
  scale: [0.55, 0.75], // wingspan ≈ 1.25 × scale
  margin: 3, // how far off-screen a flock starts / ends
  color: '#2b2522',
} as const

// Flock size: mostly a handful, sometimes a lone bird, occasionally a crowd.
function pickSize(): number {
  const r = Math.random()
  if (r < 0.12) return 1
  if (r < 0.8) return 3 + Math.floor(Math.random() * 7) // 3–9
  return 13 + Math.floor(Math.random() * 10) // 13–22
}

// Local frame: head at +x, wings along ±z, up +y.
function makeBirdGeometry(): THREE.BufferGeometry {
  const v: number[] = []
  const tri = (a: number[], b: number[], c: number[]) => v.push(...a, ...b, ...c)
  // Body diamond + tail fan.
  tri([0.3, 0, 0], [0.04, 0, 0.065], [-0.3, 0, 0])
  tri([0.3, 0, 0], [-0.3, 0, 0], [0.04, 0, -0.065])
  tri([-0.22, 0, 0], [-0.42, 0, 0.09], [-0.42, 0, -0.09])
  for (const s of [1, -1]) {
    const inL = [0.12, 0, 0.04 * s]
    const inT = [-0.1, 0, 0.04 * s]
    const midL = [0.05, 0, 0.34 * s]
    const midT = [-0.14, 0, 0.3 * s]
    const tip = [-0.2, 0, 0.64 * s]
    tri(inL, inT, midT)
    tri(inL, midT, midL)
    tri(midL, midT, tip)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
  g.computeVertexNormals()
  return g
}

// Wing beat: the wing rotates up/down about the body (lift ∝ distance out), the
// outer half lags behind the inner for a whip, and a slight dihedral holds the
// wings up when gliding. Shared by the colour and shadow-depth materials.
const FLAP_VERT = `
  float az = abs(transformed.z);
  float s = sin(aPhase);
  float outer = max(az - 0.3, 0.0);
  transformed.y += (az * s * 0.85 + outer * sin(aPhase - 0.9) * 0.9) * aAmp + az * 0.1;
  transformed.z *= 1.0 - 0.22 * aAmp * abs(s);`

function patchFlap(mat: THREE.Material) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `attribute float aPhase;
       attribute float aAmp;\n` +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>${FLAP_VERT}`)
  }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Bird {
  flock: Flock | null
  // Formation slot relative to the leader: back (along −heading), side, up.
  back: number
  side: number
  up: number
  scale: number
  seed: number
  phase: number
  flapRate: number
  amp: number
  flapping: boolean
  timer: number // until the next flap ↔ glide switch
}

interface Flock {
  x: number
  z: number
  y: number
  heading: number
  turn: number // gentle curve, rad/s
  speed: number
  age: number
  life: number
  birds: Bird[]
}

export function Birds() {
  const camera = useThree((s) => s.camera)

  const { mesh, phase, amp } = useMemo(() => {
    const geo = makeBirdGeometry()
    const n = BIRDS.pool
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    const amp = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    phase.setUsage(THREE.DynamicDrawUsage)
    amp.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aPhase', phase)
    geo.setAttribute('aAmp', amp)

    const mat = new THREE.MeshBasicMaterial({ color: BIRDS.color, side: THREE.DoubleSide })
    patchFlap(mat)
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide })
    patchFlap(depth)

    const m = new THREE.InstancedMesh(geo, mat, n)
    m.name = 'Birds'
    m.frustumCulled = false
    m.castShadow = true
    m.customDepthMaterial = depth
    m4Zero(m)
    return { mesh: m, phase, amp }
  }, [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      mesh.customDepthMaterial?.dispose()
    },
    [mesh],
  )

  const state = useMemo(
    () => ({
      birds: Array.from<unknown, Bird>({ length: BIRDS.pool }, () => ({
        flock: null,
        back: 0,
        side: 0,
        up: 0,
        scale: 1,
        seed: rand(0, 100),
        phase: rand(0, 6),
        flapRate: 10,
        amp: 1,
        flapping: true,
        timer: 0,
      })),
      flocks: [] as Flock[],
      timer: rand(BIRDS.firstGap[0], BIRDS.firstGap[1]),
      pending: 0, // a forced flock size from the dev hook (0 = none)
    }),
    [],
  )

  // Where a flock at height h should enter/leave: the view centre projected onto
  // the plane y = h, and the view's half-extents on that plane.
  const view = useMemo(() => {
    const dir = new THREE.Vector3(-CAMERA.offset.x, CAMERA.lookAtHeight - CAMERA.offset.y, -CAMERA.offset.z).normalize()
    return { dir, sinPitch: -dir.y }
  }, [])

  // Only ever one flock in the sky: a new one (e.g. from the dev hook) clears
  // any still crossing.
  const spawn = (size: number): boolean => {
    for (const f of state.flocks) for (const b of f.birds) b.flock = null
    state.flocks.length = 0
    const free = state.birds
    const n = Math.min(size, free.length)
    const cam = camera as THREE.OrthographicCamera
    const y = rand(BIRDS.height[0], BIRDS.height[1])
    const t = (y - cam.position.y) / view.dir.y
    const cx = cam.position.x + view.dir.x * t
    const cz = cam.position.z + view.dir.z * t
    const halfX = (cam.right - cam.left) / 2 / cam.zoom
    const halfZ = (cam.top - cam.bottom) / 2 / cam.zoom / view.sinPitch

    // Mostly across the screen (east↔west), sometimes any direction.
    const heading =
      Math.random() < 0.7 ? (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.55, 0.55) : rand(0, Math.PI * 2)
    const ux = Math.cos(heading)
    const uz = Math.sin(heading)
    const along = Math.abs(ux) * halfX + Math.abs(uz) * halfZ + BIRDS.margin
    const across = Math.abs(uz) * halfX + Math.abs(ux) * halfZ
    const off = rand(-0.55, 0.55) * across
    const speed = rand(BIRDS.speed[0], BIRDS.speed[1])

    const flock: Flock = {
      x: cx - ux * along - uz * off,
      z: cz - uz * along + ux * off,
      y,
      heading,
      turn: rand(-0.05, 0.05),
      speed,
      age: 0,
      life: 0,
      birds: [],
    }

    // Formation: a V for mid-size flocks (half the time), else one loose
    // cluster — tight enough that a big flock still reads as a single group.
    const spacing = rand(0.75, 1)
    const vee = n >= 5 && n <= 11 && Math.random() < 0.5
    const spread = Math.sqrt(n) * 0.5
    const baseScale = rand(BIRDS.scale[0], BIRDS.scale[1])
    let depth = 0
    for (let i = 0; i < n; i++) {
      const b = free[i]
      b.flock = flock
      if (n === 1 || (vee && i === 0)) {
        b.back = b.side = b.up = 0
      } else if (vee) {
        const k = Math.ceil(i / 2)
        b.back = k * spacing * 0.85 + rand(-0.1, 0.1)
        b.side = k * spacing * 0.75 * (i % 2 ? 1 : -1) + rand(-0.1, 0.1)
        b.up = rand(-0.2, 0.2)
      } else {
        const a = rand(0, Math.PI * 2)
        const r = spread * Math.sqrt(Math.random())
        b.back = Math.cos(a) * r * 1.2 + spread
        b.side = Math.sin(a) * r
        b.up = rand(-0.4, 0.4)
      }
      depth = Math.max(depth, b.back)
      b.scale = baseScale * rand(0.9, 1.1)
      b.flapRate = rand(15, 19)
      b.flapping = Math.random() < 0.7
      b.amp = b.flapping ? 1 : 0.1
      b.timer = rand(0.3, 2)
      flock.birds.push(b)
    }
    flock.life = (2 * along + depth + 2) / speed
    state.flocks.push(flock)
    return true
  }

  useEffect(() => {
    // Dev: summon a flock from the console — window.__birds.spawn(12).
    if (import.meta.env?.DEV)
      (window as unknown as { __birds?: unknown }).__birds = {
        spawn: (n = pickSize()) => {
          state.pending = n
        },
        state,
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const scl = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime

    if (state.pending) {
      spawn(state.pending)
      state.pending = 0
    } else if (useGame.getState().started && state.flocks.length === 0) {
      state.timer -= dt
      if (state.timer <= 0) {
        spawn(pickSize())
        state.timer = rand(BIRDS.gap[0], BIRDS.gap[1])
      }
    }

    // Flocks: glide along a gentle curve; retire once across the view.
    for (let i = state.flocks.length - 1; i >= 0; i--) {
      const f = state.flocks[i]
      f.age += dt
      f.heading += f.turn * dt
      f.x += Math.cos(f.heading) * f.speed * dt
      f.z += Math.sin(f.heading) * f.speed * dt
      if (f.age > f.life) {
        for (const b of f.birds) b.flock = null
        state.flocks.splice(i, 1)
      }
    }

    const ux = (h: number) => Math.cos(h)
    const uz = (h: number) => Math.sin(h)
    for (let i = 0; i < state.birds.length; i++) {
      const b = state.birds[i]
      const f = b.flock
      if (!f) {
        m4.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, m4)
        continue
      }
      // Bursts of flapping between glides.
      b.timer -= dt
      if (b.timer <= 0) {
        b.flapping = !b.flapping
        b.timer = b.flapping ? rand(1, 3) : rand(0.6, 1.8)
      }
      b.amp += ((b.flapping ? 1 : 0.08) - b.amp) * Math.min(1, dt * 3)
      b.phase += dt * b.flapRate * (0.35 + 0.65 * b.amp)

      // Formation slot + each bird's own drift within it.
      const back = b.back + Math.sin(t * 0.6 + b.seed) * 0.25
      const side = b.side + Math.sin(t * 0.8 + b.seed * 2) * 0.3
      const cx = ux(f.heading)
      const cz = uz(f.heading)
      pos.set(
        f.x - cx * back - cz * side,
        f.y + b.up + Math.sin(t * 1.1 + b.seed * 3) * 0.2 + Math.sin(b.phase) * 0.03 * b.amp,
        f.z - cz * back + cx * side,
      )
      // Yaw to the heading (+ a little wander), bank into the flock's curve.
      e.set(Math.sin(t * 0.9 + b.seed) * 0.12, -f.heading + Math.sin(t * 0.7 + b.seed) * 0.1, 0)
      e.x += f.turn * 4
      q.setFromEuler(e)
      scl.setScalar(b.scale)
      m4.compose(pos, q, scl)
      mesh.setMatrixAt(i, m4)
      phase.setX(i, b.phase)
      amp.setX(i, b.amp)
    }
    mesh.instanceMatrix.needsUpdate = true
    phase.needsUpdate = true
    amp.needsUpdate = true
  })

  return <primitive object={mesh} />
}

function m4Zero(m: THREE.InstancedMesh) {
  const z = new THREE.Matrix4().makeScale(0, 0, 0)
  for (let i = 0; i < m.count; i++) m.setMatrixAt(i, z)
}
