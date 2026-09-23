import { useEffect, useRef, useState } from 'react'
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
  const timer = useRef<number | undefined>(undefined)
  const textRef = useRef<HTMLParagraphElement>(null)

  // Type the whole line. The box stays two lines tall; once the copy runs past
  // that, it scrolls so the sentence keeps going instead of jumping to a new page.
  useEffect(() => {
    setShown('')
    setDone(false)
    setSel(0)
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

  useEffect(() => {
    const el = textRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [shown])

  const finishReveal = () => {
    window.clearInterval(timer.current)
    setShown(full)
    setDone(true)
  }

  const choicesReady = done && hasChoices

  // First press/tap completes the reveal; the next advances (unless choices are
  // waiting, in which case the player must pick one). This box owns its keys
  // while it's open — the Hud defers to it (like RideDialogue in-ride).
  const onAdvance = () => {
    if (!done) finishReveal()
    else if (!hasChoices) useGame.getState().advance()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (choicesReady) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault()
          setSel((s) => (s - 1 + shownChoices.length) % shownChoices.length)
          return
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault()
          setSel((s) => (s + 1) % shownChoices.length)
          return
        }
        if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          choose(shownChoices[sel])
          return
        }
        const idx = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]
        if (idx !== undefined && shownChoices[idx]) {
          e.preventDefault()
          choose(shownChoices[idx])
        }
        return
      }
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        onAdvance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
