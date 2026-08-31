import { useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { ROUTES, routeScript } from '../config/worlds'
import { RIDE_OUTRO_LINE } from '../config/ride'
import { isTypingTarget } from '../systems/input'
import { LeonardAvatar } from './LeonardAvatar'

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const TYPE_MS = 22 // per-character reveal speed

/**
 * Leonard's ride chat — a Pokémon-style speech box pinned to the bottom while the
 * auto-runner scrolls. Text types out; press E / Space / tap to fast-forward the
 * reveal, then again to advance. Advancing past the last line (the closing
 * "great ride" line) ends the ride and fades back to town (store.advanceRide).
 */
export function RideDialogue() {
  const ride = useGame((s) => s.ride)
  const rideLine = useGame((s) => s.rideLine)
  const route = ride ? ROUTES[ride] : null
  const lines = useMemo(() => (route ? [...routeScript(route), RIDE_OUTRO_LINE] : []), [route])
  const full = lines[rideLine] ?? ''

  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Type the current line out, character by character.
  useEffect(() => {
    setShown('')
    setDone(false)
    let i = 0
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      i++
      setShown(full.slice(0, i))
      if (i >= full.length) {
        window.clearInterval(timer.current)
        setDone(true)
      }
    }, TYPE_MS)
    return () => window.clearInterval(timer.current)
  }, [full])

  // First press finishes the reveal; the next advances the line.
  const advance = () => {
    if (!done) {
      window.clearInterval(timer.current)
      setShown(full)
      setDone(true)
    } else {
      useGame.getState().advanceRide()
    }
  }

  // Keyboard: E / Space / Enter advance; Escape leaves the ride. Owned here so the
  // reveal-then-advance logic stays in one place (the Hud defers to us in-ride).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        advance()
      } else if (e.code === 'Escape') {
        e.preventDefault()
        useGame.getState().requestRide(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
      {/* Open the ride's blog post in a new tab (same-origin static file under
          public/blog/). Only shown when this route has a post; kept out of the
          speech box so its click doesn't advance the dialogue. */}
      {route?.blogPath && (
        <button
          className="ride-blog"
          type="button"
          title={`Read the ride log: ${route.place}`}
          onClick={() => window.open(route.blogPath, '_blank', 'noopener,noreferrer')}
        >
          <span className="ride-blog__icon" aria-hidden>📖</span>
          <span className="ride-blog__label">Read the log</span>
        </button>
      )}
      <div className="ridebox" onClick={advance}>
        <div className="ridebox__row">
          <div className="ridebox__avatar" aria-hidden>
            <LeonardAvatar />
          </div>
          <div className="ridebox__panel">
            <div className="ridebox__name">Leonard</div>
            <p className="ridebox__text">{shown}</p>
            <span className={'ridebox__next' + (done ? ' is-ready' : '')}>▼</span>
          </div>
        </div>
        <div className="ridebox__hint">{isTouch ? 'Tap to continue' : 'E / Space to continue · Esc to leave'}</div>
      </div>
    </>
  )
}
