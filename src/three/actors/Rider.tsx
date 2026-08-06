import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ACTORS } from '../../config/town'
import { useRegisterInteractable } from '../../systems/interactables'
import { useGame } from '../../state/store'

const R = ACTORS.rider
const SKIN = 0xf0c9a4

/**
 * Cycling Leonard — rides a loop around town and pauses when you get close so
 * you can say hi. A genuine chance encounter: catch him or miss him. Registered
 * as the same interactable type as the buildings; its position is live.
 */
export function Rider({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null!)
  const wheels = useRef<THREE.Mesh[]>([])
  const pos = useRef(new THREE.Vector3().copy(R.waypoints[0]))
  const wp = useRef(0)

  useRegisterInteractable(R.interact, pos.current)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const talkingToMe = useGame.getState().dialogue?.id === 'rider'
    const distToPlayer = Math.hypot(
      playerPos.current.x - pos.current.x,
      playerPos.current.z - pos.current.z,
    )

    // ride on, unless we're chatting or the player is close enough to catch
    if (!talkingToMe && distToPlayer > R.pauseDistance) {
      const target = R.waypoints[wp.current]
      const dx = target.x - pos.current.x
      const dz = target.z - pos.current.z
      const dd = Math.hypot(dx, dz)
      if (dd < 1.2) {
        wp.current = (wp.current + 1) % R.waypoints.length
      } else {
        pos.current.x += (dx / dd) * R.speed * dt
        pos.current.z += (dz / dd) * R.speed * dt
        group.current.rotation.y = Math.atan2(dx, dz) + Math.PI / 2
        wheels.current.forEach((w) => {
          if (w) w.rotation.z -= R.speed * dt * 2.2
        })
      }
    }
    group.current.position.set(pos.current.x, 0, pos.current.z)
  })

  return (
    <group ref={group} position={[R.waypoints[0].x, 0, R.waypoints[0].z]}>
      {/* rider (leaning) */}
      <mesh position={[0, 1.05, 0]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.4, 0.9, 12]} />
        <meshStandardMaterial color={R.jersey} roughness={0.7} />
      </mesh>
      <mesh position={[0.35, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.34, 16, 14]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0.35, 1.62, 0]} rotation={[0, 0, -0.5]}>
        <sphereGeometry args={[0.37, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={0x1f6f66} roughness={0.6} />
      </mesh>
      <mesh position={[0.45, 1.1, 0]} rotation={[0, 0, 1]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
        <meshStandardMaterial color={R.jersey} roughness={0.7} />
      </mesh>
      {/* bike */}
      {[0.62, -0.62].map((dx, i) => (
        <mesh key={dx} ref={(el) => { if (el) wheels.current[i] = el }} position={[dx, 0.44, 0]} castShadow>
          <torusGeometry args={[0.44, 0.07, 8, 18]} />
          <meshStandardMaterial color={0x2f2a25} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.15, 0.08, 0.08]} />
        <meshStandardMaterial color={0xe4633c} roughness={0.6} />
      </mesh>
      <mesh position={[-0.35, 0.85, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
        <meshStandardMaterial color={0xe4633c} roughness={0.6} />
      </mesh>
      <mesh position={[0.5, 0.85, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.55, 8]} />
        <meshStandardMaterial color={0xe4633c} roughness={0.6} />
      </mesh>
    </group>
  )
}
