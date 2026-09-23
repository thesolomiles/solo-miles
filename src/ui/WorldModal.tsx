import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { WORLDS, type Country, type Route } from '../config/worlds'
import { playWorldSfx } from './worldSfx'

/** The card art: the scenic photo, else the route trace, else the glyph. */
function Thumb({ route }: { route: Route }) {
  if (route.photo) return <img className="wsel__photo" src={route.photo} alt="" draggable={false} />
  return (
    <div
      className="wsel__fallback"
      style={{ background: `linear-gradient(150deg, ${route.thumb.from}, ${route.thumb.to})` }}
    >
      {route.map ? (
        <img className="wsel__map" src={route.map} alt="" draggable={false} />
      ) : (
        <span className="wsel__glyph">{route.thumb.glyph}</span>
      )}
    </div>
  )
}

/**
 * Open / close / pick stings. Mounted for the life of the HUD (not inside the
 * selector) so the close and pick sounds still fire as the modal unmounts.
 * Zustand's listener runs inside the click or key handler, so play() stays a
 * user gesture. Picking a route closes the selector in the same update as the
 * ride fade — that one plays the select sting instead of the close sting.
 */
export function useWorldSelectorSfx() {
  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (s.worldOpen === prev.worldOpen) return
      if (s.worldOpen) playWorldSfx('open')
      else if (s.transition?.kind === 'ride' && s.transition.to) playWorldSfx('select')
      else playWorldSfx('close')
    })
  }, [])
}

interface Entry {
  route: Route
  country: Country
}

/**
 * The world selector — a console-library style picker that opens after you say
 * "yes" to Leonard's ride. Every route sits in one side-scrolling row; the
 * country tabs above it are just jump links into that row. The highlighted
 * route fills the hero (name + stats) and its thumbnail, blurred, becomes the
 * backdrop. ←/→ browse, ↑/↓ jump country, Enter rides; Esc (Hud) closes.
 */
