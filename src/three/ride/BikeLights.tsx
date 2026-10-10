import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { IS_MOBILE } from '../../systems/device'

/**
 * Bike lights for a ride cyclist — a steady white head lamp on the bars and a
 * flashing red tail lamp on the seatpost, each with a glowing lens, a soft halo and a pool
 * of light "reflected" on the tarmac (an additive decal, so it reads on phones
 * too, where there's no bloom). Desktop also gets a short-range point light per
 * lamp so the beam actually lights the road and the rider's legs.
 *
 * Mounted INSIDE the cyclist's scaled + yawed group, so everything here is in
 * cyclist.glb model units: the bike's front is −Z (bars at z≈−0.41), its rear +Z
 * (saddle z 0.1–0.34), and the tyres touch y≈0.03.
 */

// Tunables (model units / seconds).
const FRONT = {
  color: new THREE.Color('#fff6e0'),
  lamp: [0, 0.5, -0.44] as const,
  // Steady (no flash): a soft, wide wash on the road ahead.
  // Near edge sits under the front wheel (z ≈ −0.4) so the V opens from the lamp.
  pool: { z: -2.4, w: 2.6, l: 4.0, opacity: 0.16 },
  halo: 0.2,
  light: { intensity: 0.6, distance: 3.2 },
}
const REAR = {
  color: new THREE.Color('#ff2a2a'),
  lamp: [0, 0.5, 0.31] as const,
  /** Steady on/off pulse. */
  period: 0.6,
  pool: { z: 0.75, w: 1.6, l: 2.0, opacity: 0.28 },
  light: { intensity: 0.8, distance: 2.4 },
}
const ROAD_Y = 0.035 // just above the tarmac + dashes
const HALO = 0.35 // peak tail-lamp halo opacity

// Sharp-edged but not instant: a flash rises/falls over ~25ms.
const flash = (t: number, on: number, off: number) => {
  const e = 0.025
  return THREE.MathUtils.clamp(Math.min((t - on) / e + 1, (off - t) / e + 1), 0, 1)
}
/** Tail lamp: on for the first half of each period. */
const rearLevel = (u: number) => flash(u, 0, 0.3)

/** Soft round falloff, centred at (cx, cy) in 0..1 — shared by halos and pools. */
function makeGlowTexture(cx = 0.5, cy = 0.5): THREE.Texture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(cx * S, cy * S, 0, cx * S, cy * S, S * 0.5)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A head-lamp beam as seen on the road: a V opening away from the bike, bright
 *  near the apex and fading out — every edge falls to zero, so the decal's
 *  rectangle never shows. Apex at v=0 (the canvas bottom), which the flat-laid
 *  plane puts at its +Z end, nearest the bike. */
function makeBeamTexture(): THREE.Texture {
  const W = 128, H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  const ss = THREE.MathUtils.smoothstep
  for (let y = 0; y < H; y++) {
    const v = 1 - (y + 0.5) / H // 0 at the apex (bottom row) → 1 far away
    const half = 0.06 + 0.94 * v // the V widens with distance
    const along = ss(v, 0, 0.12) * (1 - ss(v, 0.35, 1)) // ease in, long fade out
    for (let x = 0; x < W; x++) {
      const u = Math.abs((x + 0.5) / W - 0.5) * 2 // 0 centre → 1 plane edge
      const across = 1 - ss(u / half, 0.35, 1) // soft beam edges
      const a = along * across
      const i = (y * W + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(a * 255)
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function useLamp(color: THREE.Color, opacity: number, makePool: () => THREE.Texture) {
  const res = useMemo(() => {
    const halo = makeGlowTexture()
    const pool = makePool()
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }
    return {
      halo,
      pool,
      lens: new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.4), toneMapped: false }),
      haloMat: new THREE.SpriteMaterial({ map: halo, color, ...additive }),
      poolMat: new THREE.MeshBasicMaterial({ map: pool, color, opacity, ...additive }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(
    () => () => {
      res.halo.dispose()
      res.pool.dispose()
      res.lens.dispose()
      res.haloMat.dispose()
      res.poolMat.dispose()
    },
    [res],
  )
  return res
}

export function BikeLights({ phase = 0 }: { phase?: number }) {
  // The front throws a V-shaped beam; the rear a round glow just behind the bike
  // (the texture's −v end sits nearest the bike once laid flat).
  const front = useLamp(FRONT.color, FRONT.pool.opacity, makeBeamTexture)
  const rear = useLamp(REAR.color, REAR.pool.opacity, () => makeGlowTexture(0.5, 0.4))
  const rLight = useRef<THREE.PointLight>(null)
  const rHalo = useRef<THREE.Sprite>(null!)
  const lensOff = useMemo(() => new THREE.Color(0x222222), [])
  const rLensOn = useMemo(() => rear.lens.color.clone(), [rear])
  useMemo(() => {
    front.haloMat.opacity = FRONT.halo
  }, [front])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase * 2.3 // desync the two riders
    const r = rearLevel(((t + 0.21) % REAR.period) / REAR.period)

    rear.lens.color.lerpColors(lensOff, rLensOn, r)
    rear.haloMat.opacity = HALO * r
    rear.poolMat.opacity = REAR.pool.opacity * r
    rHalo.current.visible = r > 0.01
    if (rLight.current) rLight.current.intensity = REAR.light.intensity * r
  })

  return (
    <group>
      {/* Head lamp */}
      <mesh position={FRONT.lamp} material={front.lens}>
        <boxGeometry args={[0.07, 0.045, 0.03]} />
      </mesh>
      <sprite position={[FRONT.lamp[0], FRONT.lamp[1], FRONT.lamp[2] - 0.03]} scale={0.3} material={front.haloMat} />
      <mesh position={[0, ROAD_Y, FRONT.pool.z]} rotation={[-Math.PI / 2, 0, 0]} material={front.poolMat} renderOrder={2}>
        <planeGeometry args={[FRONT.pool.w, FRONT.pool.l]} />
      </mesh>

      {/* Tail lamp */}
      <mesh position={REAR.lamp} material={rear.lens}>
        <boxGeometry args={[0.04, 0.06, 0.025]} />
      </mesh>
      <sprite ref={rHalo} position={[REAR.lamp[0], REAR.lamp[1], REAR.lamp[2] + 0.03]} scale={0.3} material={rear.haloMat} />
      <mesh position={[0, ROAD_Y, REAR.pool.z]} rotation={[-Math.PI / 2, 0, 0]} material={rear.poolMat} renderOrder={2}>
        <planeGeometry args={[REAR.pool.w, REAR.pool.l]} />
      </mesh>

      {!IS_MOBILE && (
        <>
          <pointLight position={[0, 0.35, FRONT.lamp[2] - 0.5]} color={FRONT.color} distance={FRONT.light.distance} decay={1.5} intensity={FRONT.light.intensity} />
          <pointLight ref={rLight} position={[0, 0.35, REAR.lamp[2] + 0.4]} color={REAR.color} distance={REAR.light.distance} decay={1.5} intensity={0} />
        </>
      )}
    </group>
  )
}
