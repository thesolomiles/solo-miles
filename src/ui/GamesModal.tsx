import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { ARCADE_GAMES, type ArcadeGame } from '../config/arcade'
import { playWorldSfx } from './worldSfx'

function Thumb({ game }: { game: ArcadeGame }) {
  if (game.thumb) return <img className="wsel__photo" src={game.thumb} alt="" draggable={false} />
  return (
    <div
      className="wsel__fallback"
      style={{ background: `linear-gradient(150deg, ${game.thumbFrom}, ${game.thumbTo})` }}
    />
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

/**
 * Open / close / pick stings for the arcade — same sounds as the world
 * selector. Mounted for the life of the HUD so close/pick still fire as the
 * modal unmounts; picking a game closes it in the same update as the fade.
 */
export function useGamesSelectorSfx() {
  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (s.gamesOpen === prev.gamesOpen) return
      if (s.gamesOpen) playWorldSfx('open')
      else if (s.transition?.kind === 'minigame' && s.transition.to) playWorldSfx('select')
      else playWorldSfx('close')
    })
  }, [])
}

/**
 * The café arcade's game selector (E on the café machines) — the world
 * selector's console-library layout: one side-scrolling row of games, the
 * highlighted one fills the hero and its art, blurred, is the backdrop.
 * ←/→ browse, Enter plays; Esc (Hud) closes. Pac-Man is the only live game.
 */
export function GamesModal() {
  const close = useGame((s) => s.closeGames)
  const [sel, setSel] = useState(0)
  const cur = ARCADE_GAMES[sel]
  const stripRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const lastPointer = useRef('mouse')

  // Backdrop crossfade: keep the previous image under the new one while it fades in.
  const [bgs, setBgs] = useState<ArcadeGame[]>([cur])
  useEffect(() => {
    setBgs((b) => (b[b.length - 1] === cur ? b : [b[b.length - 1], cur]))
  }, [cur])

  const play = (g: ArcadeGame) => {
    if (!g.locked) useGame.getState().requestMinigame('pacman')
  }

  // Keep the selected card on screen (scrolls the strip by hand — see WorldSelector).
  const scrolling = useRef(false)
  useLayoutEffect(() => {
    const strip = stripRef.current
    const card = cardRefs.current[sel]
    if (!scrolling.current || !strip || !card) return
    scrolling.current = false
    const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0
    const left = card.offsetLeft - pad
    const right = card.offsetLeft + card.offsetWidth + pad - strip.clientWidth
    let to = strip.scrollLeft
    if (left < to) to = left
    else if (right > to) to = right
    strip.scrollTo({ left: to, behavior: 'smooth' })
  }, [sel])

  const select = (i: number) => {
    const n = Math.max(0, Math.min(ARCADE_GAMES.length - 1, i))
    if (n !== sel) playWorldSfx('hover')
    scrolling.current = true
    setSel(n)
  }

  // Keys the Hud doesn't own (it handles Esc → close; its Enter → interact is a
  // no-op while the selector is open).
  const keyState = useRef({ sel, select })
  keyState.current = { sel, select }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { sel, select } = keyState.current
      if (e.code === 'ArrowRight' || e.code === 'KeyD') select(sel + 1)
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') select(sel - 1)
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') play(ARCADE_GAMES[sel])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  const unlocked = ARCADE_GAMES.filter((g) => !g.locked).length
  return (
    <div className="wsel" role="dialog" aria-label="Select a game">
      <div className="wsel__bg" aria-hidden>
        {bgs.map((b) =>
          b.thumb ? (
            <img key={b.id} className="wsel__bgimg" src={b.thumb} alt="" draggable={false} />
          ) : (
            <div
              key={b.id}
              className="wsel__bgimg"
              style={{ background: `linear-gradient(150deg, ${b.thumbFrom}, ${b.thumbTo})` }}
            />
          ),
        )}
        <div className="wsel__shade" />
      </div>

      <button type="button" className="wsel__close" aria-label="Back to café" onClick={close}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className="wsel__inner">
        <nav className="wsel__tabs" aria-label="Arcade">
          <span className="wsel__tab is-active" style={{ cursor: 'default' }}>
            🕹️ Café arcade
            <span className="wsel__count">
              {unlocked}/{ARCADE_GAMES.length}
            </span>
          </span>
        </nav>

        <header className="wsel__hero" key={cur.id}>
          <div className="wsel__hero-main">
            <h2 className="wsel__title">{cur.title}</h2>
            <p className="wsel__sub">{cur.locked ? 'Not in the café yet — coming soon' : cur.tagline}</p>
          </div>
          <dl className="wsel__stats">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={'wsel__pill' + (cur.locked ? ' is-locked' : '')}>
                  {cur.locked ? 'Locked' : 'Unlocked'}
                </span>
              </dd>
            </div>
          </dl>
        </header>

        <div className="wsel__strip" ref={stripRef}>
          {ARCADE_GAMES.map((g, i) => (
            <div
              key={g.id}
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              className={'wsel__card' + (i === sel ? ' is-selected' : '') + (g.locked ? ' is-locked' : '')}
              role="button"
              tabIndex={-1}
              aria-label={g.locked ? `${g.title} (locked)` : g.title}
              onPointerDown={(ev) => (lastPointer.current = ev.pointerType)}
              onMouseEnter={() => {
                if (lastPointer.current === 'mouse' && i !== sel) select(i)
              }}
              onClick={() => {
                // Touch has no hover: the first tap previews, the second plays.
                if (lastPointer.current !== 'mouse' && i !== sel) select(i)
                else play(g)
              }}
            >
              <Thumb game={g} />
              {g.locked && (
                <span className="wsel__lock">
                  <LockIcon />
                </span>
              )}
              <span className="wsel__cardname">{g.title}</span>
            </div>
          ))}
        </div>

        <footer className="wsel__hints">
          <span>
            <kbd>←</kbd>
            <kbd>→</kbd> Browse
          </span>
          <button type="button" className="wsel__hint-btn" disabled={cur.locked} onClick={() => play(cur)}>
            <kbd>Enter</kbd> Play
          </button>
          <button type="button" className="wsel__hint-btn wsel__hint-back" onClick={close}>
            <kbd>Esc</kbd> Back to café
          </button>
        </footer>
      </div>
    </div>
  )
}
