import { useEffect, useRef, useState } from 'react'
import { touchMove } from '../systems/input'

const RADIUS = 52 // px the knob can travel from centre

/**
 * On-screen movement stick for touch devices — the only way to move without a
 * keyboard. It writes the shared `touchMove` vector the player controller reads
 * each frame, so touch and keyboard drive the exact same movement (and the same
 * walk-then-run behaviour). Rendered only on coarse-pointer devices.
 */
export function TouchControls() {
  const base = useRef<HTMLDivElement>(null!)
  const centre = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const [knob, setKnob] = useState({ x: 0, y: 0 })

  useEffect(() => () => { touchMove.x = 0; touchMove.z = 0 }, [])

  const set = (clientX: number, clientY: number) => {
    let dx = clientX - centre.current.x
    let dy = clientY - centre.current.y
    const len = Math.hypot(dx, dy)
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS }
    setKnob({ x: dx, y: dy })
    touchMove.x = dx / RADIUS
    touchMove.z = dy / RADIUS // down (+) = back, up (−) = forward
  }

  const start = (e: React.PointerEvent) => {
    const r = base.current.getBoundingClientRect()
    centre.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    dragging.current = true
    base.current.setPointerCapture(e.pointerId)
    set(e.clientX, e.clientY)
  }
  const move = (e: React.PointerEvent) => {
    if (dragging.current) set(e.clientX, e.clientY)
  }
  const end = () => {
    dragging.current = false
    setKnob({ x: 0, y: 0 })
    touchMove.x = 0
    touchMove.z = 0
  }

  return (
    <div
      ref={base}
      className="stick"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-hidden
    >
      <div className="stick__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  )
}
