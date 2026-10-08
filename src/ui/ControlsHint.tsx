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
 * Town controls, taught one at a time as a hologram callout (keys → leader line
 * → boxed label, like the personal site's About annotations). Move shows first
 * (WASD glitching to arrows and back, since both work); once he walks, Jump.
 * E needs no step: the interact prompt appears on its own near a door or face.
 */
export function ControlsHint() {
  const [step, setStep] = useState<Step>('move')
  const busy = useGame(
    (s) => !!(s.forest || s.dialogue || s.ride || s.minigame || s.siteOpen || s.worldOpen || s.gamesOpen || s.section),
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
  const text = useScramble(label.toUpperCase(), 1)
  return (
    <span className="chint__callout">
      {keys}
      <svg className="chint__leader" width="58" height="34" viewBox="0 0 58 34" aria-hidden>
        <circle cx="5" cy="26" r="3.5" />
        <path d="M5 26 L21 10 L58 10" />
      </svg>
      <span className="chint__label" aria-label={label}>
        {text}
      </span>
    </span>
  )
}
