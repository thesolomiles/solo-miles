import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { CAFE } from '../../config/cafe'
import { useRegisterInteractable } from '../../systems/interactables'
import { useGame } from '../../state/store'
import { useAlertTexture } from '../alertTexture'
import type { Interactable } from '../../config/town'

// The patron GLBs stand ~ the same ~2u human as the player + baristas; 0.9 lands
// them at the shared ~1.8u seated scale.
const SCALE = 0.9
const FADE = 0.3

type PatronDef = (typeof CAFE.patrons)[number]

function idleClip(animations: THREE.AnimationClip[]) {
  return animations.find((c) => c.name === 'idle') ?? animations.find((c) => c.name === 'sit')
}

/** Play `clip` on `mixer` and stamp that pose onto the skeleton immediately. */
function snap(mixer: THREE.AnimationMixer, clip: THREE.AnimationClip, loop: boolean) {
  const action = mixer.clipAction(clip)
  action.reset()
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
  action.clampWhenFinished = !loop
  action.setEffectiveWeight(1)
  action.play()
  mixer.update(0)
  return action
}

/**
 * One seated café customer: a cloned skinned instance of a patron GLB
 * (`def.model`) parked at a chair. Single-clip patrons (patron-1 / patron-2)
 * loop `sit`. Multi-clip ones (george / james / melanie) loop `idle` and
 * periodically play their extra once (thumbs-up / angry / clap), then return.
 *
 * The sit/idle pose is stamped onto the clone BEFORE the first render — the
 * bind pose is a T-pose, and waiting for a mixer tick is what left everyone
 * frozen like that at café entry.
 */
/** Leonard-style "!" + E-talk. Mounted only on patrons that have an `interact`. */
function PatronTalk({
  interact,
  pos,
  playerPos,
}: {
  interact: Interactable
  pos: [number, number]
  playerPos: RefObject<THREE.Vector3>
}) {
  const mark = useRef<THREE.Sprite>(null!)
  const alertTex = useAlertTexture()
  const talkPos = useMemo(() => new THREE.Vector3(pos[0], 0, pos[1]), [pos])
  useRegisterInteractable(interact, talkPos)
  useEffect(() => () => alertTex.dispose(), [alertTex])

  useFrame(() => {
    const st = useGame.getState()
    const dx = playerPos.current.x - talkPos.x
    const dz = playerPos.current.z - talkPos.z
    const distToPlayer = Math.hypot(dx, dz)
    const alert =
      st.started &&
      !st.dialogue &&
      !st.section &&
      !st.worldOpen &&
      distToPlayer < interact.radius
    if (mark.current) {
      mark.current.visible = alert
      mark.current.position.y = 2.2 + Math.sin(performance.now() * 0.006) * 0.09
    }
  })

  return (
    <sprite ref={mark} position={[0, 2.2, 0]} scale={[0.85, 1.06, 1]} renderOrder={4} visible={false}>
      <spriteMaterial map={alertTex} transparent depthTest={false} depthWrite={false} />
    </sprite>
  )
}

function OnePatron({
  def,
  index,
  playerPos,
}: {
  def: PatronDef
  index: number
  playerPos: RefObject<THREE.Vector3>
}) {
  const { scene, animations } = useTownGLTF(def.model)

  const { model, mixer, idle, extras } = useMemo(() => {
    const model = skeletonClone(scene)
    const mixer = new THREE.AnimationMixer(model)
    const idle = idleClip(animations)
    const extras = animations.filter((c) => c !== idle)
    if (idle) snap(mixer, idle, true)
    return { model, mixer, idle, extras }
  }, [scene, animations])

  const playing = useRef<THREE.AnimationAction | null>(null)
  const mode = useRef<'idle' | 'extra'>('idle')
  const timer = useRef(extras.length ? 3 + Math.random() * 5 + index * 1.4 : Infinity)

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
    if (idle) playing.current = mixer.existingAction(idle) ?? mixer.clipAction(idle)
    return () => {
      // Don't stopAllAction — that snaps them back to the bind T-pose.
      playing.current = null
    }
  }, [model, mixer, idle])

  const play = (clip: THREE.AnimationClip, loop: boolean, hard: boolean) => {
    const next = mixer.clipAction(clip)
    const prev = playing.current
    if (prev === next && next.isRunning()) return
    if (!hard && prev && prev !== next) prev.fadeOut(FADE)
    next.reset()
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    next.clampWhenFinished = !loop
    if (hard) {
      next.setEffectiveWeight(1)
      next.play()
      mixer.update(0)
    } else {
      next.fadeIn(FADE).play()
    }
    playing.current = next
  }

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    mixer.update(dt)
    if (mode.current === 'idle' && idle) {
      const action = mixer.existingAction(idle) ?? mixer.clipAction(idle)
      if (!action.isRunning()) play(idle, true, true)
    }
    if (!extras.length) return
    timer.current -= dt
    if (timer.current > 0) return
    if (mode.current === 'idle') {
      const extra = extras[Math.floor(Math.random() * extras.length)]
      play(extra, false, false)
      mode.current = 'extra'
      timer.current = extra.duration + FADE
    } else if (idle) {
      play(idle, true, false)
      mode.current = 'idle'
      timer.current = 5 + Math.random() * 8
    }
  })

  return (
    <group position={[def.pos[0], def.yFix ?? 0, def.pos[1]]} rotation={[0, def.rot, 0]} scale={SCALE}>
      {'interact' in def && def.interact && (
        <PatronTalk interact={def.interact} pos={def.pos} playerPos={playerPos} />
      )}
      <primitive object={model} />
    </group>
  )
}

/** All seated café customers (see CAFE.patrons). */
export function Patrons({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  return (
    <>
      {CAFE.patrons.map((p, i) => (
        <OnePatron key={p.model} def={p} index={i} playerPos={playerPos} />
      ))}
    </>
  )
}

// Preload each distinct patron model.
for (const url of new Set(CAFE.patrons.map((p) => p.model))) useTownGLTF.preload(url)
