import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { isTypingTarget } from '../systems/input'
import { pagesForBox, samePages } from './dialoguePages'

const TYPE_MS = 22 // per-character reveal speed

export type SpeechChoice = { label: string }

/**
 * The portrait speech box shared by town/café talk and Leonard's ride chat.
 * Text types out inside two lines; a press finishes the chunk on screen, and
 * the next press (after that key is released) shows the rest or continues.
 */
export function SpeechBox({
  name,
  role,
  portrait,
  text,
  choices,
  onChoose,
  onContinue,
  hint,
  onEscape,
  yieldToRide = false,
}: {
  name: string
  /** Appended as ", role" on the name tag. Omit it and the tag is just the name. */
  role?: string
  portrait?: string
  text: string
  /** Shown once the last chunk of `text` has finished typing. */
  choices?: SpeechChoice[]
  onChoose?: (index: number) => void
  /** The line is fully on screen and the player continues. */
  onContinue: () => void
  hint?: string
  onEscape?: () => void
  /** Town talk steps aside while a ride's box owns the keys. */
  yieldToRide?: boolean
}) {
  const hasChoices = !!choices?.length
  const label = role ? `${name}, ${role}` : name

  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)
  const [sel, setSel] = useState(0)
  const [pages, setPages] = useState<string[] | null>(null)
  const [page, setPage] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const textRef = useRef<HTMLParagraphElement>(null)
  const doneRef = useRef(false)
  // The press that finishes the typewriter is spent until that key is released.
  // One Enter can't both skip the line and turn the page.
  const spentRef = useRef(false)
  const textPropRef = useRef(text)
  const hasChoicesRef = useRef(hasChoices)
  const choicesReadyRef = useRef(false)
  const choicesRef = useRef(choices)
  const selRef = useRef(sel)
  const chunkRef = useRef('')
  const moreRef = useRef(false)
  const onChooseRef = useRef(onChoose)
  const onContinueRef = useRef(onContinue)
  const onEscapeRef = useRef(onEscape)
  const yieldRef = useRef(yieldToRide)
  const chunk = pages?.[page] ?? ''
  const more = !!pages && page < pages.length - 1
  textPropRef.current = text
  hasChoicesRef.current = hasChoices
  choicesReadyRef.current = done && hasChoices && !more
  choicesRef.current = choices
  selRef.current = sel
  chunkRef.current = chunk
  moreRef.current = more
  onChooseRef.current = onChoose
  onContinueRef.current = onContinue
  onEscapeRef.current = onEscape
  yieldRef.current = yieldToRide

  const choicesReady = done && hasChoices && !more

  // Measure how much of this line fits in the two-line box, and again if the
  // box width changes. A later press shows the next chunk; nothing scrolls off.
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const apply = (reset: boolean) => {
      const next = pagesForBox(el, textPropRef.current)
      setPages((prev) => (samePages(prev, next) ? prev : next))
      setPage((p) => (reset ? 0 : Math.min(p, Math.max(0, next.length - 1))))
    }
    apply(true)
    setShown('')
    setDone(false)
    doneRef.current = false
    setSel(0)
    const ro = new ResizeObserver(() => apply(false))
    ro.observe(el)
    // Space Mono loading after the first measure would let a chunk overflow.
    let cancel = false
    document.fonts?.ready.then(() => {
      if (!cancel) apply(false)
    })
    return () => {
      cancel = true
      ro.disconnect()
    }
  }, [text])

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

  // A tap completes the reveal; the next one advances (unless choices are
  // waiting). A click from the key that just finished the line is ignored —
  // that press is spent until keyup.
  const onAdvance = () => {
    if (spentRef.current) return
    if (!doneRef.current) finishReveal()
    else if (moreRef.current) nextChunk()
    else if (!hasChoicesRef.current) onContinueRef.current()
  }

  // Bound once. Rebinding on every typed character let the same Enter finish
  // the line and then turn the page (the new listener saw the line as done).
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
      if (yieldRef.current && useGame.getState().ride) return
      if (advanceKey(e)) {
        // Swallow the press so no other listener (and no click it would
        // synthesize) can also advance or confirm.
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
        if (choicesReadyRef.current) {
          const list = choicesRef.current
          if (list && selRef.current < list.length) onChooseRef.current?.(selRef.current)
          return
        }
        if (!hasChoicesRef.current) onContinueRef.current()
        return
      }
      if (e.code === 'Escape' && onEscapeRef.current) {
        e.preventDefault()
        onEscapeRef.current()
        return
      }
      if (!choicesReadyRef.current) return
      const list = choicesRef.current ?? []
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        setSel((s) => (s - 1 + list.length) % list.length)
        return
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        setSel((s) => (s + 1) % list.length)
        return
      }
      const idx = ({ Digit1: 0, Digit2: 1, Digit3: 2 } as Record<string, number>)[e.code]
      if (idx !== undefined && list[idx]) {
        e.preventDefault()
        onChooseRef.current?.(idx)
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
    <div className="dialogue dialogue--show">
      <div className={'dbox' + (portrait ? '' : ' dbox--noface')}>
        {portrait && (
          <div className="dbox__bust">
            <img src={portrait} alt={name} />
          </div>
        )}
        <div className="dbox__name">{label}</div>
        {choicesReady && choices && (
          <div className="dbox__choices">
            {choices.map((c, i) => (
              <button
                key={c.label}
                className={'dchoice' + (i === sel ? ' dchoice--sel' : '')}
                onMouseEnter={() => setSel(i)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (spentRef.current) return
                  onChooseRef.current?.(i)
                }}
              >
                <span className="dchoice__cursor" aria-hidden>
                  ▶
                </span>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="dbox__panel" onClick={onAdvance}>
          <p className="dbox__text" ref={textRef}>
            {shown}
          </p>
          {done && !choicesReady && (
            <span className="dbox__more" aria-hidden>
              ▶
            </span>
          )}
        </div>
      </div>
      {hint && <div className="ridebox__hint">{hint}</div>}
    </div>
  )
}
