import { useEffect, useState } from 'react'
import { useGame } from '../state/store'
import { isTypingTarget, ninjaInput } from '../systems/input'
import { NINJA_RUN } from '../config/arcade'

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/**
 * Ninja Run HUD: distance score + best, pause, the game-over panel (Retry /
 * Back to café), and the controls — Space / ↑ / W jump, E throws. On touch, tap
 * anywhere to jump and the round button throws. Esc (Hud) pauses / leaves.
 */
export function NinjaRunHud() {
  const arcade = useGame((s) => s.arcade)
  const setPaused = useGame((s) => s.setArcadePaused)
  const leave = () => useGame.getState().requestMinigame(null)
  const retry = () => useGame.getState().retryArcade()
  // The controls hint fades after the first few seconds of a run.
  const [hint, setHint] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 4500)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.repeat) return
      const st = useGame.getState()
      const a = st.arcade
      if (!a || st.transition) return
      if (a.status === 'lost') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          st.retryArcade()
        }
        return
      }
      if (a.paused) return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault()
        ninjaInput.jump = true
      } else if (e.code === 'KeyE' || e.code === 'KeyF') {
        e.preventDefault()
        ninjaInput.throw = true
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!arcade) return null
  const lost = arcade.status === 'lost'
  const newBest = lost && arcade.score > 0 && arcade.score >= (arcade.best ?? 0)

  return (
    <div className="pacman-hud ninja-hud">
      {isTouch && !lost && !arcade.paused && (
        <div
          className="pacman-hud__swipe"
          onPointerDown={(e) => {
            e.preventDefault()
            ninjaInput.jump = true
          }}
        />
      )}
      <div className="pacman-hud__bar">
        <span className="ahud-stat">
          <span className="ahud-stat__k">Distance</span>
          <span className="ahud-stat__v">
            {arcade.score}
            <small>m</small>
          </span>
        </span>
        <span className="ahud-stat">
          <span className="ahud-stat__k">Best</span>
          <span className="ahud-stat__v">
            {arcade.best ?? 0}
            <small>m</small>
          </span>
        </span>
        <span className="ahud-stat">
          <span className="ahud-stat__k">Shuriken</span>
          <span className="ninja-hud__ammo" aria-label={`${arcade.ammo ?? 0} shuriken`}>
            {Array.from({ length: NINJA_RUN.shurikenMax }, (_, i) => (
              <span key={i} className={i < (arcade.ammo ?? 0) ? 'is-full' : ''}>
                ✦
              </span>
            ))}
          </span>
        </span>
        <button className="pacman-hud__esc" type="button" onClick={() => setPaused(!arcade.paused)}>
          {!isTouch && <kbd>Esc</kbd>}
          {arcade.paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      {hint && !lost && (
        <div className="ninja-hud__hint">
          {isTouch ? (
            <>
              Tap to jump <i>·</i> ✦ to throw
            </>
          ) : (
            <>
              <kbd>Space</kbd> Jump <i>·</i> <kbd>E</kbd> Shuriken
            </>
          )}
        </div>
      )}
      {isTouch && !lost && !arcade.paused && (
        <button
          type="button"
          className="ninja-hud__throw"
          aria-label="Throw shuriken"
          onPointerDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            ninjaInput.throw = true
          }}
        >
          ✦
        </button>
      )}
      {(arcade.paused || lost) && (
        <div className="pacman-hud__modal">
          <div className="pacman-hud__panel">
            <span className="ahud-tag">Ninja Run</span>
            <h2>{lost ? 'Game over' : 'Paused'}</h2>
            {lost && (
              <div className="ninja-hud__result">
                <span className="ahud-stat">
                  <span className="ahud-stat__k">Distance</span>
                  <span className={`ahud-stat__v${newBest ? ' is-new' : ''}`}>
                    {arcade.score}
                    <small>m</small>
                  </span>
                </span>
                <span className="ahud-stat">
                  <span className="ahud-stat__k">{newBest ? 'New best!' : 'Best'}</span>
                  <span className="ahud-stat__v">
                    {arcade.best ?? 0}
                    <small>m</small>
                  </span>
                </span>
              </div>
            )}
            <div className="ahud-actions">
              {lost ? (
                <button className="ahud-btn ahud-btn--primary" type="button" onClick={retry}>
                  {!isTouch && <kbd>Space</kbd>}
                  Retry
                </button>
              ) : (
                <button className="ahud-btn ahud-btn--primary" type="button" onClick={() => setPaused(false)}>
                  {!isTouch && <kbd>Esc</kbd>}
                  Resume
                </button>
              )}
              <button className="ahud-btn" type="button" onClick={leave}>
                {lost && !isTouch && <kbd>Esc</kbd>}
                Back to café
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
