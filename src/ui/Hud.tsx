import { useEffect, useState } from 'react'
import { useGame } from '../state/store'
import { SECTIONS, type Interactable, type InteractZone } from '../config/town'
import { TouchControls } from './TouchControls'
import { RidesModal } from './RidesModal'
import { isTypingTarget } from '../systems/input'

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')

/** Intro card — dismissed by "Enter the town", which also enables movement. */
function Intro() {
  const start = useGame((s) => s.start)
  return (
    <div className="intro">
      <div className="intro__card">
        <p className="intro__eyebrow">Solomiles · the town</p>
        <h1 className="intro__title">A little town in the countryside.</h1>
        <p className="intro__lede">
          A locked orthographic three-quarter camera. It scrolls to follow you but never rotates —
          clean, diorama-flat, every building simply facing you.
        </p>
        <div className="intro__map">
          <b>Mi casa</b><span>home base</span>
          <b>Mom's</b><span>the family corner</span>
          <b>Café</b><span>pull up a chair</span>
          <b>Bike shop</b><span>rides &amp; gear</span>
          <b>The trail</b><span>out into the trips</span>
        </div>
        <div className="intro__keys">
          {isTouch ? (
            <span>Drag the stick to move · tap a prompt to interact</span>
          ) : (
            <>
              <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span>
              <span><kbd>Space</kbd> jump</span>
              <span><kbd>E</kbd> interact</span>
            </>
          )}
        </div>
        <button className="btn" onClick={start}>Enter the town →</button>
      </div>
    </div>
  )
}

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
  const advance = useGame((s) => s.advance)
  const choose = useGame((s) => s.choose)
  const last = line >= item.lines.length - 1
  const showChoices = last && !!item.choices?.length
  const nextLabel = last ? (item.section ? `Open ${SECTIONS[item.section].title} →` : 'Close') : 'Continue'
  return (
    <div className="dialogue dialogue--show">
      <div className="dialogue__box">
        <div className="dialogue__who">
          <span className="dialogue__dot" style={{ background: hex(item.color) }} />
          <span className="dialogue__name">{item.name}</span>
          <span className="dialogue__role">· {item.role}</span>
        </div>
        <div className="dialogue__text">{item.lines[line]}</div>
        <div className="dialogue__foot">
          <div className="dialogue__progress">
            {item.lines.map((_, i) => (
              <span key={i} className={'pip' + (i <= line ? ' pip--on' : '')} />
            ))}
          </div>
          {showChoices ? (
            <div className="dialogue__choices">
              {item.choices!.map((c, i) => (
                <button key={c.label} className="dialogue__choice" onClick={() => choose(c)}>
                  {c.label} <span className="dialogue__k">{i + 1}</span>
                </button>
              ))}
            </div>
          ) : (
            <button className="dialogue__next" onClick={advance}>
              {nextLabel} <span className="dialogue__k">E</span>
            </button>
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
  const ridesOpen = useGame((s) => s.ridesOpen)
  const nearZone = useGame((s) => s.nearZone)

  // The single interact key (mirrors the prototype's edge handling).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Let text fields (the dev editor panels' name/verb inputs) keep their
      // keystrokes — otherwise we'd preventDefault "E"/Space/Enter out of them.
      if (isTypingTarget(e.target)) return
      const st = useGame.getState()
      // Number keys resolve a choice dialogue (Leonard's Yes/No).
      const choices = st.dialogue?.choices
      if (choices && st.line >= st.dialogue!.lines.length - 1) {
        const idx = { Digit1: 0, Digit2: 1, Digit3: 2 }[e.code]
        if (idx !== undefined && choices[idx]) {
          e.preventDefault()
          st.choose(choices[idx])
          return
        }
      }
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        useGame.getState().interact()
      } else if (e.code === 'Escape') {
        const st = useGame.getState()
        if (st.ridesOpen) st.closeRides()
        else if (st.section) st.closeSection()
        else if (st.dialogue) st.closeDialogue()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="hud">
      {!started && <Intro />}
      {started && <Hint />}
      {started && isTouch && !dialogue && !section && !ridesOpen && <TouchControls />}
      {started && near && !dialogue && !section && !ridesOpen && <Prompt near={near} />}
      {started && !near && nearZone && !dialogue && !section && !ridesOpen && (
        <ZonePrompt zone={nearZone} />
      )}
      {dialogue && <Dialogue item={dialogue} line={line} />}
      {section && <SectionOverlay id={section} />}
      {ridesOpen && <RidesModal />}
      <Transition />
    </div>
  )
}
