import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { NINJA_RUN as N } from '../../config/arcade'
import type { AirStep } from '../../arcade/ninjarun'
import { haloTexture } from './ninjaScenery'

/**
 * The double jump's mist puff, shared by Ninja Run and the forest walk: give
 * it anything holding `airSteps` (id, x, y, age — ages advanced by the owner,
 * dropped after NINJA_RUN.airStepSecs).
 */

/** Deterministic 0..1 per (burst, bit, salt), so a burst doesn't reshuffle each frame. */
export function sparkRand(id: number, j: number, salt: number) {
  let h = Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(j + 1, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

// --- Air step (double jump) -------------------------------------------------------

const STEP_POOL = 3
const STEP_PUFFS = 14
const MIST = new THREE.Color('#a9c6cf')

/** A feathered ring (soft both sides), for the flat "ledge" of air he pushes off. */
function stepRingTexture() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0, 'rgba(255,255,255,0)')
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  grd.addColorStop(0.8, 'rgba(255,255,255,0.8)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * The double jump's footprint in the air — like the intro's landing dust, but
 * made of mist: soft puffs kicked out sideways from under his feet (as if he'd
 * stamped on an invisible ledge), dragging to a stop, swelling and sinking a
 * touch as they fade, over a faint flat ring where the "ledge" was. It hangs
 * where he stepped (the sim scrolls it with the ground) and he rises out of it.
 * Positions are closed-form in the step's age (drag integrated), with each
 * puff's direction hashed from the step id, so nothing is simulated here.
 */
export function AirSteps({ state }: { state: RefObject<{ airSteps: AirStep[] }> }) {
  const puffs = useRef<THREE.InstancedMesh>(null!)
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const assets = useMemo(() => {
    const halo = haloTexture()
    const ringTex = stepRingTexture()
    const ringMat = () =>
      new THREE.MeshBasicMaterial({
        map: ringTex,
        color: MIST,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    return {
      halo,
      ringTex,
      card: new THREE.PlaneGeometry(1, 1),
      flat: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      puffMat: new THREE.MeshBasicMaterial({
        map: halo,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
      ringMats: Array.from({ length: STEP_POOL }, ringMat),
    }
  }, [])
  useEffect(
    () => () => {
      assets.halo.dispose()
      assets.ringTex.dispose()
      assets.card.dispose()
      assets.flat.dispose()
      assets.puffMat.dispose()
      assets.ringMats.forEach((m) => m.dispose())
    },
    [assets],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const col = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const steps = state.current.airSteps
    let n = 0
    for (let i = 0; i < STEP_POOL; i++) {
      const st = steps[i]
      const ring = rings.current[i]
      if (!st) {
        if (ring) ring.visible = false
        for (let j = 0; j < STEP_PUFFS; j++) {
          m.makeScale(0, 0, 0)
          puffs.current.setMatrixAt(n++, m)
        }
        continue
      }
      const t = st.age
      const k = Math.min(1, t / N.airStepSecs)
      const fade = (1 - k) * (1 - k)
      for (let j = 0; j < STEP_PUFFS; j++) {
        // Kicked out flat around his feet; drag brings each to a stop.
        const a = (j / STEP_PUFFS) * Math.PI * 2 + sparkRand(st.id, j, 3) * 0.5
        const sp = 1.4 + sparkRand(st.id, j, 4) * 2.4
        const out = (sp * (1 - Math.exp(-5 * t))) / 5
        const sink = -0.25 * (1 - Math.exp(-2.5 * t)) - sparkRand(st.id, j, 5) * 0.12
        p.set(st.x + Math.cos(a) * (0.2 + out), st.y + 0.05 + sink, Math.sin(a) * (0.2 + out) * 0.8)
        const size = (0.42 + sparkRand(st.id, j, 6) * 0.4) * (0.7 + 1.3 * (1 - Math.exp(-4 * t)))
        m.compose(p, q.identity(), sc.set(size, size * 0.8, size))
        puffs.current.setMatrixAt(n, m)
        puffs.current.setColorAt(n, col.copy(MIST).multiplyScalar(0.75 * fade))
        n++
      }
      if (ring) {
        ring.visible = true
        ring.position.set(st.x, st.y + 0.02, 0)
        const rk = Math.min(1, t / 0.35)
        ring.scale.setScalar(0.5 + (1 - (1 - rk) * (1 - rk)) * 2.2)
        assets.ringMats[i].opacity = 0.7 * (1 - rk) * (1 - rk)
      }
    }
    puffs.current.instanceMatrix.needsUpdate = true
    if (puffs.current.instanceColor) puffs.current.instanceColor.needsUpdate = true
  })
  return (
    <>
      <instancedMesh
        ref={(im) => {
          if (!im) return
          puffs.current = im
          // allocate instanceColor up front so the material compiles with it
          if (!im.instanceColor) for (let i = 0; i < im.count; i++) im.setColorAt(i, MIST)
        }}
        args={[assets.card, assets.puffMat, STEP_POOL * STEP_PUFFS]}
        frustumCulled={false}
      />
      {assets.ringMats.map((mat, i) => (
        <mesh
          key={i}
          geometry={assets.flat}
          material={mat}
          visible={false}
          // tipped toward the near-level camera so the ledge reads as a disc
          rotation={[0.45, 0, 0]}
          ref={(r) => {
            rings.current[i] = r
          }}
        />
      ))}
    </>
  )
}

