import { Grid } from '@react-three/drei'
import { PALETTE } from '../config/constants'

/**
 * The ground plane. Sage countryside green with a faint grid on top — the grid
 * is a greybox aid so camera scroll and player motion are legible before any
 * real terrain art exists. It gets removed / replaced in the art pass.
 */
export function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={1} metalness={0} />
      </mesh>
      <Grid
        args={[400, 400]}
        cellSize={2}
        cellThickness={0.6}
        cellColor={PALETTE.dirt}
        sectionSize={10}
        sectionThickness={1}
        sectionColor={PALETTE.dirt}
        fadeDistance={70}
        fadeStrength={2}
        followCamera={false}
        infiniteGrid
      />
    </group>
  )
}
