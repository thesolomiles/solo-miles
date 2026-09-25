import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { pointMove, cancelPointMove } from '../systems/input'
import { useGame } from '../state/store'

// The dev editors (?edit / ?zones / ?talk) drag boxes and circles on the canvas
// with r3f pointer events — a canvas tap must not also walk the player there.
const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined
const EDITING =
  import.meta.env.DEV && !!(params?.has('edit') || params?.has('zones') || params?.has('talk'))

/** Amber — the key sun's colour, so the marker sits in the golden-hour light. */
const MARKER_COLOR = '#ffb066'

const _ray = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _hit = new THREE.Vector3()
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // everything walks on y=0

/** Same gate as the player controller's `canMove` (minus the keyboard focus bit). */
function canPoint(): boolean {
  const st = useGame.getState()
  return (
    st.started && !st.sendBack && !st.dialogue && !st.section && !st.worldOpen &&
    !st.gamesOpen && !st.minigame && !st.ride && !st.transition
  )
}

/**
 * Dota-style point-and-go: click / tap the ground and the player walks there;
 * keep the finger (or mouse button) down and drag, and the target follows it —
 * steering without an on-screen stick. Writes `pointMove`, which the Player
 * controller consumes. The HUD layer is pointer-events:none, so only taps that
 * miss every button/prompt reach the canvas.
 *
 * Also draws the destination marker: an amber ripple that spreads out on each
 * press (`seq` bump) and keeps softly pulsing until the player arrives.
 */
export function PointToMove() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    if (EDITING) return
    const el = gl.domElement
    let pointerId: number | null = null

    const aim = (e: PointerEvent): boolean => {
      const r = el.getBoundingClientRect()
      _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      _ray.setFromCamera(_ndc, camera)
      if (!_ray.ray.intersectPlane(GROUND, _hit)) return false
      pointMove.x = _hit.x
      pointMove.z = _hit.z
      return true
    }
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0 || !canPoint()) return
      if (!aim(e)) return
      pointerId = e.pointerId
      pointMove.active = true
      pointMove.held = true
      pointMove.seq++
    }
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId || !pointMove.held) return
      if (!canPoint()) return release(e)
      aim(e)
      pointMove.active = true // re-arm if we'd already arrived while held
    }
    const release = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      pointMove.held = false
    }

    // A long press on the canvas is a steer, not a request for the context menu.
    const noMenu = (e: Event) => e.preventDefault()

    el.addEventListener('pointerdown', down)
    el.addEventListener('contextmenu', noMenu)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', release)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('contextmenu', noMenu)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', release)
      cancelPointMove()
    }
  }, [gl, camera])

  if (EDITING) return null
  return <RippleMarker color={MARKER_COLOR} />
}

// Flat markers float just above the highest ground layer — the town road's
// tarmac (y 0.05) and its painted lines (0.065) — or the road hides them.
const Y = 0.09
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
/** Chase `to` at a rate — frame-rate independent enough for a fade. */
const toward = (v: number, to: number, rate: number, dt: number) => v + (to - v) * Math.min(1, dt * rate)

/** Seconds since the last press; resets whenever `pointMove.seq` bumps. */
function usePressClock() {
  const age = useRef(99)
  const seq = useRef(pointMove.seq)
  return (dt: number) => {
    if (pointMove.seq !== seq.current) {
      seq.current = pointMove.seq
      age.current = 0
    }
    age.current += dt
    return age.current
  }
}

function FlatMat({ color, matRef }: { color: string; matRef?: RefObject<THREE.MeshBasicMaterial | null> }) {
  return (
    <meshBasicMaterial
      ref={matRef}
      color={color}
      transparent
      opacity={0}
      depthWrite={false}
      fog={false}
      toneMapped={false}
    />
  )
}

// --- Ripple marker ---------------------------------------------------------
// Two thin rings spread out one after the other like a raindrop in a puddle,
// then a softer ripple keeps pulsing while the target is live.

function RippleMarker({ color }: { color: string }) {
  const root = useRef<THREE.Group>(null!)
  const rings = [useRef<THREE.Mesh>(null!), useRef<THREE.Mesh>(null!)]
  const mats = [useRef<THREE.MeshBasicMaterial>(null), useRef<THREE.MeshBasicMaterial>(null)]
  const dotMat = useRef<THREE.MeshBasicMaterial>(null)
  const live = useRef(0) // 0…1, eases toward "target is live"
  const clock = usePressClock()

  useFrame((_, dt) => {
    const t = clock(dt)
    root.current.position.set(pointMove.x, Y, pointMove.z)
    live.current = toward(live.current, pointMove.active ? 1 : 0, pointMove.active ? 20 : 5, dt)
    for (let i = 0; i < 2; i++) {
      let p: number
      let peak: number
      if (t < 0.9) {
        p = clamp01((t - i * 0.16) / 0.7) // the press burst
        peak = 0.95
      } else {
        p = (((t - 0.9 + i * 0.6) % 1.2) / 1.2) // idle pulse while walking
        peak = 0.45 * live.current
      }
      rings[i].current.scale.setScalar(0.15 + 0.85 * easeOut(p))
      mats[i].current!.opacity = p <= 0 ? 0 : Math.pow(1 - p, 1.4) * peak
    }
    dotMat.current!.opacity = 0.85 * live.current
    root.current.visible = live.current > 0.01 || t < 0.9
  })

  return (
    <group ref={root} rotation-x={-Math.PI / 2} renderOrder={5}>
      {[0, 1].map((i) => (
        <mesh key={i} ref={rings[i]}>
          <ringGeometry args={[0.66, 0.72, 48]} />
          <FlatMat color={color} matRef={mats[i]} />
        </mesh>
      ))}
      <mesh>
        <circleGeometry args={[0.07, 20]} />
        <FlatMat color={color} matRef={dotMat} />
      </mesh>
    </group>
  )
}
