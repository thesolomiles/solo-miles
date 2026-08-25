import { useGame } from '../state/store'
import { RIDES, type Ride } from '../config/rides'

/** A 5-pip difficulty rating (filled = harder). */
function Stars({ n }: { n: number }) {
  return (
    <span className="ride__stars" aria-label={`Difficulty ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={'ride__star' + (i <= n ? ' ride__star--on' : '')}>
          ★
        </span>
      ))}
    </span>
  )
}

function RideCard({ ride }: { ride: Ride }) {
  return (
    // A button for now so it's keyboard/tap-reachable; selecting a ride is a
    // no-op until the real ride view is wired up.
    <button className="ride" type="button">
      <div
        className="ride__thumb"
        style={{ background: `linear-gradient(150deg, ${ride.thumb.from}, ${ride.thumb.to})` }}
      >
        <span className="ride__glyph">{ride.thumb.glyph}</span>
        <Stars n={ride.difficulty} />
      </div>
      <div className="ride__body">
        <h3 className="ride__place">{ride.place}</h3>
        <p className="ride__region">{ride.region}</p>
        <div className="ride__stats">
          <div className="ride__stat">
            <span className="ride__stat-val">
              {ride.distanceKm}
              <i>km</i>
            </span>
            <span className="ride__stat-lbl">Distance</span>
          </div>
          <div className="ride__stat">
            <span className="ride__stat-val">
              {ride.elevationM}
              <i>m</i>
            </span>
            <span className="ride__stat-lbl">Elevation</span>
          </div>
        </div>
      </div>
    </button>
  )
}

/**
 * Leonard's ride-picker — a game-style card shelf that opens after you say
 * "yes" to going for a ride. Each card is a place he's ridden: thumbnail,
 * distance, elevation gained, and a 5-star difficulty. Placeholder content for
 * now (see config/rides.ts); this exists to get the talk → yes → cards flow set
 * up while the real UI is built elsewhere.
 */
export function RidesModal() {
  const close = useGame((s) => s.closeRides)
  return (
    <div className="rides">
      <div className="rides__panel">
        <header className="rides__head">
          <div>
            <p className="rides__eyebrow">Leonard&rsquo;s rides</p>
            <h2 className="rides__title">Pick a place to ride</h2>
          </div>
          <button className="rides__close" onClick={close} aria-label="Close" type="button">
            ✕
          </button>
        </header>
        <div className="rides__shelf">
          {RIDES.map((r) => (
            <RideCard key={r.id} ride={r} />
          ))}
        </div>
        <p className="rides__foot">More routes coming soon — tap a card to preview the ride.</p>
      </div>
    </div>
  )
}
