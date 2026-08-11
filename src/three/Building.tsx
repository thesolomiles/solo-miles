import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { buildingInteractPos, type BuildingDef } from '../config/town'
import { useRegisterInteractable } from '../systems/interactables'
import { Label } from './Label'

/** Drifting chimney smoke — a few spheres rising and fading on a loop. */
function Smoke({ x, y, z }: { x: number; y: number; z: number }) {
  const refs = useRef<THREE.Mesh[]>([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const ph = (t * 0.32 + i * 0.28) % 1
      m.position.y = y + ph * 2.4
      ;(m.material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - ph)
      m.scale.setScalar(0.6 + ph * 1.1)
    })
  })
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => { if (el) refs.current[i] = el }} position={[x, y, z]}>
          <sphereGeometry args={[0.28, 8, 8]} />
          <meshStandardMaterial color={0xece7df} transparent opacity={0.5} roughness={1} />
        </mesh>
      ))}
    </>
  )
}

/** The player's bike, parked out front of Mi casa. */
function ParkedBike({ x, z }: { x: number; z: number }) {
  const c = 0x3a6f7a
  return (
    <group position={[x, 0, z]} rotation={[0, 0.35, 0]}>
      {[-0.55, 0.55].map((dx) => (
        <mesh key={dx} position={[dx, 0.42, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.42, 0.07, 8, 18]} />
          <meshStandardMaterial color={0x2f2a25} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.0, 0.09, 0.09]} />
        <meshStandardMaterial color={c} roughness={0.6} />
      </mesh>
      <mesh position={[-0.4, 0.78, 0]} castShadow>
        <boxGeometry args={[0.35, 0.09, 0.18]} />
        <meshStandardMaterial color={0x2f2a25} roughness={0.9} />
      </mesh>
      <mesh position={[0.5, 0.78, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.5, 8]} />
        <meshStandardMaterial color={c} roughness={0.6} />
      </mesh>
    </group>
  )
}

/**
 * A greybox building, entirely driven by its config entry. Every building faces
 * +Z (the camera) — no per-building orientation logic. Real meshes swap in here
 * in Phase 3, still driven by the same config.
 */
export function Building({ def }: { def: BuildingDef }) {
  const { pos, size, wall, roof, props, interact } = def
  const [x, z] = pos
  const { w, d, h } = size

  const interactPos = useMemo(() => buildingInteractPos(def), [def])
  useRegisterInteractable(interact, interactPos)

  return (
    <group position={[x, 0, z]}>
      {/* walls */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      {/* pyramid roof (4-sided cone) */}
      <mesh position={[0, h + h * 0.37, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.82, h * 0.75, 4]} />
        <meshStandardMaterial color={roof} roughness={0.85} />
      </mesh>
      {/* door */}
      <mesh position={[0, 0.95, d / 2 + 0.02]}>
        <boxGeometry args={[1.1, 1.9, 0.16]} />
        <meshStandardMaterial color={0x5f4230} roughness={0.9} />
      </mesh>
      {/* windows */}
      {[-1.4, 1.4].map((wx) => (
        <mesh key={wx} position={[wx, 1.5, d / 2 + 0.02]}>
          <boxGeometry args={[0.9, 0.9, 0.14]} />
          <meshStandardMaterial color={0xbfe0ea} roughness={0.3} emissive={0x33484f} emissiveIntensity={0.25} />
        </mesh>
      ))}

      {/* chimney (+ optional smoke) */}
      {props.chimney && (
        <mesh position={[w * 0.28, h + 0.9, -d * 0.15]} castShadow>
          <boxGeometry args={[0.6, 1.3, 0.6]} />
          <meshStandardMaterial color={0x7a5240} roughness={0.9} />
        </mesh>
      )}
      {props.smoke && <Smoke x={w * 0.28} y={h + 1.6} z={-d * 0.15} />}

      {/* café awning + stripes + table & stools */}
      {props.awning !== undefined && (
        <group>
          <mesh position={[0, h * 0.72, d / 2 + 0.7]} castShadow>
            <boxGeometry args={[w + 1, 0.25, 1.4]} />
            <meshStandardMaterial color={props.awning} roughness={0.7} />
          </mesh>
          {Array.from({ length: Math.floor(w + 1) }).map((_, i) =>
            i % 2 ? (
              <mesh key={i} position={[-((w + 1) / 2) + 0.5 + i, h * 0.72, d / 2 + 0.7]}>
                <boxGeometry args={[0.5, 0.26, 1.4]} />
                <meshStandardMaterial color={props.stripe ?? 0xf4ead3} roughness={0.7} />
              </mesh>
            ) : null,
          )}
          <mesh position={[0, 0.9, d / 2 + 2.6]}>
            <cylinderGeometry args={[0.55, 0.55, 0.12, 16]} />
            <meshStandardMaterial color={0xb98a5a} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.45, d / 2 + 2.6]}>
            <cylinderGeometry args={[0.1, 0.1, 0.9, 8]} />
            <meshStandardMaterial color={0x8a6742} roughness={0.9} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 1.1, 0.28, d / 2 + 2.6]}>
              <cylinderGeometry args={[0.28, 0.28, 0.55, 12]} />
              <meshStandardMaterial color={0xc9a06a} roughness={0.9} />
            </mesh>
          ))}
        </group>
      )}

      {/* bike-shop wheel-on-a-post sign */}
      {props.bikeSign && (
        <group position={[w * 0.5 + 1.2, 0, d / 2 + 0.6]}>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 3, 8]} />
            <meshStandardMaterial color={0x7a5a40} roughness={0.9} />
          </mesh>
          <mesh position={[0, 3, 0]} castShadow>
            <torusGeometry args={[0.7, 0.1, 8, 20]} />
            <meshStandardMaterial color={0x2f2a25} roughness={0.6} />
          </mesh>
          <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.2, 10]} />
            <meshStandardMaterial color={0xc7c2b8} roughness={0.9} />
          </mesh>
        </group>
      )}

      {props.parkedBike && <ParkedBike x={w * 0.5 + 0.7} z={d * 0.15} />}

      {/* flower boxes */}
      {props.flowers !== undefined &&
        [-1.4, 1.4].map((fx) => (
          <group key={fx}>
            <mesh position={[fx, 1.05, d / 2 + 0.22]}>
              <boxGeometry args={[1.1, 0.28, 0.32]} />
              <meshStandardMaterial color={0x8a6742} roughness={0.9} />
            </mesh>
            {[-0.3, 0, 0.3].map((o) => (
              <mesh key={o} position={[fx + o, 1.28, d / 2 + 0.24]}>
                <sphereGeometry args={[0.13, 8, 8]} />
                <meshStandardMaterial color={props.flowers} roughness={0.7} />
              </mesh>
            ))}
          </group>
        ))}

      <Label text={interact.name} position={[0, h + h * 0.75 + 1.1, 0]} />
    </group>
  )
}
