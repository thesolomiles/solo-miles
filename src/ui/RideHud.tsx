import { useRideHud } from '../state/rideHud'
import { useGame } from '../state/store'
import { ROUTES } from '../config/worlds'

/** One big telemetry readout: a large value (with an inline unit) over a small
 *  uppercase label — the cycle-computer look from the ride hero shot. */
function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="ridehud__stat">
      <div className="ridehud__val">
        {value}
        {unit && <span className="ridehud__unit">{unit}</span>}
      </div>
      <div className="ridehud__label">{label}</div>
    </div>
  )
}

/**
 * The ride telemetry HUD — a big, boxless cycle-computer readout down the left
 * edge (speed / elevation gained / distance), the way it reads in the ride hero
 * shot. Values come from state/rideHud (fed ~10Hz by the ride scene).
 */
export function RideHud() {
  const ride = useGame((s) => s.ride)
  const route = ride ? ROUTES[ride] : null
  const speed = useRideHud((s) => s.speed)
  const distanceKm = useRideHud((s) => s.distanceKm)
  const elevationM = useRideHud((s) => s.elevationM)

  return (
    <div className="ridehud">
      {route && <div className="ridehud__route">{route.place}</div>}
      <Stat value={String(Math.round(speed))} unit="km/h" label="Speed" />
      <Stat value={String(Math.round(elevationM))} unit="m" label="Elevation gained" />
      <Stat value={distanceKm.toFixed(1)} unit="km" label="Distance" />
    </div>
  )
}
