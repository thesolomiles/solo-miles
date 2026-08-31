import { useGame } from '../state/store'
import { WORLDS, type Route } from '../config/worlds'

/** A 5-pip difficulty rating (filled = harder), sitting on the thumbnail. */
function Pips({ n }: { n: number }) {
  return (
    <span className="wsel__pips" aria-label={`Difficulty ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={'wsel__pip' + (i <= n ? ' wsel__pip--on' : '')} />
      ))}
    </span>
  )
}

/** One route thumbnail — arcade-card styling (thumb + name). Picking it fades the
 *  town out and drops into the ride auto-runner for that route. */
function RouteCard({ route }: { route: Route }) {
  const ride = () => useGame.getState().requestRide(route.id)
  return (
    <div
      className="wsel__card"
      role="button"
      tabIndex={0}
      onClick={ride}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          ride()
        }
      }}
    >
      <div
        className="wsel__thumb"
        style={{ background: `linear-gradient(150deg, ${route.thumb.from}, ${route.thumb.to})` }}
      >
        {route.map ? (
          <img className="wsel__map" src={route.map} alt="" aria-hidden draggable={false} />
        ) : (
          <span className="wsel__glyph">{route.thumb.glyph}</span>
        )}
        <Pips n={route.difficulty} />
        <span className="wsel__km">{route.distanceKm} km · {route.elevationM.toLocaleString()} m</span>
        {route.blogPath && <span className="wsel__blog" title="Has a ride log" aria-hidden>📖</span>}
      </div>
      <h4 className="wsel__name">{route.place}</h4>
      <span className="wsel__region">{route.region}</span>
    </div>
  )
}

/**
 * The world selector — a wood-framed picker (same arcade language as the café's
 * Game Selector) that opens after you say "yes" to Leonard's ride. Each country
 * is a stacked section with a shelf of route thumbnails. Placeholder content for
 * now (config/worlds.ts); this is the foundation for the ride feature.
 */
export function WorldSelector() {
  const close = useGame((s) => s.closeWorld)
  return (
    <div className="gselect wsel">
      <div className="gselect__frame wsel__frame">
        <span className="gselect__stud gselect__stud--tl" />
        <span className="gselect__stud gselect__stud--tr" />
        <span className="gselect__stud gselect__stud--bl" />
        <span className="gselect__stud gselect__stud--br" />
        <span className="gselect__stud gselect__stud--ml" />
        <span className="gselect__stud gselect__stud--mr" />
        <header className="gselect__head">
          <h2 className="gselect__title">Select a World</h2>
        </header>
        <div className="wsel__scroll">
          {WORLDS.map((c) => (
            <section className="wsel__country" key={c.id}>
              <h3 className="wsel__country-name">
                <span className="wsel__flag">{c.flag}</span>
                {c.name}
              </h3>
              {c.routes.length ? (
                <div className="wsel__row">
                  {c.routes.map((r) => (
                    <RouteCard key={r.id} route={r} />
                  ))}
                </div>
              ) : (
                <p className="wsel__soon">Not ridden yet — coming soon.</p>
              )}
            </section>
          ))}
        </div>
        <footer className="gselect__foot">
          <button className="gselect__exit" type="button" onClick={close}>
            Close / Back to town
          </button>
        </footer>
      </div>
    </div>
  )
}
