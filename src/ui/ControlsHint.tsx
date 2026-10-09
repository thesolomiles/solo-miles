import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useGame } from '../state/store'
import { useScramble } from './PersonalSite'

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

const WASD = ['W', 'A', 'S', 'D']
const ARROWS = ['↑', '←', '↓', '→']
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>_+#'
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

type Step = 'move' | 'jump' | 'done'

/**
 * Town controls, taught one at a time: hologram keycaps with a mono "TO MOVE"
 * line underneath. Move shows first
 * (WASD glitching to arrows and back, since both work); once he walks, Jump.
 * E needs no step: the interact prompt appears on its own near a door or face.
 */
export function ControlsHint() {
  const [step, setStep] = useState<Step>('move')
  const busy = useGame(
    (s) => !!(s.forest || s.dialogue || s.ride || s.minigame || s.siteOpen || s.recordsOpen || s.worldOpen || s.gamesOpen || s.section),
  )

  useEffect(() => {
    if (step === 'done') return
    let next: number | undefined
    const advance = (to: Step, delay: number) => {
      if (next === undefined) next = window.setTimeout(() => setStep(to), delay)
    }
    // Fall back on a timer so the hint never sticks around.
    const fallback = window.setTimeout(() => setStep(step === 'move' ? 'jump' : 'done'), step === 'move' ? 12000 : 8000)
    const onKey = (e: KeyboardEvent) => {
      if (step === 'move' && MOVE_KEYS.has(e.code)) advance('jump', 1600)
      if (step === 'jump' && e.code === 'Space') advance('done', 500)
    }
    const onPointer = (e: PointerEvent) => {
      if (step === 'move' && (e.target as HTMLElement)?.tagName === 'CANVAS') advance(isTouch ? 'done' : 'jump', 1600)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.clearTimeout(fallback)
      window.clearTimeout(next)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [step])

  const show = step !== 'done' && !busy
  return (
    <div className={'chint' + (show ? ' chint--show' : '')} aria-live="polite">
      {step === 'move' && (isTouch ? <Callout keys={<Key wide>TAP</Key>} label="Move" /> : <MoveCallout />)}
      {step === 'jump' && <Callout keys={<Key wide>SPACE</Key>} label="Jump" />}
    </div>
  )
}

/** A row of keycap callouts shown together, fading after `ms`. */
function HintRow({ ms, children }: { ms: number; children: ReactNode }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), ms)
    return () => window.clearTimeout(t)
  }, [ms])
  return (
    <div className={'chint chint--row' + (show ? ' chint--show' : '')} aria-live="polite">
      {children}
    </div>
  )
}

const ArrowPair = ({ a, b }: { a: string; b: string }) => (
  <span className="chint__pair">
    <Key>{a}</Key>
    <Key>{b}</Key>
  </span>
)

/** The forest walk's controls, all at once, shown for a few seconds on arriving. */
export function ForestControlsHint() {
  return (
    <HintRow ms={6000}>
      {isTouch ? (
        <>
          <Callout keys={<Key wide>HOLD ◀ ▶</Key>} label="Walk / run" />
          <Callout keys={<Key wide>SWIPE ↑</Key>} label="Jump" />
        </>
      ) : (
        <>
          <Callout keys={<ArrowPair a="←" b="→" />} label="Walk / run" />
          <Callout keys={<Key wide>SPACE</Key>} label="Jump" />
          <Callout keys={<Key wide>ESC</Key>} label="Town" />
        </>
      )}
    </HintRow>
  )
}

/** Ninja Run's controls for the first few seconds of a run. */
export function NinjaControlsHint() {
  return (
    <HintRow ms={4500}>
      {isTouch ? (
        <>
          <Callout keys={<Key wide>TAP</Key>} label="Jump" />
          <Callout keys={<Key wide>✦</Key>} label="Throw" />
        </>
      ) : (
        <>
          <Callout keys={<Key wide>SPACE</Key>} label="Jump" />
          <Callout keys={<Key>E</Key>} label="Throw" />
        </>
      )}
    </HintRow>
  )
}

/** WASD ⇄ arrows: holds one set, glitches briefly, lands on the other. */
function MoveCallout() {
  const [arrows, setArrows] = useState(false)
  const [glitch, setGlitch] = useState<string[] | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const flip = window.setInterval(() => {
      let f = 0
      timer.current = window.setInterval(() => {
        f++
        setGlitch(WASD.map(() => GLYPHS[(Math.random() * GLYPHS.length) | 0]))
        if (f >= 7) {
          window.clearInterval(timer.current)
          setGlitch(null)
          setArrows((a) => !a)
        }
      }, 40)
    }, 2400)
    return () => {
      window.clearInterval(flip)
      window.clearInterval(timer.current)
    }
  }, [])
  const keys = glitch ?? (arrows ? ARROWS : WASD)
  return (
    <Callout
      keys={
        <span className={'chint__pad' + (glitch ? ' is-glitch' : '')}>
          <span />
          <Key>{keys[0]}</Key>
          <span />
          <Key>{keys[1]}</Key>
          <Key>{keys[2]}</Key>
          <Key>{keys[3]}</Key>
        </span>
      }
      label="Move"
    />
  )
}

function Key({ children, wide }: { children: string; wide?: boolean }) {
  return <span className={'chint__key' + (wide ? ' chint__key--wide' : '')}>{children}</span>
}

function Callout({ keys, label }: { keys: ReactNode; label: string }) {
  const text = useScramble(`TO ${label.toUpperCase()}`, 1)
  return (
    <span className="chint__callout">
      {keys}
      <span className="chint__label" aria-label={`To ${label.toLowerCase()}`}>
        {text}
      </span>
    </span>
  )
}
