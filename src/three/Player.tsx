import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { PLAYER, PALETTE } from '../config/constants'

const _dir = new THREE.Vector3()

/** Shortest-path angular interpolation so the character never spins the long way. */
function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/**
 * Placeholder character controller.
 *
 * The capsule is temporary; the CONTROLLER is the real thing. Movement is free
 * analog on the ground plane, screen-relative to the fixed camera (W = up-screen,
 * i.e. world -Z because the camera has no yaw), and the character rotates to face
 * travel direction. Phase 1 swaps the capsule for a rigged glTF and drives an
 * idle/walk state machine off `moving` — none of the code below needs to change.
 */
export function Player({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null!)
  const [, getKeys] = useKeyboardControls()

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) // clamp so a stalled tab can't teleport the player
    const { forward, back, left, right } = getKeys()

    _dir.set((right ? 1 : 0) - (left ? 1 : 0), 0, (back ? 1 : 0) - (forward ? 1 : 0))
    const moving = _dir.lengthSq() > 0

    if (moving) {
      _dir.normalize()
      posRef.current.addScaledVector(_dir, PLAYER.speed * dt)
      const targetYaw = Math.atan2(_dir.x, _dir.z) // aligns local +Z with travel dir
      group.current.rotation.y = lerpAngle(group.current.rotation.y, targetYaw, PLAYER.turnLerp)
    }

    group.current.position.copy(posRef.current)
  })

  return (
    <group ref={group}>
      {/* body */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <capsuleGeometry args={[PLAYER.radius, 1.0, 8, 16]} />
        <meshStandardMaterial color={PALETTE.player} roughness={0.75} metalness={0} />
      </mesh>
      {/* facing indicator (points +Z, the character's forward) */}
      <mesh position={[0, 1.1, PLAYER.radius + 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.16, 0.4, 12]} />
        <meshStandardMaterial color={PALETTE.ink} roughness={0.6} />
      </mesh>
    </group>
  )
}
