import { useMemo } from 'react'
import { BUILDINGS, TRAIL, buildingInteractPos, type BuildingDef } from '../config/town'
import { useRegisterInteractable } from '../systems/interactables'
import { Label } from './Label'

/**
 * Interaction zones for the modelled town. The building meshes now live in
 * town.glb (see `TownModel`), so this registers only the invisible proximity
 * zones + floating name tags at each pad — the door/face you walk up to and
 * press E on. Positions come from `BUILDINGS`/`TRAIL` in config; when a real
 * building lands, its interaction is already here, driven by the same data.
 */
function BuildingZone({ def }: { def: BuildingDef }) {
  const pos = useMemo(() => buildingInteractPos(def), [def])
  useRegisterInteractable(def.interact, pos)
  return <Label text={def.interact.name} position={[def.pos[0], 5, def.pos[1]]} />
}

function TrailZone() {
  useRegisterInteractable(TRAIL.interact, TRAIL.interactPos)
  return (
    <Label text="The trail →" position={[TRAIL.interactPos.x, 3.4, TRAIL.interactPos.z]} width={3.6} />
  )
}

export function Interactions() {
  return (
    <>
      {BUILDINGS.map((b) => (
        <BuildingZone key={b.id} def={b} />
      ))}
      <TrailZone />
    </>
  )
}
