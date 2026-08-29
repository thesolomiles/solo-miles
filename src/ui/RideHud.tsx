import { useRideHud } from '../state/rideHud'
import { useGame } from '../state/store'
import { ROUTES } from '../config/worlds'

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${String(ss).padStart(2, '0')}`
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="ridehud__tile">
      <div className="ridehud__tile-label">{label}</div>
      <div className="ridehud__tile-val">
        {value}
        {unit && <span className="ridehud__tile-unit">{unit}</span>}
      </div>
    </div>
  )
}

/**
 * The ride telemetry HUD — a cycle-computer overlay (top-left) that makes the
 * ride read as a game: big live speed plus distance / elevation / time / grade
 * tiles. Values come from state/rideHud (fed ~10Hz by the ride scene).
 */
export function RideHud() {
  const ride = useGame((s) => s.ride)
  const route = ride ? ROUTES[ride] : null
  const speed = useRideHud((s) => s.speed)
  const distanceKm = useRideHud((s) => s.distanceKm)
  const elevationM = useRideHud((s) => s.elevationM)
  const timeS = useRideHud((s) => s.timeS)
  const grade = useRideHud((s) => s.grade)

  return (
    <div className="ridehud">
      {route && <div className="ridehud__route">{route.place}</div>}
      <div className="ridehud__speed">
        <span className="ridehud__speed-val">{Math.round(speed)}</span>
        <span className="ridehud__speed-unit">km/h</span>
      </div>
      <div className="ridehud__tiles">
        <Tile label="Distance" value={distanceKm.toFixed(1)} unit={route ? `/ ${route.distanceKm} km` : 'km'} />
        <Tile label="Elevation" value={`↑${Math.round(elevationM)}`} unit="m" />
        <Tile label="Time" value={fmtTime(timeS)} />
        <Tile label="Grade" value={grade.toFixed(1)} unit="%" />
      </div>
    </div>
  )
}
