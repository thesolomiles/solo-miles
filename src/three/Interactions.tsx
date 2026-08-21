import { TRAIL } from '../config/town'
import { useRegisterInteractable } from '../systems/interactables'
import { Label } from './Label'

/**
 * Interaction zones for the modelled town. Building interactions (the press-E
 * door zones) were removed while the town is being re-laid-out at true scale —
 * the old `BUILDINGS.pos` no longer matches where the rebuilt buildings sit, so
 * they triggered over the wrong ground. Only the forest trail zone remains for
 * now; building zones will be re-driven from the glb once positions are final.
 */
function TrailZone() {
  useRegisterInteractable(TRAIL.interact, TRAIL.interactPos)
  return (
    <Label text="The trail →" position={[TRAIL.interactPos.x, 3.4, TRAIL.interactPos.z]} width={3.6} />
  )
}

export function Interactions() {
  return <TrailZone />
}
