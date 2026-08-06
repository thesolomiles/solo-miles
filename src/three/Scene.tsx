import { useRef } from 'react'
import { PALETTE } from '../config/constants'
import { PLAYER } from '../config/constants'
import { OrthoRig } from './OrthoRig'
import { Player } from './Player'
import { Ground } from './Ground'

/**
 * A neutral greybox block. Phase 0 uses two of these purely to make camera
 * scroll and z-buffer occlusion visible during review (walk behind one and the
 * character is correctly hidden — no manual sprite sorting). Real buildings
 * arrive in Phase 1, driven by a layout config, not hardcoded here.
 */
function RefBox({ position, size }: { position: [number, number, number]; size: [number, number, number] }) {
  return (
    <mesh position={[position[0], size[1] / 2, position[2]]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#b8b0a0" roughness={0.9} metalness={0} />
    </mesh>
  )
}

export function Scene() {
  // Shared player position: Player writes it, OrthoRig reads it. Player is
  // mounted first so its useFrame runs before the camera reads the value.
  const posRef = useRef(PLAYER.start.clone())

  return (
    <>
      <color attach="background" args={[PALETTE.skyTop]} />

      {/* Phase 0 lighting is deliberately minimal — the full warm rig is Phase 2. */}
      <hemisphereLight args={[PALETTE.skyTop, PALETTE.ground, 0.9]} />
      <directionalLight
        position={[14, 22, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0004}
      />

      <Ground />

      {/* reference blocks (temporary — occlusion + scroll demo) */}
      <RefBox position={[-8, 0, -6]} size={[5, 6, 5]} />
      <RefBox position={[9, 0, -10]} size={[6, 9, 6]} />

      <Player posRef={posRef} />
      <OrthoRig posRef={posRef} />
    </>
  )
}
