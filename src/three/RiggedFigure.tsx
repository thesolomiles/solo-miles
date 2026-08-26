import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from './gltf'
import type { CharAnim } from './Figure'

const MODEL = '/models/character.glb'
// The Mixamo-merged char is ~2.0u tall; the town wants a ~1.8u human.
const SCALE = 0.9
const FADE = 0.18
// Ground speed (world u/s) each locomotion clip depicts at timeScale 1. We play
// a clip at `speed / stride` so the feet plant instead of gliding, at any
// movement speed. Measured from each clip's peak foot-plant velocity.
const STRIDE: Record<string, number> = { walk: 1.5, run: 4.0, 'ninja-run': 5.5 }

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
  // Take our own skinned copy rather than mounting the cached glTF scene itself.
  // The arcade's Pac-Man runner clones this same character, and two components
  // driving one shared skeleton left the town player rendering its bind pose (a
  // T-pose) after you came back out of the maze. Every other actor here already
  // clones; this one was the exception.
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions, mixer } = useAnimations(animations, root)
  const playing = useRef<string>('')
  const lastJump = useRef(0) // last jumpSeq we've acted on

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [model])

  // Cross-fade to the clip the controller's state asks for.
  const to = (name: string) => {
    const next = actions[name]
    if (!next) return
    // Tracking the clip name isn't enough on its own. drei rebuilds its action
    // cache (and calls stopAllAction) whenever the clip list re-resolves, which
    // happens on the remount coming back out of the arcade — leaving us marked
    // as playing a clip that no longer runs, i.e. the character frozen in its
    // bind pose. So re-issue play() whenever our clip isn't actually running.
    if (playing.current === name && next.isRunning()) return
    if (playing.current !== name) actions[playing.current]?.fadeOut(FADE)
    next.reset().fadeIn(FADE).play()
    playing.current = name
  }

  // Play a jump once, holding its final pose until the gait cross-fades back in.
  const jump = (name: string) => {
    const clip = actions[name]
    if (!clip) return
    actions[playing.current]?.fadeOut(FADE)
    clip.reset()
    clip.setLoop(THREE.LoopOnce, 1)
    clip.clampWhenFinished = true
    clip.timeScale = 1
    clip.fadeIn(FADE).play()
    playing.current = name
    anim.current.jumping = true
  }

  useEffect(() => {
    to('idle')
    // The only LoopOnce clips are the jumps; 'finished' means the jump ended —
    // release the lock so the next frame cross-fades back to the live gait.
    const onFinished = () => {
      anim.current.jumping = false
    }
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, mixer])

  useFrame(() => {
    const a = anim.current
    // A bumped jumpSeq requests a one-shot jump; it overrides gaits until done.
    if (a.jumpSeq !== lastJump.current) {
      lastJump.current = a.jumpSeq
      jump(a.jumpKind)
    }
    if (a.jumping) return // let the one-shot play out; don't fight it with gaits
    to(a.gait)
    // Sync the moving clip's cadence to ground speed so the feet plant.
    const clip = actions[a.gait]
    const stride = STRIDE[a.gait]
    if (clip && stride) clip.timeScale = a.speed / stride
  })

  return (
    <group ref={root} scale={SCALE}>
      <primitive object={model} />
    </group>
  )
}

useTownGLTF.preload(MODEL)
