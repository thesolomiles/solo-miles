import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useTownGLTF } from './gltf'
import type { CharAnim } from './Figure'

const MODEL = '/models/character.glb'
// The Mixamo-merged char is ~2.0u tall; the town wants a ~1.8u human.
const SCALE = 0.9
const FADE = 0.18
// Ground speed (world u/s) each locomotion clip depicts at timeScale 1. We play
// a clip at `speed / stride` so the feet plant instead of gliding, at any
// movement speed. Measured from each clip's peak foot-plant velocity.
const STRIDE: Record<string, number> = { walk: 1.5, run: 4.0 }

/**
 * The rigged glTF player — the real character behind the `CharAnim` seam that
 * `Figure` used to fill with primitives. Loaded through the town's Draco loader;
 * its idle / walk clips (merged from Mixamo onto one skeleton) are cross-faded
 * off `anim.moving`. The controller in `Player` is untouched: it still only
 * writes `{ moving, phase }` and never knows a skeleton is on the other side.
 *
 * No yaw offset: the model's front is its local +Z, which is exactly where the
 * controller's `yaw = atan2(mx, mz)` points — so the character faces its travel
 * direction for free, and faces the camera at rest (controller yaw 0).
 */
export function RiggedFigure({ anim }: { anim: RefObject<CharAnim> }) {
  const root = useRef<THREE.Group>(null!)
  const { scene, animations } = useTownGLTF(MODEL)
  const { actions } = useAnimations(animations, root)
  const playing = useRef<string>('')

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [scene])

  // Cross-fade to the clip the controller's state asks for.
  const to = (name: string) => {
    if (playing.current === name) return
    const next = actions[name]
    if (!next) return
    actions[playing.current]?.fadeOut(FADE)
    next.reset().fadeIn(FADE).play()
    playing.current = name
  }

  useEffect(() => {
    to('idle')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions])

  useFrame(() => {
    const a = anim.current
    to(a.gait)
    // Sync the moving clip's cadence to ground speed so the feet plant.
    const clip = actions[a.gait]
    const stride = STRIDE[a.gait]
    if (clip && stride) clip.timeScale = a.speed / stride
  })

  return (
    <group ref={root} scale={SCALE}>
      <primitive object={scene} />
    </group>
  )
}

useTownGLTF.preload(MODEL)
