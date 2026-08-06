import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { PLAYER } from '../config/constants'
import { COLLIDERS } from '../config/town'
import { resolveCollisions } from '../systems/collision'
import { useGame } from '../state/store'
import { Figure, type CharAnim } from './Figure'

/**
 * The player character controller. The coral figure is a placeholder; the
 * controller is the real thing and is what must never be deferred (brief).
 *
 * Free analog movement, screen-relative to the fixed camera (the camera has no
 * yaw, so up-screen = world -Z), circle collision + world boundary, rotates to
 * face travel direction, and drives an idle/walk state via `anim` — the seam a
 * rigged glTF plugs into later with zero controller changes.
 */
export function Player({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null!)
  const yaw = useRef(Math.PI) // start facing the camera, like the prototype
  const anim = useRef<CharAnim>({ moving: false, phase: 0 })
  const [, getKeys] = useKeyboardControls()

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()
    const canMove = st.started && !st.dialogue && !st.section

    let mx = 0
    let mz = 0
    if (canMove) {
      const { forward, back, left, right } = getKeys()
      // screen-relative: forward = -Z (up-screen), right = +X
      if (forward) mz -= 1
      if (back) mz += 1
      if (left) mx -= 1
      if (right) mx += 1
    }

    const moving = mx !== 0 || mz !== 0
    if (moving) {
      const len = Math.hypot(mx, mz)
      mx /= len
      mz /= len
      posRef.current.x += mx * PLAYER.speed * dt
      posRef.current.z += mz * PLAYER.speed * dt
      resolveCollisions(posRef.current, COLLIDERS)

      const targetYaw = Math.atan2(mx, mz)
      let d = ((targetYaw - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
      if (d < -Math.PI) d += Math.PI * 2
      yaw.current += d * Math.min(1, dt * 12)
      anim.current.phase += dt * 11
    } else {
      anim.current.phase *= 0.85
    }
    anim.current.moving = moving

    group.current.position.set(posRef.current.x, 0, posRef.current.z)
    group.current.rotation.y = yaw.current
  })

  return (
    <group ref={group}>
      <Figure color={0xe4633c} anim={anim} />
    </group>
  )
}
