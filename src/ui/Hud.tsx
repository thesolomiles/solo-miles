import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { SECTIONS, type Interactable, type InteractZone } from '../config/town'
import { TouchControls } from './TouchControls'
import { WorldSelector, useWorldSelectorSfx } from './WorldModal'
import { GamesModal } from './GamesModal'
import { RideDialogue } from './RideDialogue'
import { RideHud } from './RideHud'
import { RideRouteOverview } from './RideRouteOverview'
import { PacmanHud } from './PacmanHud'
import { isTypingTarget } from '../systems/input'
import { pagesForBox, samePages } from './dialoguePages'

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

function Hint() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 5600)
    return () => clearTimeout(t)
  }, [])
  const text = isTouch
    ? 'Drag the stick to move · tap a prompt to interact'
    : 'WASD / arrows to move · Space to jump · walk up to a door or a face and press E'
  return <div className={'hint' + (show ? ' hint--show' : '')}>{text}</div>
}

function Prompt({ near }: { near: Interactable }) {
  // Tappable so touch devices (no E key) can trigger the interaction too.
  return (
    <button className="prompt prompt--show" onClick={() => useGame.getState().interact()}>
      <span className="prompt__key">{isTouch ? '›' : 'E'}</span>
      <span>{(near.verb || 'Talk') + ' · ' + near.name}</span>
    </button>
  )
}

function ZonePrompt({ zone }: { zone: InteractZone }) {
  // Same chip as the interactable prompt; pressing it fires the zone (which
  // currently just announces itself — see store.interact / `solomiles:zone`).
  return (
    <button className="prompt prompt--show" onClick={() => useGame.getState().interact()}>
      <span className="prompt__key">{isTouch ? '›' : 'E'}</span>
      <span>{zone.verb || 'Enter'}</span>
    </button>
  )
}

const TYPE_MS = 22 // per-character reveal speed

