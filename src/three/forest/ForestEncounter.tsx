import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { FOREST_ENCOUNTER as E } from '../../config/forestEncounter'
import { forestView } from '../../systems/forestView'
import { forestTouch } from '../../systems/input'
import { useGame } from '../../state/store'
import { advanceForestReveal, resetForestEncounter, startForestReveal, useForestEncounter } from '../../state/forestEncounter'

/** Encounter sequencing runs before the camera and walker. One reveal per visit. */
export function ForestEncounter() {
  useEffect(() => {
    resetForestEncounter()
    return resetForestEncounter
  }, [])

  useFrame((_, delta) => {
    const game = useGame.getState()
    const { phase, nearby } = useForestEncounter.getState()
    if (game.transition || (game.dialogue && phase !== 'reveal')) {
      if (nearby) useForestEncounter.setState({ nearby: false })
      return
    }
    if (phase === 'approach' && forestView.walkerX >= E.viewpointX && forestView.walkerY < 0.05) {
      forestTouch.dir = 0
      forestTouch.jump = false
      startForestReveal()
    }
    advanceForestReveal(Math.min(delta, 0.05))
    const current = useForestEncounter.getState()
    if (current.phase === 'inspecting') useForestEncounter.setState({ phase: 'complete' })
    const inRange = (current.phase === 'ready' || current.phase === 'complete') && Math.abs(forestView.walkerX - (E.landmarkX - 4)) < E.inspectRadius
    if (inRange !== current.nearby) useForestEncounter.setState({ nearby: inRange })
  }, -3)

  return <GreyLandmark />
}

/** Deliberately simple, neutral geometry: scale and composition before final art. */
function GreyLandmark() {
  const bone = '#a6aaa7'
  return (
    <group position={[E.landmarkX, 0, E.landmarkZ]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3, -0.02, 0]} receiveShadow>
        <circleGeometry args={[16, 32]} />
        <meshStandardMaterial color="#7c8179" roughness={1} />
      </mesh>
      <mesh position={[0, 4.5, 0]} scale={[1.2, 1, 0.9]} castShadow receiveShadow>
        <dodecahedronGeometry args={[4.5, 0]} />
        <meshStandardMaterial color={bone} roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 2.5, 3.3]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 2.4, 4]} />
        <meshStandardMaterial color={bone} roughness={1} />
      </mesh>
      <mesh position={[0, 0.65, 3]} castShadow receiveShadow>
        <boxGeometry args={[5.8, 0.85, 5.6]} />
        <meshStandardMaterial color="#8e938f" roughness={1} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 2.4, 5, 3.05]} scale={[1.05, 1.25, 0.5]}>
            <sphereGeometry args={[1.2, 8, 6]} />
            <meshStandardMaterial color="#303b38" roughness={1} />
          </mesh>
          <mesh position={[side * 4.5, 7.9, -0.3]} rotation={[0.12, 0, side * -0.5]} castShadow>
            <coneGeometry args={[1.2, 6, 5]} />
            <meshStandardMaterial color={bone} roughness={1} flatShading />
          </mesh>
        </group>
      ))}
      {[-1.7, -0.6, 0.6, 1.7].map((x) => (
        <mesh key={x} position={[x, 1.15, 5]} castShadow>
          <boxGeometry args={[0.55, 1.4, 0.55]} />
          <meshStandardMaterial color="#b5b9b5" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}
