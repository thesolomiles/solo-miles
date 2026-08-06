import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ACTORS } from '../../config/town'
import { useRegisterInteractable } from '../../systems/interactables'
import { useGame } from '../../state/store'

const M = ACTORS.mews

/**
 * Mews — ginger cat that wanders near mi casa and is pettable. Same interactable
 * type as everything else; it just happens to move. Holds still while you're
 * petting it (its dialogue is open).
 */
export function Cat() {
  const group = useRef<THREE.Group>(null!)
  const pos = useRef(new THREE.Vector3().copy(M.home))
  const dir = useRef(Math.random() * 6.28)
  const timer = useRef(0)

  useRegisterInteractable(M.interact, pos.current)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const petting = useGame.getState().dialogue?.id === 'mews'

    timer.current += dt
    if (timer.current > 2.4) {
      timer.current = 0
      dir.current += (Math.random() - 0.5) * 2.2
    }
    if (!petting) {
      const nx = pos.current.x + Math.cos(dir.current) * M.speed * dt
      const nz = pos.current.z + Math.sin(dir.current) * M.speed * dt
      if (Math.hypot(nx - M.home.x, nz - M.home.z) < M.wanderRadius) {
        pos.current.x = nx
        pos.current.z = nz
        group.current.rotation.y = -dir.current + Math.PI / 2
      } else {
        dir.current += 1.6 // turn back toward home
      }
    }
    group.current.position.set(
      pos.current.x,
      Math.abs(Math.sin(state.clock.elapsedTime * 4)) * 0.03,
      pos.current.z,
    )
  })

  return (
    <group ref={group} position={[M.home.x, 0, M.home.z]}>
      <mesh position={[0, 0.34, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.24, 0.28, 0.7, 10]} />
        <meshStandardMaterial color={M.body} roughness={0.8} />
      </mesh>
      <mesh position={[0.42, 0.44, 0]} castShadow>
        <sphereGeometry args={[0.24, 12, 12]} />
        <meshStandardMaterial color={M.body} roughness={0.8} />
      </mesh>
      {[-0.1, 0.1].map((dz) => (
        <mesh key={dz} position={[0.42, 0.63, dz]}>
          <coneGeometry args={[0.09, 0.16, 6]} />
          <meshStandardMaterial color={M.ear} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[-0.42, 0.5, 0]} rotation={[0, 0, -0.9]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 0.6, 8]} />
        <meshStandardMaterial color={M.body} roughness={0.8} />
      </mesh>
    </group>
  )
}