function Dialogue({ item, line }: { item: Interactable; line: number }) {
  const choose = useGame((s) => s.choose)
  const full = item.lines[line] ?? ''
  const last = line >= item.lines.length - 1
  const hasChoices = last && !!item.choices?.length
  // Choices are shown top-to-bottom in reverse of the data order (Leonard's Figma
  // puts the dismiss option on top); number keys follow the shown order.
  const shownChoices = hasChoices ? [...item.choices!].reverse() : []

  const [shown, setShown] = useState('')
  const [done, setDone] = useState(false)
  const [sel, setSel] = useState(0) // highlighted choice
  // Visual pages of the current line. Null until the box has been measured.
  const [pages, setPages] = useState<string[] | null>(null)
  const [page, setPage] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  const textRef = useRef<HTMLParagraphElement>(null)
  const doneRef = useRef(false)
  // The press that finishes the typewriter is spent until that key is released.
  // One Enter can't both skip the line and turn the page.
  const spentRef = useRef(false)
  const fullRef = useRef(full)
  const hasChoicesRef = useRef(hasChoices)
  const choicesReadyRef = useRef(false)
  const shownChoicesRef = useRef(shownChoices)
  const selRef = useRef(sel)
  const chunkRef = useRef('')
  const moreRef = useRef(false)
  const chunk = pages?.[page] ?? ''
  const more = !!pages && page < pages.length - 1
  fullRef.current = full
  hasChoicesRef.current = hasChoices
  choicesReadyRef.current = done && hasChoices && !more
  shownChoicesRef.current = shownChoices
  selRef.current = sel
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

  const choicesReady = done && hasChoices && !more

  // A tap completes the reveal; the next one advances (unless choices are
  // waiting). A click from the key that just finished the line is ignored —
  // that press is spent until keyup.
  const onAdvance = () => {
    if (spentRef.current) return
    if (!doneRef.current) finishReveal()
    else if (moreRef.current) nextChunk()
    else if (!hasChoices) useGame.getState().advance()
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
      // A ride's speech box owns these keys while one is running.
      if (useGame.getState().ride) return
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
          const choices = shownChoicesRef.current
          const pick = choices[selRef.current]
          if (pick) useGame.getState().choose(pick)
          return
        }
        if (!hasChoicesRef.current) useGame.getState().advance()
        return
      }
      if (!choicesReadyRef.current) return
      const choices = shownChoicesRef.current
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        setSel((s) => (s - 1 + choices.length) % choices.length)
        return
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        setSel((s) => (s + 1) % choices.length)
        return
      }
      const idx = ({ Digit1: 0, Digit2: 1, Digit3: 2 } as Record<string, number>)[e.code]
      if (idx !== undefined && choices[idx]) {
        e.preventDefault()
        useGame.getState().choose(choices[idx])
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
      <div className={'dbox' + (item.portrait ? '' : ' dbox--noface')}>
        {item.portrait && (
          <div className="dbox__bust">
            <img src={item.portrait} alt={item.name} />
          </div>
        )}
        <div className="dbox__name">
          {item.name}, {item.role}
        </div>
        {choicesReady && (
          <div className="dbox__choices">
            {shownChoices.map((c, i) => (
              <button
                key={c.label}
                className={'dchoice' + (i === sel ? ' dchoice--sel' : '')}
                onMouseEnter={() => setSel(i)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (spentRef.current) return
                  choose(c)
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
    </div>
  )
}

function SectionOverlay({ id }: { id: keyof typeof SECTIONS }) {
  const close = useGame((s) => s.closeSection)
  const s = SECTIONS[id]
  return (
    <div className="section">
      <div className="section__panel">
        <button className="section__close" onClick={close} aria-label="Back to town">
          ✕
        </button>
        <p className="section__eyebrow">Solomiles</p>
        <h2 className="section__title">{s.title}</h2>
        <p className="section__blurb">{s.blurb}</p>
        <div className="section__placeholder">
          Content for this section lands in Phase 4. For now, this is the routing working — walk up,
          press E, and the right door opens.
        </div>
        <button className="btn btn--ghost" onClick={close}>← Back to town</button>
      </div>
    </div>
  )
}

/**
 * Full-screen fade-to-black over a town↔café transition. Fades out, swaps the
 * world at full black (commitInterior — model + collision swap + player teleport
 * all happen unseen), holds a beat so the new scene renders, then fades back in.
 * Driven by `transition` in the store; blocks input while active.
 */
function Transition() {
  const transition = useGame((s) => s.transition)
  const [phase, setPhase] = useState<'idle' | 'out' | 'hold' | 'in'>('idle')

  useEffect(() => {
    if (transition && phase === 'idle') setPhase('out')
  }, [transition, phase])

  const onEnd = () => {
    if (phase === 'out') {
      useGame.getState().commitInterior() // swap unseen, at full black
      setPhase('hold')
      window.setTimeout(() => setPhase('in'), 140) // let the new scene render
    } else if (phase === 'in') {
      useGame.getState().endTransition()
      setPhase('idle')
    }
  }

  const opaque = phase === 'out' || phase === 'hold'
  return (
    <div
      onTransitionEnd={onEnd}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        opacity: opaque ? 1 : 0,
        pointerEvents: phase === 'idle' ? 'none' : 'auto',
        transition: 'opacity 260ms ease',
        zIndex: 50,
      }}
    />
  )
}

export function Hud() {
  const started = useGame((s) => s.started)
  const near = useGame((s) => s.near)
  const dialogue = useGame((s) => s.dialogue)
  const line = useGame((s) => s.line)
  const section = useGame((s) => s.section)
  const worldOpen = useGame((s) => s.worldOpen)
  const gamesOpen = useGame((s) => s.gamesOpen)
  const minigame = useGame((s) => s.minigame)
  const ride = useGame((s) => s.ride)
  const nearZone = useGame((s) => s.nearZone)
  useWorldSelectorSfx()

  // The single interact key (mirrors the prototype's edge handling).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Let text fields (the dev editor panels' name/verb inputs) keep their
      // keystrokes — otherwise we'd preventDefault "E"/Space/Enter out of them.
      if (isTypingTarget(e.target)) return
      const st = useGame.getState()
      // During a ride the speech box (RideDialogue) owns the keys (advance / Esc);
      // don't also run movement/interact handling here.
      if (st.ride) return
      // An open dialogue box owns its own keys (typewriter reveal, advance, choices)
      // — see Dialogue. The Hud only handles Escape to close it.
      if (st.dialogue) {
        if (e.code === 'Escape') {
          e.preventDefault()
          st.closeDialogue()
        }
        return
      }
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        useGame.getState().interact()
      } else if (e.code === 'Escape') {
        const st = useGame.getState()
        if (st.minigame) {
          if (st.arcade?.status === 'won' || st.arcade?.status === 'lost') st.requestMinigame(null)
          else st.setArcadePaused(!st.arcade?.paused)
        } else if (st.gamesOpen) st.closeGames()
        else if (st.worldOpen) st.closeWorld()
        else if (st.section) st.closeSection()
        else if (st.dialogue) st.closeDialogue()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="hud">
      {/* No intro modal — the opening cinematic (OrthoRig) sweeps in from the
          southern trees onto the character, then calls start() itself. */}
      {started && <Hint />}
      {started && isTouch && !dialogue && !section && !worldOpen && !gamesOpen && !minigame && !ride && (
        <TouchControls />
      )}
      {started && near && !dialogue && !section && !worldOpen && !gamesOpen && !minigame && !ride && (
        <Prompt near={near} />
      )}
      {started && !near && nearZone && !dialogue && !section && !worldOpen && !gamesOpen && !minigame && !ride && (
        <ZonePrompt zone={nearZone} />
      )}
      {dialogue && <Dialogue item={dialogue} line={line} />}
      {section && <SectionOverlay id={section} />}
      {worldOpen && <WorldSelector />}
      {gamesOpen && <GamesModal />}
      {ride && <RideDialogue />}
      {ride && <RideHud />}
      {ride && <RideRouteOverview />}
      {minigame === 'pacman' && <PacmanHud />}
      <Transition />
    </div>
  )
}
