import { useEffect, useRef } from 'react'
import { forestTouch } from '../systems/input'
import { useGame } from '../state/store'
import { SOUTH_TRAIL } from '../config/forest'
import { useForestOpening } from '../state/forestOpening'

/** A swipe this far up (px) jumps. */
const SWIPE = 36

/**
 * Forest walk on a phone: hold the left or right half of the screen to walk
 * that way, swipe up to jump, swipe down to crouch (and again to stand); the
 * latest finger down wins. Plus a small "Town"
 * chip that asks to go back (phones have no Esc).
 */
export function ForestTouch() {
  const doubleJump = useForestOpening((s) => s.doubleJump)
  const fingers = useRef(new Map<number, { x: number; y: number; jumped: boolean }>())

  const sideOf = (x: number) => (x < window.innerWidth / 2 ? -1 : 1)
  const refresh = () => {
    let last: number | undefined
    for (const f of fingers.current.values()) last = sideOf(f.x)
    forestTouch.dir = last ?? 0
  }

  useEffect(
    () => () => {
      forestTouch.dir = 0
      forestTouch.jump = false
      forestTouch.crouch = false
      fingers.current.clear()
    },
    [],
  )

  return (
    <>
      <div
        className="forest-touch"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, jumped: false })
          refresh()
        }}
        onPointerMove={(e) => {
          const f = fingers.current.get(e.pointerId)
          if (!f) return
          // Re-arm after a downward reset so the same finger can swipe up
          // again in mid-air. A second finger can also use the Jump button.
          if (f.jumped && e.clientY > f.y + SWIPE / 2) {
            f.y = e.clientY
            f.jumped = false
          }
          if (!f.jumped && f.y - e.clientY > SWIPE) {
            f.jumped = true
            f.y = e.clientY
            forestTouch.jump = true
            forestTouch.crouch = false
          } else if (!f.jumped && e.clientY - f.y > SWIPE) {
            f.jumped = true
            forestTouch.crouch = !forestTouch.crouch
          }
        }}
        onPointerUp={(e) => {
          fingers.current.delete(e.pointerId)
          refresh()
        }}
        onPointerCancel={(e) => {
          fingers.current.delete(e.pointerId)
          refresh()
        }}
        onLostPointerCapture={(e) => {
          fingers.current.delete(e.pointerId)
          refresh()
        }}
      />
      {doubleJump && (
        <button className="forest-jump" aria-label="Jump; press again in mid-air to double jump"
          onPointerDown={(e) => { e.preventDefault(); forestTouch.jump = true }}
          onClick={(e) => { if (e.detail === 0) forestTouch.jump = true }}>
          <span>↑</span> Jump
        </button>
      )}
      <button
        className="forest-back"
        onClick={() => useGame.setState({ dialogue: SOUTH_TRAIL.leave, line: 0 })}
      >
        ‹ Town
      </button>
    </>
  )
}
