import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The animation state a controller feeds to a character model. This is the SEAM
 * the brief insists on building early: the controller only ever produces this,
 * and never knows whether a capsule, a low-poly figure, or a rigged glTF is on
 * the other side.
 *
 * Placeholder now: `phase` drives a procedural bob + arm-swing.
 * Phase 3 swap: a <GltfCharacter> reads the same object and does
 *   moving ? actions.walk.play() : actions.idle.play()
 * — feeding `phase` / speed into the mixer if it wants. The controller is
 * untouched.
 */
export interface CharAnim {
  moving: boolean
  phase: number // walk-cycle phase in radians
}

const SKIN = 0xf0c9a4

/**
 * Greybox humanoid: cylinder body, sphere head, hemisphere cap, two arms.
 * `anim` is read every frame to bob the body and swing the arms. Reused by the
 * player and (as a base pose) by the cyclist.
 */
export function Figure({ color, anim }: { color: number; anim: RefObject<CharAnim> }) {
  const inner = useRef<THREE.Group>(null!)
  const armL = useRef<THREE.Mesh>(null!)
  const armR = useRef<THREE.Mesh>(null!)

  useFrame((state) => {
    const a = anim.current
    const t = state.clock.elapsedTime
    // walk bob when moving; a slow breathing sway when idle
    const bob = Math.abs(Math.sin(a.phase)) * 0.1
    const idle = a.moving ? 0 : Math.sin(t * 1.6) * 0.025
    inner.current.position.y = bob + idle
    const swing = Math.sin(a.phase) * 0.45 * (a.moving ? 1 : 0.1)
    armL.current.rotation.x = swing
    armR.current.rotation.x = -swing
  })

  return (
    <group ref={inner}>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.5, 1.15, 12]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.42, 18, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.44, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh ref={armL} position={[-0.5, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.8, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh ref={armR} position={[0.5, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.8, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  )
}
