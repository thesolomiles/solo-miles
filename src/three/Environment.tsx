import { useMemo } from 'react'
import { BUILDINGS, TRAIL, WORLD } from '../config/town'
import { useRegisterInteractable } from '../systems/interactables'
import { Label } from './Label'

/** Deterministic RNG so the forest/rocks don't reshuffle on every reload. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PINE_COLS = [0x5f7d43, 0x6d8a4b, 0x54703a]

function Pine({ x, z, s, rot }: { x: number; z: number; s: number; rot: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.6 * s, 0]} castShadow>
        <cylinderGeometry args={[0.22 * s, 0.32 * s, 1.2 * s, 7]} />
        <meshStandardMaterial color={0x8a5a3c} roughness={0.9} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, (1.35 + i * 0.95) * s, 0]} castShadow>
          <coneGeometry args={[(1.15 - i * 0.28) * s, (1.5 - i * 0.2) * s, 8]} />
          <meshStandardMaterial color={PINE_COLS[i]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Rock({ x, z, s, rot }: { x: number; z: number; s: number; rot: [number, number, number] }) {
  return (
    <mesh position={[x, s * 0.55, z]} rotation={rot} castShadow receiveShadow>
      <dodecahedronGeometry args={[s, 0]} />
      <meshStandardMaterial color={0x9a958b} roughness={1} />
    </mesh>
  )
}

/** A flat coloured disc (plaza paving). */
function Paved({ r, x, z, color }: { r: number; x: number; z: number; color: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, z]} receiveShadow>
      <circleGeometry args={[r, 40]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

/** A dirt path from (x1,z1) to (x2,z2). */
function Road({
  from,
  to,
  width,
  color = 0xcdb083,
}: {
  from: [number, number]
  to: [number, number]
  width: number
  color?: number
}) {
  const [x1, z1] = from
  const [x2, z2] = to
  const dx = x2 - x1
  const dz = z2 - z1
  const len = Math.hypot(dx, dz)
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, -Math.atan2(dz, dx) + Math.PI / 2]}
      position={[(x1 + x2) / 2, 0.02, (z1 + z2) / 2]}
      receiveShadow
    >
      <planeGeometry args={[width, len]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

export function Environment() {
  useRegisterInteractable(TRAIL.interact, TRAIL.interactPos)

  const { pines, rocks } = useMemo(() => {
    const rnd = mulberry32(1337)
    const pines: { x: number; z: number; s: number; rot: number }[] = []
    // three concentric forest rings, with a gap where the trail breaks through
    for (let i = 0; i < WORLD.forestRings; i++) {
      const R = WORLD.forestInner + i * 4
      const step = 0.16 - i * 0.02
      for (let a = 0; a < Math.PI * 2; a += step) {
        if (a > WORLD.trailGap[0] && a < WORLD.trailGap[1]) continue
        pines.push({
          x: Math.cos(a) * R + (rnd() - 0.5) * 3,
          z: Math.sin(a) * R + (rnd() - 0.5) * 3,
          s: 0.85 + rnd() * 0.7,
          rot: rnd() * 6.28,
        })
      }
    }
    // pines lining the trail south
    for (let i = 0; i < 5; i++) {
      pines.push({ x: -4 - rnd() * 2, z: -18 - i * 4, s: 0.9 + rnd() * 0.5, rot: rnd() * 6.28 })
      pines.push({ x: 4 + rnd() * 2, z: -18 - i * 4, s: 0.9 + rnd() * 0.5, rot: rnd() * 6.28 })
    }
    const rockDefs: [number, number, number][] = [
      [-8, 3, 0.9],
      [9, -2, 0.7],
      [5, 12, 0.8],
      [-10, -3, 0.7],
    ]
    const rocks = rockDefs.map(([x, z, s]) => ({
      x,
      z,
      s,
      rot: [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28] as [number, number, number],
    }))
    return { pines, rocks }
  }, [])

  return (
    <group>
      {/* ground disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[WORLD.groundRadius, 64]} />
        <meshStandardMaterial color={WORLD.ground} roughness={1} />
      </mesh>

      {/* plaza + roads */}
      <Paved r={WORLD.plazaRadius} x={0} z={0} color={0xd8c39a} />
      {BUILDINGS.map((b) => (
        <Road key={b.id} from={[0, 0]} to={[b.pos[0] * 0.6, b.pos[1] * 0.6]} width={3.2} />
      ))}
      <Road from={[0, 0]} to={[0, -34]} width={3.8} color={0xc9ae7f} />

      {/* trail signpost */}
      <group position={[TRAIL.signpostPos[0], 0, TRAIL.signpostPos[1]]}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 2.2, 8]} />
          <meshStandardMaterial color={0x7a5a40} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.7, 0]} castShadow>
          <boxGeometry args={[2.4, 0.7, 0.14]} />
          <meshStandardMaterial color={0xb98a5a} roughness={0.9} />
        </mesh>
        <Label text="To the forest →" position={[0, 2.6, 0]} width={3.8} />
      </group>

      {/* forest + rocks */}
      {pines.map((p, i) => (
        <Pine key={`p${i}`} {...p} />
      ))}
      {rocks.map((r, i) => (
        <Rock key={`r${i}`} {...r} />
      ))}
    </group>
  )
}
