import { useEffect, useRef, useState } from 'react'
import { useGame } from '../state/store'
import { useTurntable } from '../state/turntable'
import { RECORDS } from '../config/turntable'
import { playWorldSfx } from './worldSfx'

/**
 * The home turntable's record crate (E on the console): a picture disc on the
 * left printed with the highlighted record's trip photo, the crate on the
 * right. ↑/↓ browse, Enter plays (the disc spins), X lifts the needle, Esc
 * (Hud) closes and the music keeps playing.
 */
export function RecordsModal() {
  const close = useGame((s) => s.closeRecords)
  const playing = useTurntable((s) => s.playing)
  const [sel, setSel] = useState(playing ?? 0)
  const cur = RECORDS[sel]!
  const spinning = playing === sel
  const lastPointer = useRef('mouse')

  const select = (i: number) => {
    const n = (i + RECORDS.length) % RECORDS.length
    if (n !== sel) playWorldSfx('hover')
    setSel(n)
  }
  const toggle = (i: number) => {
    const t = useTurntable.getState()
    if (t.playing === i) t.stop()
    else t.play(i)
  }

  // The crate follows the record player when a track ends and the next drops.
  useEffect(() => {
    if (playing !== null) setSel(playing)
  }, [playing])

  const keys = useRef({ sel, select, toggle })
  keys.current = { sel, select, toggle }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { sel, select, toggle } = keys.current
      if (e.code === 'ArrowDown' || e.code === 'KeyS') select(sel + 1)
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') select(sel - 1)
      else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') toggle(sel)
      else if (e.code === 'KeyX') useTurntable.getState().stop()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="rec" role="dialog" aria-label="Records" onClick={close}>
      <div className="rec__panel" onClick={(e) => e.stopPropagation()}>
        <div className="rec__scan" aria-hidden />
        <div className="rec__head">
          <span className="rec__meta">
            {playing !== null ? `NOW PLAYING · ${String(playing + 1).padStart(2, '0')}` : 'NEEDLE UP'}
          </span>
          <button type="button" className="rec__close" onClick={close}>
            ESC
          </button>
        </div>

        <div className="rec__body">
          <div className="rec__deck">
            <div className={'rec__disc' + (spinning ? ' is-spinning' : '')} key={cur.id}>
              <img src={cur.cover} alt="" draggable={false} />
              <i className="rec__grooves" />
              <i className="rec__hole" />
            </div>
            <div className="rec__now">
              <div className="rec__title">{cur.title}</div>
            </div>
          </div>

          <ol className="rec__list">
            {RECORDS.map((r, i) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={'rec__item' + (i === sel ? ' is-sel' : '') + (i === playing ? ' is-playing' : '')}
                  onPointerDown={(e) => (lastPointer.current = e.pointerType)}
                  onMouseEnter={() => {
                    if (lastPointer.current === 'mouse') select(i)
                  }}
                  onClick={() => {
                    // Touch: first tap previews the disc, second plays.
                    if (lastPointer.current !== 'mouse' && i !== sel) select(i)
                    else toggle(i)
                  }}
                >
                  <span className="rec__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="rec__name">{r.title}</span>
                  {i === playing ? (
                    <span className="rec__eq" aria-label="playing">
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <span className="rec__go">▶</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="rec__foot">
          <span className="rec__hint">
            <kbd>↑</kbd>
            <kbd>↓</kbd> Browse · <kbd>Enter</kbd> Play
          </span>
          <button
            type="button"
            className="rec__off"
            disabled={playing === null}
            onClick={() => useTurntable.getState().stop()}
          >
            <kbd>X</kbd> Music off
          </button>
        </div>
      </div>
    </div>
  )
}
