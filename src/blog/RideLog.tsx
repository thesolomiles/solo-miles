import { useEffect, useState } from 'react'
import { WORLDS, type Route } from '../config/worlds'

const countryOf = (r: Route) => WORLDS.find((c) => c.routes.includes(r))!

/** '2022-04-12' → '12 April 2022'. */
const longDate = (iso?: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Strava + GPX, as pills — in the picker's hero and the log's side panel. */
export function RouteLinks({ route }: { route: Route }) {
  return (
    <div className="rlinks">
      {route.strava && (
        <a className="rlink" href={route.strava} target="_blank" rel="noopener noreferrer">
          Strava
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M8 16L16 8M9 8h7v7" />
          </svg>
        </a>
      )}
      {route.gpx ? (
        <a className="rlink rlink--ghost" href={route.gpx} download={`${route.id}.gpx`}>
          GPX
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 5v11M7 11l5 5 5-5M6 19h12" />
          </svg>
        </a>
      ) : (
        <span className="rlink rlink--ghost is-disabled" title="GPX file coming soon">
          GPX soon
        </span>
      )}
    </div>
  )
}

/**
 * One route's mini blog, over the picker: the story (content) on the left, the
 * route's facts and links on the right. The story is the post the ride-sync
 * tool writes from Notion (public/blog/<id>/index.html) — its .src-flow, with
 * image paths made absolute. Routes without a write-up still get the links.
 */
export function RideLog({ route, onClose }: { route: Route; onClose: () => void }) {
  const country = countryOf(route)
  const [story, setStory] = useState<string | null>(route.blogPath ? null : '')

  useEffect(() => {
    if (!route.blogPath) return
    let live = true
    const base = new URL(route.blogPath, location.href)
    fetch(base)
      .then((res) => res.text())
      .then((text) => {
        const flow = new DOMParser().parseFromString(text, 'text/html').querySelector('.src-flow')
        flow?.querySelectorAll('img').forEach((img) => {
          img.setAttribute('src', new URL(img.getAttribute('src') ?? '', base).href)
          img.setAttribute('loading', 'lazy')
        })
        if (live) setStory(flow?.innerHTML ?? '')
      })
      .catch(() => live && setStory(''))
    return () => {
      live = false
    }
  }, [route.blogPath])

  return (
    <div className="log" role="dialog" aria-label={route.place}>
      <div className="log__bg" aria-hidden>
        {route.photo && <img className="log__bgimg" src={route.photo} alt="" />}
        <div className="log__shade" />
      </div>

      <button type="button" className="log__back" onClick={onClose}>
        <kbd>Esc</kbd> All rides
      </button>

      <div className="log__scroll">
        <div className="log__layout">
          <header className="log__head">
            <p className="log__kicker">
              {route.region} · {country.flag} {country.name}
            </p>
            <h1 className="log__title">{route.place}</h1>
            {route.date && <p className="log__date">{longDate(route.date)}</p>}
          </header>

          <aside className="log__side">
            {route.map && (
              <div className="log__trace">
                <img src={route.map} alt="Route map" />
              </div>
            )}
            <dl className="log__stats">
              <div>
                <dt>Distance</dt>
                <dd>{route.distanceKm} km</dd>
              </div>
              <div>
                <dt>Climbing</dt>
                <dd>{route.elevationM.toLocaleString()} m</dd>
              </div>
            </dl>
            <RouteLinks route={route} />
          </aside>

          <article className="log__story">
            {story === null ? (
              <p className="log__note">Loading…</p>
            ) : story ? (
              <div dangerouslySetInnerHTML={{ __html: story }} />
            ) : (
              <p className="log__note">No write-up for this ride yet.</p>
            )}
          </article>
        </div>
      </div>
    </div>
  )
}
