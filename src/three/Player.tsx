import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { PLAYER } from '../config/constants'
import { TRAIL } from '../config/town'
import { getActiveWorld } from '../systems/activeWorld'
import { resolveCollisions } from '../systems/collision'
import { touchMove, isTypingTarget } from '../systems/input'
import { useGame } from '../state/store'
import { type CharAnim } from './Figure'
import { RiggedFigure } from './RiggedFigure'

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
  const yaw = useRef(0) // start facing the camera (model front is +Z)
  const anim = useRef<CharAnim>({
    moving: false, phase: 0, speed: 0, gait: 'idle',
    jumpSeq: 0, jumpKind: 'jump', jumping: false,
  })
  const moveTime = useRef(0) // seconds of continuous movement (drives walk → run)
  const speed = useRef(PLAYER.speed) // current pace, ramped between walk and run
  const jumpHeld = useRef(false) // edge-detect the jump key so a hold = one jump
  const [, getKeys] = useKeyboardControls()

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()

    // After the chat, Leonard sends us back down toward town. Glide there under
    // our own steam (input locked) rather than snapping — a teleport is jarring.
    if (st.sendBack) {
      const dx = TRAIL.returnPos.x - posRef.current.x
      const dz = TRAIL.returnPos.z - posRef.current.z
      const dd = Math.hypot(dx, dz)
      if (dd > 0.12) {
        const step = Math.min(dd, PLAYER.speed * dt)
        posRef.current.x += (dx / dd) * step
        posRef.current.z += (dz / dd) * step
        const targetYaw = Math.atan2(dx, dz)
        let d = ((targetYaw - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
        if (d < -Math.PI) d += Math.PI * 2
        yaw.current += d * Math.min(1, dt * 12)
        anim.current.moving = true
        anim.current.speed = PLAYER.speed
        anim.current.gait = 'walk'
        anim.current.phase += dt * 11
      } else {
        posRef.current.set(TRAIL.returnPos.x, 0, TRAIL.returnPos.z)
        yaw.current = 0 // settle facing town/camera (model front is +Z)
        anim.current.moving = false
        anim.current.speed = 0
        anim.current.gait = 'idle'
        useGame.getState().clearSendBack()
      }
      group.current.position.set(posRef.current.x, 0, posRef.current.z)
      group.current.rotation.y = yaw.current
      return // input is locked while we ride back
    }

    // Also freeze keyboard movement while a dev panel's text field is focused —
    // drei's KeyboardControls listens on window, so WASD would otherwise walk the
    // player around as you type a zone's name.
    const typing = typeof document !== 'undefined' && isTypingTarget(document.activeElement)
    const canMove =
      st.started &&
      !st.dialogue &&
      !st.section &&
      !st.ridesOpen &&
      !st.gamesOpen &&
      !st.minigame &&
      !st.transition &&
      !typing

    const { forward, back, left, right, jump } = getKeys()
    let mx = 0
    let mz = 0
    if (canMove) {
      // screen-relative: forward = -Z (up-screen), right = +X
      if (forward) mz -= 1
      if (back) mz += 1
      if (left) mx -= 1
      if (right) mx += 1
      // touch stick (mobile) feeds the same screen-relative vector
      mx += touchMove.x
      mz += touchMove.z
    }

    const moving = Math.hypot(mx, mz) > 0.001
    if (moving) {
      // Break into a run after a few seconds of continuous walking; ramp the
      // pace so it accelerates smoothly rather than snapping.
      moveTime.current += dt
      const ninja = moveTime.current >= PLAYER.ninjaAfter
      const running = moveTime.current >= PLAYER.runAfter
      const target = ninja ? PLAYER.ninjaSpeed : running ? PLAYER.runSpeed : PLAYER.speed
      speed.current += (target - speed.current) * Math.min(1, dt * PLAYER.runAccel)

      const len = Math.hypot(mx, mz)
      mx /= len
      mz /= len
      posRef.current.x += mx * speed.current * dt
      posRef.current.z += mz * speed.current * dt

      const targetYaw = Math.atan2(mx, mz)
      let d = ((targetYaw - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
      if (d < -Math.PI) d += Math.PI * 2
      yaw.current += d * Math.min(1, dt * 12)
      anim.current.phase += dt * 11
      anim.current.gait = ninja ? 'ninja-run' : running ? 'run' : 'walk'
      anim.current.speed = speed.current
    } else {
      moveTime.current = 0
      speed.current = PLAYER.speed // next departure starts as a walk
      anim.current.phase *= 0.85
      anim.current.gait = 'idle'
      anim.current.speed = 0
    }
    anim.current.moving = moving

    // Spacebar jump, fired once per press (a hold won't repeat). A moving player
    // leaps with momentum (jump-run); a standing one hops in place (jump).
    // Suppressed while a jump already plays, or near an interactable / in a
    // dialogue — there Space is the interact key (handled by the HUD instead).
    if (jump && !jumpHeld.current) {
      jumpHeld.current = true
      if (canMove && !st.near && !anim.current.jumping) {
        anim.current.jumpKind = moving ? 'jump-run' : 'jump'
        anim.current.jumpSeq++
      }
    } else if (!jump) {
      jumpHeld.current = false
    }

    // Resolve against the ACTIVE world's colliders + boundary — the town
    // (buildings/trees/river banks + square edge) or the café interior (its
    // counter/arcades + room bounds). See systems/activeWorld + collision.ts.
    const world = getActiveWorld()
    resolveCollisions(posRef.current, world.colliders, world.boundary)

    group.current.position.set(posRef.current.x, 0, posRef.current.z)
    group.current.rotation.y = yaw.current
  })

  return (
    <group ref={group}>
      <RiggedFigure anim={anim} />
    </group>
  )
}
