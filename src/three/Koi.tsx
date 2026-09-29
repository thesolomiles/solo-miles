import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getRiverGrid } from '../systems/riverDepth'
import { getRiverFoam } from '../systems/riverRocks'

// Koi in the river — flat, colourful silhouettes rather than modelled fish (the
// channel is only ~0.35 deep, and from the 3/4 camera a koi reads as a coloured
// shape anyway). Each one fades up out of the depths, idles around the deeper
// water — mostly nosing upstream (east) into the current, steering round the
// rocks and away from the shallows — then fades back down and turns up
// somewhere else a little later.
//
// One InstancedMesh, one draw. The quad is drawn AFTER the water (the water
// doesn't write depth) and tinted toward the water colour so it reads as under
// the surface while keeping its colours; solid things — bridge, rocks, roofs —
// still hide it through the depth test. The tail wag and the turn-bend are in
// the vertex shader.
const KOI = {
  count: 14,
  length: [0.9, 1.3],
  speed: [0.3, 0.55],
  drift: 0.12, // the current pushes everything west a little
  minDepth: 0.17, // steer away from water shallower than this
  life: [6, 13], // seconds visible per appearance
  gone: [1.5, 6], // seconds hidden between appearances
  fadeIn: 1.4,
  fadeOut: 1.6,
  below: 0.04, // how far under the (mean) surface they swim
  tint: 0.3, // how much of the water colour they take on
  opacity: 0.88,
  water: new THREE.Color('#2a7fb8'),
} as const

// Patterns, top-down: [base, fins, patches[] as [x, y, rx, ry, colour]].
// Cell is 256×96, head at +x (right), centre line y = 48.
type Patch = [number, number, number, number, string]
const RED = '#e2472c'
const WHITE = '#f6f1e6'
const VARIANTS: { base: string; fin: string; patches: Patch[] }[] = [
  // kohaku — white with big red saddles
  { base: WHITE, fin: '#fbf7ef', patches: [[206, 42, 30, 26, RED], [140, 54, 28, 24, RED], [96, 44, 12, 10, RED]] },
  // tancho — white with a red crown
  { base: WHITE, fin: '#fbf7ef', patches: [[222, 48, 13, 11, RED]] },
  // ogon — metallic gold, brighter down the back
  { base: '#f0ad2e', fin: '#f7cf6e', patches: [[150, 48, 90, 7, '#ffd66b']] },
  // showa — black with red and white
  { base: '#262224', fin: '#3d3638', patches: [[208, 44, 26, 24, RED], [150, 58, 24, 16, WHITE], [112, 40, 18, 14, RED]] },
  // benigoi — solid orange-red
  { base: '#ee6f2b', fin: '#f59a5c', patches: [[180, 48, 60, 6, '#f7874a']] },
]
const CELL_W = 256
const CELL_H = 96

