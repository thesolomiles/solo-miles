import { useEffect, useState } from 'react'
import { useGame } from '../state/store'
import { SECTIONS, type Interactable, type InteractZone } from '../config/town'
import { TouchControls } from './TouchControls'
import { WorldSelector, useWorldSelectorSfx } from './WorldModal'
import { GamesModal } from './GamesModal'
import { RideDialogue } from './RideDialogue'
import { RideHud } from './RideHud'
import { RideRouteOverview } from './RideRouteOverview'
import { PacmanHud } from './PacmanHud'
import { SpeechBox } from './SpeechBox'
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

function Dialogue({ item, line }: { item: Interactable; line: number }) {
  const full = item.lines[line] ?? ''
  const last = line >= item.lines.length - 1
  // Choices are shown top-to-bottom in reverse of the data order (Leonard's Figma
  // puts the dismiss option on top); number keys follow the shown order.
  const shownChoices = last && item.choices?.length ? [...item.choices].reverse() : undefined

  return (
    <SpeechBox
      name={item.name}
      role={item.role || undefined}
      portrait={item.portrait}
      text={full}
      choices={shownChoices?.map((c) => ({ label: c.label }))}
      onChoose={(i) => {
        const pick = shownChoices?.[i]
        if (pick) useGame.getState().choose(pick)
      }}
      onContinue={() => useGame.getState().advance()}
      yieldToRide
    />
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
