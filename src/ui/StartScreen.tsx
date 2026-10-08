import { useEffect, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { startWind } from '../systems/introSfx'
import { isTypingTarget } from '../systems/input'
import { useScramble } from './PersonalSite'

/** Other projects, listed in the start screen's modal. */
const PROJECTS = [
  {
    id: 'routecheck',
    name: 'Routechecker',
    blurb: 'Check a Japan GPX route against live road closures before you ride it.',
    url: 'https://routecheck.thesolomiles.com',
    host: 'routecheck.thesolomiles.com',
    status: 'Live',
  },
]

type ItemId = 'enter' | 'projects'

/**
 * The intro's start screen, shown while the player floats in the sky: the
 * Solo Miles logo over a two-item menu in the personal site's hologram style.
 * "Enter world" reads "Loading" until the town is in and settled. The press is
 * the user gesture browsers need for audio, so the wind starts in the handler.
 */
export function StartScreen() {
  const phase = useGame((s) => s.introPhase)
  const ready = useGame((s) => s.introReady)
  const go = useGame((s) => s.introGo)
  const [sel, setSel] = useState<ItemId>('enter')
  const [modal, setModal] = useState(false)

  const enter = () => {
    const st = useGame.getState()
    if (!st.introReady || st.introGo) return
    startWind()
    st.goIntro()
  }
  const activate = (id: ItemId) => (id === 'enter' ? enter() : setModal(true))

  useEffect(() => {
    if (go) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (modal) {
        if (e.code === 'Escape' || e.code === 'Backspace') {
          e.preventDefault()
          setModal(false)
        }
        return
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault()
        setSel((s) => (s === 'enter' ? 'projects' : 'enter'))
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault()
        activate(sel)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, modal, sel])

  if (phase !== 'sky') return null
  return (
    <div className={'start' + (go ? ' start--gone' : '')}>
      <span className="start__plus" style={{ left: 'var(--frame)', top: 'var(--frame)' }}>+</span>
      <span className="start__plus" style={{ left: '50%', top: 'var(--frame)' }}>+</span>
      <span className="start__plus" style={{ left: 'calc(100% - var(--frame))', top: 'var(--frame)' }}>+</span>
      <span className="start__plus" style={{ left: 'var(--frame)', top: 'calc(100% - var(--frame))' }}>+</span>
      <span className="start__plus" style={{ left: 'calc(100% - var(--frame))', top: 'calc(100% - var(--frame))' }}>+</span>

      <div className="start__center">
        <img className="start__logo" src="/brand/solomiles-horizontal-light.svg" alt="Solo Miles" />
        <nav className="start__menu">
          <StartItem
            label={ready ? 'Enter world' : 'Loading…'}
            sel={sel === 'enter' && !modal}
            disabled={!ready || go}
            onHover={() => setSel('enter')}
            onClick={() => activate('enter')}
          />
          <StartItem
            label="Other projects"
            sel={sel === 'projects' && !modal}
            onHover={() => setSel('projects')}
            onClick={() => activate('projects')}
          />
        </nav>
      </div>

      <div className="start__status">
        {ready ? 'SYS.READY' : 'SYS.LOADING'}
        <span className="start__caret" />
      </div>
      {modal && <ProjectsModal onClose={() => setModal(false)} />}
    </div>
  )
}

function StartItem({
  label,
  sel,
  disabled,
  onHover,
  onClick,
}: {
  label: string
  sel: boolean
  disabled?: boolean
  onHover: () => void
  onClick: () => void
}) {
  // Scramble in on first show, and again each time the item gets selected.
  const [run, setRun] = useState(1)
  const was = useRef(sel)
  useEffect(() => {
    if (sel && !was.current) setRun((r) => r + 1)
    was.current = sel
  }, [sel])
  const text = useScramble(label, run)
  return (
    <button
      type="button"
      className={'start__item' + (sel ? ' is-sel' : '') + (disabled ? ' is-off' : '')}
      aria-disabled={disabled}
      onMouseEnter={onHover}
      onFocus={onHover}
      onClick={onClick}
    >
      <span className="start__mark" aria-hidden>
        ▸
      </span>
      <span aria-label={label}>{text}</span>
    </button>
  )
}

function ProjectsModal({ onClose }: { onClose: () => void }) {
  const title = useScramble('Other projects', 1)
  return (
    <div className="pmodal" onClick={onClose}>
      <div className="pmodal__panel" role="dialog" aria-label="Other projects" onClick={(e) => e.stopPropagation()}>
        <span className="pmodal__plus" style={{ left: 0, top: 0 }}>+</span>
        <span className="pmodal__plus" style={{ left: '100%', top: 0 }}>+</span>
        <span className="pmodal__plus" style={{ left: 0, top: '100%' }}>+</span>
        <span className="pmodal__plus" style={{ left: '100%', top: '100%' }}>+</span>
        <div className="pmodal__scan" aria-hidden />

        <header className="pmodal__head">
          <span className="pmodal__meta">// DIR.PROJECTS</span>
          <button type="button" className="pmodal__close" onClick={onClose}>
            ESC ✕
          </button>
        </header>
        <h2 className="pmodal__title">{title}</h2>

        <ul className="pmodal__list">
          {PROJECTS.map((p) => (
            <li key={p.id}>
              <a className="pmodal__card" href={p.url} target="_blank" rel="noopener noreferrer">
                <span className="pmodal__row">
                  <span className="pmodal__name">{p.name}</span>
                  <span className="pmodal__status">
                    <i /> {p.status}
                  </span>
                </span>
                <span className="pmodal__blurb">{p.blurb}</span>
                <span className="pmodal__host">{p.host} ↗</span>
              </a>
            </li>
          ))}
        </ul>
        <footer className="pmodal__foot">
          <span>{String(PROJECTS.length).padStart(2, '0')} ENTRIES</span>
          <span>MORE SOON_</span>
        </footer>
      </div>
    </div>
  )
}
