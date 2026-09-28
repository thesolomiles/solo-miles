import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BLURB_PLACEHOLDER, WORLDS, type Country, type Route } from '../config/worlds'

interface Entry {
  route: Route
  country: Country
}

/** The card art: the scenic photo, else the route trace on the country gradient. */
function Art({ route }: { route: Route }) {
  if (route.photo) return <img className="bb__art" src={route.photo} alt="" draggable={false} />
  return (
    <div
      className="bb__art bb__art--trace"
      style={{ background: `linear-gradient(150deg, ${route.thumb.from}, ${route.thumb.to})` }}
    >
      {route.map ? <img src={route.map} alt="" draggable={false} /> : <span>{route.thumb.glyph}</span>}
    </div>
  )
}

/**
 * The /blog/ front page — a streaming-app browse screen, so it reads as a
 * website rather than the game's world selector: a top nav with the logo, the
 * highlighted ride as the hero (blurred photo backdrop, title, blurb, Read +
 * Strava), and one row of every ride along the bottom. ←/→ browse, Enter reads.
 */
export function BlogBrowser({
  onRead,
  onHome,
  initialId,
  paused = false,
}: {
  onRead: (route: Route) => void
  onHome: () => void
  initialId?: string
  paused?: boolean
}) {
  const entries = useMemo<Entry[]>(
    () => WORLDS.flatMap((country) => country.routes.map((route) => ({ route, country }))),
    [],
  )
  const [sel, setSel] = useState(() => Math.max(0, entries.findIndex((e) => e.route.id === initialId)))
  const cur = entries[sel]
  const r = cur.route
  const rowRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  const lastPointer = useRef('mouse')

  // Backdrop crossfade: keep the previous image under the new one while it fades in.
  const [bgs, setBgs] = useState<Route[]>([r])
  useEffect(() => {
    setBgs((b) => (b[b.length - 1] === r ? b : [b[b.length - 1], r]))
  }, [r])

  // Keep the highlighted card on screen (scrolls the row by hand, like the
  // game's picker — scrollIntoView would nudge the whole page).
  const scroll = useRef(sel > 0)
  useLayoutEffect(() => {
    const row = rowRef.current
    const card = cardRefs.current[sel]
    if (!scroll.current || !row || !card) return
    scroll.current = false
    const pad = parseFloat(getComputedStyle(row).paddingLeft) || 0
    const left = card.offsetLeft - pad
    const right = card.offsetLeft + card.offsetWidth + pad - row.clientWidth
    const to = left < row.scrollLeft ? left : right > row.scrollLeft ? right : row.scrollLeft
    row.scrollTo({ left: to, behavior: 'smooth' })
  }, [sel])

  const select = (i: number) => {
    scroll.current = true
    setSel(Math.max(0, Math.min(entries.length - 1, i)))
  }

  const keys = useRef({ sel, select, onRead, paused })
  keys.current = { sel, select, onRead, paused }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { sel, select, onRead, paused } = keys.current
      if (paused) return
      if (e.code === 'ArrowRight') select(sel + 1)
      else if (e.code === 'ArrowLeft') select(sel - 1)
      else if (e.code === 'Enter') onRead(entries[sel].route)
      else return
      e.preventDefault()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [entries])

  // A vertical mouse wheel scrolls the row sideways.
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="bb">
      <div className="bb__bg" aria-hidden>
        {bgs.map((b) =>
          b.photo ? (
            <img key={b.id} className="bb__bgimg" src={b.photo} alt="" draggable={false} />
          ) : (
            <div
              key={b.id}
              className="bb__bgimg"
              style={{ background: `linear-gradient(150deg, ${b.thumb.from}, ${b.thumb.to})` }}
            />
          ),
        )}
        <div className="bb__shade" />
      </div>

      <nav className="bb__nav">
        <a className="bb__logo" href="/blog/">
          <img src="/brand/solomiles-horizontal-light.svg" alt="Solomiles" />
        </a>
        <div className="bb__links">
          <a className="bb__link is-active" href="/blog/">
            Ride logs
          </a>
        </div>
        <button type="button" className="bb__town" onClick={onHome}>
          Back to town
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M8 16L16 8M9 8h7v7" />
          </svg>
        </button>
      </nav>

      <main className="bb__main">
        <section className="bb__hero" key={r.id}>
          <p className="bb__kicker">
            <span className="bb__flag">{cur.country.flag}</span>
            {cur.country.name} · {r.region}
          </p>
          <h1 className="bb__title">{r.place}</h1>
          <p className="bb__meta">
            <span>{r.distanceKm} km</span>
            <span>{r.elevationM.toLocaleString()} m climbing</span>
            {r.date && <span>{r.date.slice(0, 4)}</span>}
          </p>
          <p className={'bb__blurb' + (r.blurb ? '' : ' is-placeholder')}>{r.blurb ?? BLURB_PLACEHOLDER}</p>
          <div className="bb__actions">
            <button type="button" className="bb__btn bb__btn--primary" onClick={() => onRead(r)}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" />
                <path d="M12 6v13.5" />
              </svg>
              {r.blogPath ? 'Read the log' : 'Route info'}
            </button>
            {r.strava && (
              <a className="bb__btn" href={r.strava} target="_blank" rel="noopener noreferrer">
                Strava
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path d="M8 16L16 8M9 8h7v7" />
                </svg>
              </a>
            )}
          </div>
        </section>

        <section className="bb__shelf" aria-label="All rides">
          <h2 className="bb__shelf-title">All rides</h2>
          <div className="bb__row" ref={rowRef}>
            {entries.map((e, i) => (
              <button
                key={e.route.id}
                type="button"
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className={'bb__card' + (i === sel ? ' is-selected' : '')}
                aria-label={`${e.route.place}, ${e.country.name}`}
                aria-pressed={i === sel}
                onPointerDown={(ev) => (lastPointer.current = ev.pointerType)}
                onMouseEnter={() => {
                  if (lastPointer.current === 'mouse' && i !== sel) setSel(i)
                }}
                onClick={(ev) => {
                  ev.currentTarget.blur()
                  // Touch has no hover: the first tap previews, the second reads.
                  if (lastPointer.current !== 'mouse' && i !== sel) select(i)
                  else onRead(e.route)
                }}
              >
                <Art route={e.route} />
                {e.route.blogPath && <span className="bb__badge">Log</span>}
                <span className="bb__cardname">{e.route.place}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