export function WorldSelector() {
  const close = useGame((s) => s.closeWorld)
  const entries = useMemo<Entry[]>(
    () => WORLDS.flatMap((country) => country.routes.map((route) => ({ route, country }))),
    [],
  )
  const firstOf = useMemo(() => {
    const m = new Map<string, number>()
    entries.forEach((e, i) => {
      if (!m.has(e.country.id)) m.set(e.country.id, i)
    })
    return m
  }, [entries])

  const [sel, setSel] = useState(0)
  const cur = entries[sel]
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastPointer = useRef('mouse')

  // Backdrop crossfade: keep the previous image under the new one while it fades in.
  const [bgs, setBgs] = useState<Route[]>([cur.route])
  useEffect(() => {
    setBgs((b) => (b[b.length - 1] === cur.route ? b : [b[b.length - 1], cur.route]))
  }, [cur.route])

  const ride = (r: Route) => useGame.getState().requestRide(r.id)

  // How the next selection should scroll into view: a tab jump pins that
  // country's first card to the left edge; browsing just keeps it on screen.
  // (Scrolls the strip by hand — scrollIntoView also nudges the overflow-hidden
  // overlay sideways.) Runs after render so the enlarged card is measured.
  const scrollAlign = useRef<'start' | 'nearest' | null>(null)
  useLayoutEffect(() => {
    const align = scrollAlign.current
    const strip = stripRef.current
    const card = cardRefs.current[sel]
    scrollAlign.current = null
    if (!align || !strip || !card) return
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0
    const left = card.offsetLeft - pad
    const right = card.offsetLeft + card.offsetWidth + pad - strip.clientWidth
    let to = strip.scrollLeft
    if (align === 'start' || left < to) to = left
    else if (right > to) to = right
    strip.scrollTo({ left: to, behavior: 'smooth' })
  }, [sel])

  // Keep the active tab visible when the tab row overflows (phones).
  const tabsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const tabs = tabsRef.current
    const tab = tabs?.querySelector<HTMLElement>('.is-active')
    if (!tabs || !tab) return
    const left = tab.offsetLeft - tabs.clientWidth / 2 + tab.offsetWidth / 2
    tabs.scrollTo({ left, behavior: 'smooth' })
  }, [cur.country.id])

  const select = (i: number, align: 'start' | 'nearest' = 'nearest') => {
    const n = Math.max(0, Math.min(entries.length - 1, i))
    if (n !== sel) playWorldSfx('hover')
    scrollAlign.current = align
    setSel(n)
  }

  const jumpTo = (countryId: string) => {
    const i = firstOf.get(countryId)
    if (i !== undefined) select(i, 'start')
  }

  // Keys the Hud doesn't own (it handles Esc → close, and its Enter → interact is
  // a no-op while the selector is open).
  const keyState = useRef({ sel, select, jumpTo })
  keyState.current = { sel, select, jumpTo }
  useEffect(() => {
    const countries = WORLDS.filter((c) => c.routes.length)
    const onKey = (e: KeyboardEvent) => {
      const { sel, select, jumpTo } = keyState.current
      const here = entries[sel]
      if (e.code === 'ArrowRight' || e.code === 'KeyD') select(sel + 1)
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') select(sel - 1)
      else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        const step = e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1
        const ci = countries.findIndex((c) => c.id === here.country.id)
        const next = countries[ci + step]
        if (next) jumpTo(next.id)
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') ride(here.route)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entries])

  // A vertical mouse wheel scrolls the row sideways.
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const r = cur.route
  return (
    <div className="wsel" role="dialog" aria-label="Select a world">
      <div className="wsel__bg" aria-hidden>
        {bgs.map((b) =>
          b.photo ? (
            <img key={b.id} className="wsel__bgimg" src={b.photo} alt="" draggable={false} />
          ) : (
            <div
              key={b.id}
              className="wsel__bgimg"
              style={{ background: `linear-gradient(150deg, ${b.thumb.from}, ${b.thumb.to})` }}
            />
          ),
        )}
        <div className="wsel__shade" />
      </div>

      <button type="button" className="wsel__close" aria-label="Back to town" onClick={close}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="wsel__inner">
        <nav className="wsel__tabs" aria-label="Regions" ref={tabsRef}>
          {WORLDS.map((c) => {
            const empty = !c.routes.length
            const active = c.id === cur.country.id
            return (
              <button
                key={c.id}
                type="button"
                className={'wsel__tab' + (active ? ' is-active' : '') + (empty ? ' is-empty' : '')}
                disabled={empty}
                title={empty ? 'Not ridden yet — coming soon' : undefined}
                onClick={(e) => {
                  jumpTo(c.id)
                  // Drop focus so the next arrow/Enter goes to the row, not this tab.
                  e.currentTarget.blur()
                }}
              >
                <span className="wsel__flag">{c.flag}</span>
                {c.name}
                {!empty && <span className="wsel__count">{c.routes.length}</span>}
              </button>
            )
          })}
        </nav>

        <header className="wsel__hero" key={r.id}>
          <div className="wsel__hero-main">
            <h2 className="wsel__title">{r.place}</h2>
            <p className="wsel__sub">
              {r.region} · {cur.country.flag} {cur.country.name}
            </p>
          </div>
          <dl className="wsel__stats">
            <div>
              <dt>Distance</dt>
              <dd>{r.distanceKm} km</dd>
            </div>
            <div>
              <dt>Climbing</dt>
              <dd>{r.elevationM.toLocaleString()} m</dd>
            </div>
          </dl>
        </header>

        <div className="wsel__strip" ref={stripRef}>
          {entries.map((e, i) => {
            const groupStart = i > 0 && firstOf.get(e.country.id) === i
            return (
              <div
                key={e.route.id}
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                className={
                  'wsel__card' + (i === sel ? ' is-selected' : '') + (groupStart ? ' is-group-start' : '')
                }
                role="button"
                tabIndex={-1}
                aria-label={`${e.route.place}, ${e.country.name}`}
                onPointerDown={(ev) => (lastPointer.current = ev.pointerType)}
                onMouseEnter={() => {
                  if (lastPointer.current === 'mouse' && i !== sel) select(i)
                }}
                onClick={() => {
                  // Touch has no hover: the first tap previews, the second rides.
                  if (lastPointer.current !== 'mouse' && i !== sel) select(i)
                  else ride(e.route)
                }}
              >
                <Thumb route={e.route} />
                {e.route.blogPath && (
                  <span className="wsel__blog" title="Has a ride log" aria-hidden>
                    📖
                  </span>
                )}
                <span className="wsel__cardname">{e.route.place}</span>
              </div>
            )
          })}
        </div>

        <footer className="wsel__hints">
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> Browse
          </span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Region
          </span>
          <button type="button" className="wsel__hint-btn" onClick={() => ride(r)}>
            <kbd>Enter</kbd> Ride
          </button>
          <button type="button" className="wsel__hint-btn wsel__hint-back" onClick={close}>
            <kbd>Esc</kbd> Back to town
          </button>
        </footer>
      </div>
    </div>
  )
}
