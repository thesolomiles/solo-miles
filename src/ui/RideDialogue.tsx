import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { ROUTES, routeScript } from '../config/worlds'
import { RIDE_OUTRO_LINE } from '../config/ride'
import { isTypingTarget } from '../systems/input'
import { pagesForBox, samePages } from './dialoguePages'

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
const TYPE_MS = 22 // per-character reveal speed

/**
 * Leonard's ride chat — a Pokémon-style speech box pinned to the bottom while the
 * auto-runner scrolls, in the same portrait speech box as town dialogue.
 * Text types out inside two lines; press E / Space / tap to finish the chunk
 * on screen, then again for the next chunk or the next line. Advancing past
 * the last line (the closing "great ride" line) ends the ride and fades back
 * to town (store.advanceRide).
 */
export function RideDialogue() {
  const ride = useGame((s) => s.ride)
  const rideLine = useGame((s) => s.rideLine)
  const route = ride ? ROUTES[ride] : null
  const lines = useMemo(() => (route ? [...routeScript(route), RIDE_OUTRO_LINE] : []), [route])
  const full = lines[rideLine] ?? ''

  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)
  const [pages, setPages] = useState<string[] | null>(null)
  const [page, setPage] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const textRef = useRef<HTMLParagraphElement>(null)
  const doneRef = useRef(false)
  // The press that finishes the typewriter is spent until that key is released.
  const spentRef = useRef(false)
  const fullRef = useRef(full)
  const chunkRef = useRef('')
  const moreRef = useRef(false)
  const chunk = pages?.[page] ?? ''
  const more = !!pages && page < pages.length - 1
  fullRef.current = full
  chunkRef.current = chunk
  moreRef.current = more

  // Measure how much of this line fits in the two-line box, and again if the
  // box width changes. A later press shows the next chunk; nothing scrolls off.
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const apply = (reset: boolean) => {
      const next = pagesForBox(el, fullRef.current)
      setPages((prev) => (samePages(prev, next) ? prev : next))
      setPage((p) => (reset ? 0 : Math.min(p, Math.max(0, next.length - 1))))
    }
    apply(true)
    setShown('')
    setDone(false)
    doneRef.current = false
    const ro = new ResizeObserver(() => apply(false))
    ro.observe(el)
    let cancel = false
    document.fonts?.ready.then(() => {
      if (!cancel) apply(false)
    })
    return () => {
      cancel = true
      ro.disconnect()
    }
  }, [full])

  // Type the current chunk. Stop when it fills the box; the rest waits for a press.
  useEffect(() => {
    if (!pages) return
    setShown('')
    setDone(false)
    doneRef.current = false
    let i = 0
    window.clearInterval(timer.current)
    if (!chunk) {
      doneRef.current = true
      setDone(true)
      return
    }
    timer.current = window.setInterval(() => {
      i++
      setShown(chunk.slice(0, i))
      if (i >= chunk.length) {
        window.clearInterval(timer.current)
        doneRef.current = true
        setDone(true)
      }
    }, TYPE_MS)
    return () => window.clearInterval(timer.current)
  }, [chunk, pages])

  const finishReveal = () => {
    window.clearInterval(timer.current)
    setShown(chunkRef.current)
    doneRef.current = true
    setDone(true)
  }

  const nextChunk = () => {
    doneRef.current = false
    setDone(false)
    setShown('')
    setPage((p) => p + 1)
  }
  const nextChunkRef = useRef(nextChunk)
  nextChunkRef.current = nextChunk

  // A tap completes the reveal; the next one shows the rest of the line, or
  // advances. The key that finishes the typewriter is spent until release.
  const advance = () => {
    if (spentRef.current) return
    if (!doneRef.current) finishReveal()
    else if (moreRef.current) nextChunk()
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
      setShown(chunkRef.current)
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
        if (moreRef.current) {
          nextChunkRef.current()
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
      <div className="dialogue dialogue--show">
        <div className="dbox">
          <div className="dbox__bust">
            <img src="/portraits/leonard-cyclist.png" alt="Leonard" />
          </div>
          <div className="dbox__name">Leonard</div>
          <div className="dbox__panel" onClick={advance}>
            <p className="dbox__text" ref={textRef}>
              {shown}
            </p>
            {done && (
              <span className="dbox__more" aria-hidden>
                ▶
              </span>
            )}
          </div>
        </div>
        <div className="ridebox__hint">{isTouch ? 'Tap to continue' : 'E / Space to continue · Esc to leave'}</div>
      </div>
    </>
  )
}
