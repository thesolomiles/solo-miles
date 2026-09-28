import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BLURB_PLACEHOLDER, SHOW_BLOG, WORLDS, type Country, type Route } from '../config/worlds'
import { playWorldSfx } from './worldSfx'
import './worldSelector.css'

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

interface Entry {
  route: Route
  country: Country
}

export interface RouteSelectorProps {
  /** Enter / the hero's button: ride the highlighted route. */
  onPick: (route: Route) => void
  /** The hero button + footer label for onPick, e.g. "Start ride". */
  pickLabel: string
  /** Esc-hint button + the phone close button. */
  onBack: () => void
  backLabel: string
  /** Extra footer buttons, between the pick and back buttons. */
  hints?: ReactNode
  /** Extra bits on the right of the hero, after the stats (the blog's links). */
  heroAside?: (route: Route) => ReactNode
  /** The route highlighted on open. */
  initialId?: string
  /** Stop listening to keys (the blog's log is open on top). */
  paused?: boolean
  /** Hover ticks (the game's stings; the blog stays quiet). */
  sfx?: boolean
  label?: string
}

/**
 * The route picker — a console-library style selector. Every route sits in one
 * side-scrolling row; the country tabs above it are just jump links into that
 * row. The highlighted route fills the hero (name, stats, blurb, pick button)
 * and its thumbnail, blurred, becomes the backdrop. Clicking a card only
 * highlights it; the button or Enter picks. ←/→ browse, ↑/↓ jump country.
 * Used by the game's world selector (ui/WorldModal.tsx).
 */
export function RouteSelector({
  onPick,
  pickLabel,
  onBack,
  backLabel,
  hints,
  heroAside,
  initialId,
  paused = false,
  sfx = false,
  label = 'Select a route',
}: RouteSelectorProps) {
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

  const [sel, setSel] = useState(() => Math.max(0, entries.findIndex((e) => e.route.id === initialId)))
  const cur = entries[sel]
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastPointer = useRef('mouse')

  // Backdrop crossfade: keep the previous image under the new one while it fades in.
  const [bgs, setBgs] = useState<Route[]>([cur.route])
  useEffect(() => {
    setBgs((b) => (b[b.length - 1] === cur.route ? b : [b[b.length - 1], cur.route]))
  }, [cur.route])

  // How the next selection should scroll into view: a tab jump pins that
  // country's first card to the left edge; browsing just keeps it on screen.
  // (Scrolls the strip by hand — scrollIntoView also nudges the overflow-hidden
  // overlay sideways.) Runs after render so the enlarged card is measured.
  // Starts at 'start' so a route highlighted on open is scrolled to.
  const scrollAlign = useRef<'start' | 'nearest' | null>(sel ? 'start' : null)
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
    if (n !== sel && sfx) playWorldSfx('hover')
    scrollAlign.current = align
    setSel(n)
  }

  const jumpTo = (countryId: string) => {
    const i = firstOf.get(countryId)
    if (i !== undefined) select(i, 'start')
  }

  // Keys (Esc belongs to the host: the game's Hud closes, the blog closes its log).
  const keyState = useRef({ sel, select, jumpTo, onPick, paused })
  keyState.current = { sel, select, jumpTo, onPick, paused }
  useEffect(() => {
    const countries = WORLDS.filter((c) => c.routes.length)
    const onKey = (e: KeyboardEvent) => {
      const { sel, select, jumpTo, onPick, paused } = keyState.current
      if (paused) return
      const here = entries[sel]
      if (e.code === 'ArrowRight' || e.code === 'KeyD') select(sel + 1)
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') select(sel - 1)
      else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        const step = e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : -1
        const ci = countries.findIndex((c) => c.id === here.country.id)
        const next = countries[ci + step]
        if (next) jumpTo(next.id)
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') onPick(here.route)
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
    <div className="wsel" role="dialog" aria-label={label}>
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

      <button type="button" className="wsel__close" aria-label={backLabel} onClick={onBack}>
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

        <header className="wsel__hero wsel__hero--stack" key={r.id}>
          <p className="wsel__kicker">
            <span className="wsel__flag">{cur.country.flag}</span>
            {cur.country.name} · {r.region}
          </p>
          <h2 className="wsel__title">{r.place}</h2>
          <p className="wsel__meta">
            <span>{r.distanceKm} km</span>
            <span>{r.elevationM.toLocaleString()} m climbing</span>
            {r.date && <span>{r.date.slice(0, 4)}</span>}
          </p>
          <p className={'wsel__blurb' + (r.blurb ? '' : ' is-placeholder')}>{r.blurb ?? BLURB_PLACEHOLDER}</p>
          <div className="wsel__actions">
            <button type="button" className="wsel__btn" onClick={() => onPick(r)}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M7 4.5v15l12-7.5z" />
              </svg>
              {pickLabel}
            </button>
            {heroAside?.(r)}
          </div>
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
                // A card only highlights its route; the hero's button (or Enter) picks it.
                onClick={() => select(i)}
              >
                <Thumb route={e.route} />
                {SHOW_BLOG && e.route.blogPath && (
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
          <button type="button" className="wsel__hint-btn" onClick={() => onPick(r)}>
            <kbd>Enter</kbd> {pickLabel}
          </button>
          {hints}
          <button type="button" className="wsel__hint-btn wsel__hint-back" onClick={onBack}>
            <kbd>Esc</kbd> {backLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