function makeAtlas(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = CELL_W
  c.height = CELL_H * VARIANTS.length
  const g = c.getContext('2d')!
  VARIANTS.forEach((v, i) => {
    g.save()
    g.translate(0, i * CELL_H)
    // Tail fan and pectoral fins, a shade paler and see-through.
    g.fillStyle = v.fin
    g.globalAlpha = 0.8
    g.beginPath()
    g.moveTo(66, 48)
    g.quadraticCurveTo(30, 30, 6, 16)
    g.quadraticCurveTo(22, 48, 6, 80)
    g.quadraticCurveTo(30, 66, 66, 48)
    g.fill()
    for (const s of [-1, 1]) {
      g.beginPath()
      g.ellipse(176, 48 + s * 25, 17, 8, s * 0.55, 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = 1
    // Body: blunt nose at the right, widest behind the head, thin at the tail.
    const body = new Path2D()
    body.moveTo(250, 48)
    body.bezierCurveTo(248, 30, 205, 23, 165, 25)
    body.bezierCurveTo(120, 27, 85, 40, 60, 44)
    body.lineTo(60, 52)
    body.bezierCurveTo(85, 56, 120, 69, 165, 71)
    body.bezierCurveTo(205, 73, 248, 66, 250, 48)
    g.fillStyle = v.base
    g.fill(body)
    g.clip(body)
    for (const [x, y, rx, ry, col] of v.patches) {
      g.fillStyle = col
      g.beginPath()
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  })
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.flipY = false // cell i ↔ uv.y ∈ [i/N, (i+1)/N]
  t.anisotropy = 4
  return t
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

type Mode = 'hidden' | 'in' | 'swim' | 'out'
interface Fish {
  mode: Mode
  timer: number
  age: number
  life: number
  x: number
  z: number
  y: number
  heading: number // direction (cos, sin) in xz
  speed: number
  len: number
  fade: number
  phase: number
  bend: number
  seed: number
}

export function Koi() {
  const { mesh, fade, phase, bend, variant } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, CELL_H / CELL_W, 10, 1)
    geo.rotateX(-Math.PI / 2) // lie flat, facing up; local +x = head, local z = lateral
    const n = KOI.count
    const fade = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    const bend = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    const variant = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    for (const a of [fade, phase, bend]) a.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('aFade', fade)
    geo.setAttribute('aPhase', phase)
    geo.setAttribute('aBend', bend)
    geo.setAttribute('aVariant', variant)

    const mat = new THREE.MeshBasicMaterial({
      map: makeAtlas(),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWater = { value: KOI.water }
      shader.vertexShader =
        `attribute float aFade;
         attribute float aPhase;
         attribute float aBend;
         attribute float aVariant;
         varying float vFade;\n` +
        shader.vertexShader
          .replace(
            '#include <uv_vertex>',
            `#include <uv_vertex>
             vMapUv = vec2(uv.x, (uv.y + aVariant) / ${VARIANTS.length}.0);`,
          )
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vFade = aFade;
             // Tail wag grows toward the tail; the whole body arcs into a turn.
             float tk = 1.0 - uv.x;
             transformed.z += sin(aPhase - tk * 3.4) * tk * tk * 0.12;
             float along = uv.x - 0.55;
             transformed.z += aBend * along * along * 0.35;`,
          )
      shader.fragmentShader =
        `uniform vec3 uWater;
         varying float vFade;\n` +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
           // Sinking = more water colour, less koi.
           diffuseColor.rgb = mix(diffuseColor.rgb, uWater, mix(${KOI.tint}, 0.8, 1.0 - vFade));
           diffuseColor.a *= vFade * ${KOI.opacity};`,
        )
    }
    const m = new THREE.InstancedMesh(geo, mat, n)
    m.name = 'Koi'
    m.frustumCulled = false
    m.renderOrder = 2 // after the water
    return { mesh: m, fade, phase, bend, variant }
  }, [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.map?.dispose()
      mat.dispose()
    },
    [mesh],
  )

  const fish = useMemo<Fish[]>(
    () =>
      Array.from({ length: KOI.count }, (_, i) => {
        variant.setX(i, i % VARIANTS.length)
        return {
          mode: 'hidden' as Mode,
          timer: rand(0, 4), // staggered first appearances
          age: 0,
          life: 0,
          x: 0,
          z: 0,
          y: 0,
          heading: 0,
          speed: 0,
          len: 0,
          fade: 0,
          phase: rand(0, 6),
          bend: 0,
          seed: rand(0, 100),
        }
      }),
    [variant],
  )
  useEffect(() => {
    variant.needsUpdate = true
    // Dev: inspect / herd the koi from the console (window.__koi).
    if (import.meta.env?.DEV) (window as unknown as { __koi?: Fish[] }).__koi = fish
  }, [variant, fish])

  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const scl = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, rawDt) => {
    const grid = getRiverGrid()
    if (!grid) return
    const rocks = getRiverFoam()?.rocks ?? []
    const dt = Math.min(rawDt, 0.1)
    const t = clock.elapsedTime
    const depthAt = (x: number, z: number) => grid.sample(x, z)?.depth ?? -1

    const spawn = (f: Fish): boolean => {
      for (let tries = 0; tries < 40; tries++) {
        const x = rand(grid.minX + 1, grid.maxX - 1)
        const z = rand(grid.minZ, grid.maxZ)
        const s = grid.sample(x, z)
        if (!s || s.depth < 0.2) continue
        if (rocks.some((r) => Math.hypot(r.x - x, r.z - z) < r.r + 0.6)) continue
        f.x = x
        f.z = z
        f.y = s.y - KOI.below
        f.heading = Math.random() < 0.6 ? rand(-0.5, 0.5) : Math.PI + rand(-0.5, 0.5)
        f.speed = rand(KOI.speed[0], KOI.speed[1])
        f.len = rand(KOI.length[0], KOI.length[1])
        f.life = rand(KOI.life[0], KOI.life[1])
        f.age = 0
        f.mode = 'in'
        return true
      }
      return false
    }

    for (let i = 0; i < fish.length; i++) {
      const f = fish[i]
      if (f.mode === 'hidden') {
        f.timer -= dt
        if (f.timer > 0 || !spawn(f)) {
          fade.setX(i, 0)
          m4.makeScale(0, 0, 0)
          mesh.setMatrixAt(i, m4)
          continue
        }
      }

      // Lifecycle: rise, idle, sink.
      if (f.mode === 'in') {
        f.fade = Math.min(1, f.fade + dt / KOI.fadeIn)
        if (f.fade >= 1) f.mode = 'swim'
      } else if (f.mode === 'swim') {
        f.age += dt
        if (f.age > f.life) f.mode = 'out'
      } else if (f.mode === 'out') {
        f.fade = Math.max(0, f.fade - dt / KOI.fadeOut)
        if (f.fade <= 0) {
          f.mode = 'hidden'
          f.timer = rand(KOI.gone[0], KOI.gone[1])
        }
      }

      // Steering: a lazy wander, away from the shallows, round the rocks.
      let turn = Math.sin(t * 0.7 + f.seed) * 0.45 + Math.sin(t * 1.9 + f.seed * 3) * 0.2
      const look = 0.9
      const ahead = depthAt(f.x + Math.cos(f.heading) * look, f.z + Math.sin(f.heading) * look)
      if (ahead < KOI.minDepth) {
        const l = depthAt(f.x + Math.cos(f.heading + 0.7) * look, f.z + Math.sin(f.heading + 0.7) * look)
        const r = depthAt(f.x + Math.cos(f.heading - 0.7) * look, f.z + Math.sin(f.heading - 0.7) * look)
        turn += (l >= r ? 1 : -1) * 2.4
      }
      for (const r of rocks) {
        const dx = f.x - r.x
        const dz = f.z - r.z
        if (dx * dx + dz * dz < (r.r + 0.6) ** 2) {
          turn += Math.sign(wrapAngle(Math.atan2(dz, dx) - f.heading)) * 2.2
        }
      }
      f.heading = wrapAngle(f.heading + turn * dt)
      f.bend += (THREE.MathUtils.clamp(turn, -2.5, 2.5) - f.bend) * Math.min(1, dt * 4)

      f.x += Math.cos(f.heading) * f.speed * dt - KOI.drift * dt
      f.z += Math.sin(f.heading) * f.speed * dt
      // Beached or swept out of the channel → sink away early.
      if (f.mode !== 'out' && depthAt(f.x, f.z) < 0.08) f.mode = 'out'
      const s = grid.sample(f.x, f.z)
      if (s) f.y = s.y - KOI.below
      f.phase += dt * (5 + f.speed * 8 + Math.abs(turn) * 2)

      fade.setX(i, f.fade)
      phase.setX(i, f.phase)
      // Local +z is lateral; heading +θ turns toward world +z, which is local
      // −z after the yaw below, hence the minus.
      bend.setX(i, -f.bend * 0.25)
      q.setFromAxisAngle(up, -f.heading)
      pos.set(f.x, f.y, f.z)
      scl.set(f.len, 1, f.len)
      m4.compose(pos, q, scl)
      mesh.setMatrixAt(i, m4)
    }
    mesh.instanceMatrix.needsUpdate = true
    fade.needsUpdate = true
    phase.needsUpdate = true
    bend.needsUpdate = true
  })

  return <primitive object={mesh} />
}
