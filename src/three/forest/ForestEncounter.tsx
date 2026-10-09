import { Suspense, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { FOREST_ENCOUNTER as E } from '../../config/forestEncounter'
import { forestView } from '../../systems/forestView'
import { forestTouch } from '../../systems/input'
import { useGame } from '../../state/store'
import { advanceForestReveal, resetForestEncounter, startForestReveal, useForestEncounter } from '../../state/forestEncounter'
import { ForestSkull } from './ForestSkull'

/** Encounter sequencing runs before the camera and walker. One reveal per visit. */
export function ForestEncounter() {
  const [landmarkReady, setLandmarkReady] = useState(false)
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
    if (landmarkReady && phase === 'approach' && forestView.walkerX >= E.viewpointX && forestView.walkerY < 0.05) {
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

  return (
    <Suspense fallback={null}>
      <ForestSkull onReady={setLandmarkReady} />
    </Suspense>
  )
}
