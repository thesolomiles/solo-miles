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
  const doneRef = useRef(false)
  // The press that finishes the typewriter is spent until that key is released.
  const spentRef = useRef(false)
  const fullRef = useRef(full)
  fullRef.current = full

  // Type the current line out, character by character.
  useEffect(() => {
    setShown('')
    setDone(false)
    doneRef.current = false
    let i = 0
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      i++
      setShown(full.slice(0, i))
      if (i >= full.length) {
        window.clearInterval(timer.current)
        doneRef.current = true
        setDone(true)
      }
    }, TYPE_MS)
    return () => window.clearInterval(timer.current)
  }, [full])

  const finishReveal = () => {
    window.clearInterval(timer.current)
    setShown(full)
    doneRef.current = true
    setDone(true)
  }

  // A tap completes the reveal; the next one advances. The key that finishes
  // the typewriter is spent until release, so it can't also turn the page.
  const advance = () => {
    if (spentRef.current) return
    if (!doneRef.current) finishReveal()
    else useGame.getState().advanceRide()
  }

  // Bound once. Rebinding on every typed character let one Enter finish the
  // line and turn the page. Capture + stopImmediatePropagation so a leaked
  // listener can't also handle the same press.
  useEffect(() => {
    const advanceKey = (e: KeyboardEvent) =>
      e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter'
    const reveal = () => {
      window.clearInterval(timer.current)
      setShown(fullRef.current)
      doneRef.current = true
      setDone(true)
    }
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (advanceKey(e)) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (e.repeat || spentRef.current) return
        spentRef.current = true
        if (!doneRef.current) {
          reveal()
          return
        }
        useGame.getState().advanceRide()
      } else if (e.code === 'Escape') {
        e.preventDefault()
        useGame.getState().requestRide(null)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (advanceKey(e)) spentRef.current = false
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKeyUp, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [])

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
