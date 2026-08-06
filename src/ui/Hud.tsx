import { useEffect, useState } from 'react'
import { useGame } from '../state/store'
import { SECTIONS, type Interactable } from '../config/town'

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
          <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span>
          <span><kbd>E</kbd> interact</span>
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
  return <div className={'hint' + (show ? ' hint--show' : '')}>WASD / arrows to move · walk up to a door or a face and press E</div>
}

function Prompt({ near }: { near: Interactable }) {
  return (
    <div className="prompt prompt--show">
      <span className="prompt__key">E</span>
      <span>{(near.verb || 'Talk') + ' · ' + near.name}</span>
    </div>
  )
}

function Dialogue({ item, line }: { item: Interactable; line: number }) {
  const advance = useGame((s) => s.advance)
  const last = line >= item.lines.length - 1
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
          <button className="dialogue__next" onClick={advance}>
            {nextLabel} <span className="dialogue__k">E</span>
          </button>
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

export function Hud() {
  const started = useGame((s) => s.started)
  const near = useGame((s) => s.near)
  const dialogue = useGame((s) => s.dialogue)
  const line = useGame((s) => s.line)
  const section = useGame((s) => s.section)

  // The single interact key (mirrors the prototype's edge handling).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault()
        useGame.getState().interact()
      } else if (e.code === 'Escape') {
        const st = useGame.getState()
        if (st.section) st.closeSection()
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
      {started && near && !dialogue && !section && <Prompt near={near} />}
      {dialogue && <Dialogue item={dialogue} line={line} />}
      {section && <SectionOverlay id={section} />}
    </div>
  )
}
