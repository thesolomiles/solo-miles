import { useMemo, useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { ACTORS } from '../../config/town'
import { useRegisterInteractable } from '../../systems/interactables'
import { useGame } from '../../state/store'
import { useCyclistModel, CYCLIST_SCALE } from '../cyclist'

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
 * A billboarded "!" bubble, drawn once to a canvas texture. Palette matches the
 * town's UI: a warm paper bubble with a clay rim and a clay-deep mark, echoing
 * the dialogue box and prompt badges rather than a generic RPG yellow.
 */
function useAlertTexture() {
  return useMemo(() => {
    const PAPER = '#fbf4e8'
    const CLAY = '#d98a5a'
    const CLAY_DEEP = '#b9663a'
    const c = document.createElement('canvas')
    c.width = 112
    c.height = 140
    const x = c.getContext('2d')!
    const bubble = (inset: number, r: number) => {
      x.beginPath()
      x.roundRect(16 + inset, 12 + inset, 80 - inset * 2, 84 - inset * 2, r)
      x.closePath()
    }
    // tail (behind the bubble so the seam is hidden)
    x.fillStyle = CLAY
    x.beginPath()
    x.moveTo(44, 92)
    x.lineTo(56, 122)
    x.lineTo(68, 92)
    x.closePath()
    x.fill()
    // clay rim as a soft drop-shadowed base
    x.save()
    x.shadowColor = 'rgba(43, 38, 32, 0.28)'
    x.shadowBlur = 10
    x.shadowOffsetY = 5
    x.fillStyle = CLAY_DEEP
    bubble(0, 24)
    x.fill()
    x.restore()
    // paper face, sitting just inside the rim
    x.fillStyle = PAPER
    bubble(5, 20)
    x.fill()
    // the "!" in clay-deep
    x.fillStyle = CLAY_DEEP
    x.font = '800 58px "Space Grotesk", sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText('!', 56, 52)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

/**
 * Cycling Leonard — parked on his road bike near the end of the road (mid-road,
 * just before the forest), facing south toward town. He sits on the bike but
 * isn't pedalling (see ParkedCyclist), the same kitted model the ride riders use.
 *
 * When the visitor gets close a "!" pops above his head and the E-prompt lights
 * up; pressing E opens his "wanna join me?" question (see the store / Hud choice
 * handling: Yes → world selector, No → glide back to the bridge). He's a normal
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
