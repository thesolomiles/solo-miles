import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { ACTORS } from '../../config/town'
import { useRegisterInteractable } from '../../systems/interactables'
import { useGame } from '../../state/store'
import { useCyclistModel, CYCLIST_SCALE } from '../cyclist'
import { useAlertTexture } from '../alertTexture'

const R = ACTORS.rider

/** Fraction of the pedal loop to freeze on so the parked stance reads naturally
 *  (feet on the pedals, cranks near level — "stopped", not caught mid-stroke). */
const PARKED_POSE = 0.0

/**
 * Leonard sat on his bike, parked. Loads the shared cyclist (cyclist.glb) in his
 * default blue/white kit and plays the baked `cycle` clip but holds it paused on
 * one frame — so he's on the bike, not pedalling (wheels still, legs planted).
 */
function ParkedCyclist() {
  const { model, animations } = useCyclistModel()
  const root = useRef<THREE.Group>(null!)
  const { actions } = useAnimations(animations, root)

  useEffect(() => {
    const a = actions['cycle']
    if (!a) return
    a.reset()
    a.play()
    a.time = PARKED_POSE * a.getClip().duration
    a.paused = true // freeze on this frame — parked, not pedalling
  }, [actions])

  // Faces south (+Z, toward town): the glTF model's forward is −Z at yaw 0, so π
  // turns it to face the town (same as the ride riders' base heading).
  return (
    <group ref={root} rotation={[0, Math.PI, 0]} scale={CYCLIST_SCALE}>
      <primitive object={model} />
    </group>
  )
}

/**
 * Cycling Leonard — parked on his road bike near the end of the road (mid-road,
 * just before the forest), facing south toward town. He sits on the bike but
 * isn't pedalling (see ParkedCyclist), the same kitted model the ride riders use.
 *
 * When the visitor gets close a "!" pops above his head and the E-prompt lights
 * up; pressing E opens his "wanna join me?" question (see the store / Hud choice
 * handling: Yes → world selector, No → glide back toward town). He's a normal
 * registered interactable — the proximity system finds him like any door.
 */
export function Rider({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const mark = useRef<THREE.Sprite>(null!)
  const alertTex = useAlertTexture()

  useRegisterInteractable(R.interact, R.post)
  useEffect(() => () => alertTex.dispose(), [alertTex])

  useFrame(() => {
    const st = useGame.getState()
    const dx = playerPos.current.x - R.post.x
    const dz = playerPos.current.z - R.post.z
    const distToPlayer = Math.hypot(dx, dz)
    const t = performance.now()

    // "!" over his head while the player is in range and free to talk.
    const alert =
      st.started && !st.dialogue && !st.section && !st.worldOpen && distToPlayer < R.interact.radius
    if (mark.current) {
      mark.current.visible = alert
      mark.current.position.y = 2.65 + Math.sin(t * 0.006) * 0.09
    }
  })

  return (
    <group position={[R.post.x, 0, R.post.z]}>
      {/* attention "!" — always upright (sprite), toggled per-frame */}
      <sprite ref={mark} position={[0, 2.65, 0]} scale={[0.85, 1.06, 1]} renderOrder={4} visible={false}>
        <spriteMaterial map={alertTex} transparent depthTest={false} depthWrite={false} />
      </sprite>
      <ParkedCyclist />
    </group>
  )
}
