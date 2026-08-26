import { useRef } from 'react'
import { useGame } from '../state/store'
import { arcadeMove } from '../systems/input'

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

function DPad() {
  const hold = useRef<'x' | 'z' | null>(null)
  const set = (x: number, z: number, axis: 'x' | 'z') => {
    hold.current = axis
    arcadeMove.x = x
    arcadeMove.z = z
  }
  const clear = () => {
    hold.current = null
    arcadeMove.x = 0
    arcadeMove.z = 0
  }
  const btn = (label: string, x: number, z: number, axis: 'x' | 'z', extra: string) => (
    <button
      type="button"
      className={'pacman-hud__pad-btn ' + extra}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId)
        set(x, z, axis)
      }}
      onPointerUp={clear}
      onPointerCancel={clear}
    />
  )
  return (
    <div className="pacman-hud__pad" aria-hidden>
      {btn('Up', 0, -1, 'z', 'is-up')}
      {btn('Left', -1, 0, 'x', 'is-left')}
      {btn('Right', 1, 0, 'x', 'is-right')}
      {btn('Down', 0, 1, 'z', 'is-down')}
    </div>
  )
}

function SwipeLayer() {
  const start = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      className="pacman-hud__swipe"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        const s = start.current
        start.current = null
        if (!s) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        if (Math.hypot(dx, dy) < 28) return
        if (Math.abs(dx) > Math.abs(dy)) {
          arcadeMove.x = dx > 0 ? 1 : -1
          arcadeMove.z = 0
        } else {
          arcadeMove.x = 0
          arcadeMove.z = dy > 0 ? 1 : -1
        }
        window.setTimeout(() => {
          arcadeMove.x = 0
          arcadeMove.z = 0
        }, 180)
      }}
    />
  )
}

/** Score, lives, pause/win/lose, and touch D-pad + swipe for Pac-Man. */
export function PacmanHud() {
  const arcade = useGame((s) => s.arcade)
  const setPaused = useGame((s) => s.setArcadePaused)
  const leave = () => useGame.getState().requestMinigame(null)
  if (!arcade) return null

  const overlay =
    arcade.paused || arcade.status === 'won' || arcade.status === 'lost'
      ? arcade.status === 'won'
        ? 'You win'
        : arcade.status === 'lost'
          ? 'Game over'
          : 'Paused'
      : null

  return (
    <div className="pacman-hud">
      {isTouch && <SwipeLayer />}
      <div className="pacman-hud__bar">
        <span className="pacman-hud__score">Score {arcade.score}</span>
        <span className="pacman-hud__lives">Lives {arcade.lives}</span>
        <button
          className="pacman-hud__esc"
          type="button"
          onClick={() => (arcade.paused ? setPaused(false) : setPaused(true))}
        >
          {arcade.paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      {isTouch && arcade.status === 'play' && !arcade.paused && <DPad />}
      {overlay && (
        <div className="pacman-hud__modal">
          <div className="pacman-hud__panel">
            <h2>{overlay}</h2>
            {arcade.status === 'play' && arcade.paused && (
              <button className="gselect__select" type="button" onClick={() => setPaused(false)}>
                Resume
              </button>
            )}
            <button className="gselect__exit" type="button" onClick={leave}>
              Back to cafe
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
