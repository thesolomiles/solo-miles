import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { WORKERS, type WorkerDef } from '../../config/town'

const MODEL = '/models/worker.glb'
// worker.glb mesh is ~1.9u; the town wants a ~1.8u human (same as RiggedFigure).
const SCALE = 0.9
const FADE = 0.25 // cross-fade between clips
const WANDER = 1.6 // how far a worker roams from its home spot (world u)
const WALK_SPEED = 1.1 // world u/s while walking
// One-shot transitions are long raw clips; play them over a fixed wall-clock
// time (seconds) via timeScale so kneeling/standing feels snappy, not sluggish.
const ONESHOT_SECONDS: Record<string, number> = { kneeldown: 3.0, standup: 2.2 }

type State = 'idle' | 'walk' | 'kneeldown' | 'kneel' | 'standup'

/**
 * One ambient construction worker: a cloned skinned instance of worker.glb
 * driven by a small behavior loop so the site looks worked. Each instance gets
 * its OWN skeleton via SkeletonUtils.clone — sharing the useGLTF scene directly
 * would make every worker drive the same bones and only one would render.
 *
 * Loop: idle → (walk a few steps | kneel to work) → stand → idle. The kneel is a
 * one-shot "kneeldown" into a looping "kneel" and back out through "standup".
 */
function OneWorker({ def }: { def: WorkerDef }) {
  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useTownGLTF(MODEL)
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, model)

  // Mutable behavior state, kept out of React (hot per-frame data).
  const home = useMemo(() => new THREE.Vector3(def.pos[0], 0, def.pos[1]), [def])
  const pos = useRef(home.clone())
  const yaw = useRef(def.rot)
  const target = useRef(home.clone())
  const state = useRef<State>('idle')
  const timer = useRef(0)
  const playing = useRef<string>('')

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [model])

  // Cross-fade to `name`. Non-looping clips clamp on the last frame and, if a
  // wall-clock duration is given, are time-scaled to hit it.
  const play = (name: string, loop = true, seconds?: number) => {
    const next = actions[name]
    if (!next || playing.current === name) return
    actions[playing.current]?.fadeOut(FADE)
    next.reset()
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    next.clampWhenFinished = !loop
    next.timeScale = seconds ? next.getClip().duration / seconds : 1
    next.fadeIn(FADE).play()
    playing.current = name
  }

  const enter = (s: State) => {
    state.current = s
    if (s === 'idle') {
      play(Math.random() < 0.3 ? 'look' : 'idle')
      timer.current = 2 + Math.random() * 3
    } else if (s === 'walk') {
      const a = Math.random() * Math.PI * 2
      const r = 0.8 + Math.random() * WANDER
      target.current.set(home.x + Math.cos(a) * r, 0, home.z + Math.sin(a) * r)
      play('walk')
      timer.current = 6 // safety timeout in case the target is never reached
    } else if (s === 'kneeldown') {
      play('kneeldown', false, ONESHOT_SECONDS.kneeldown)
      timer.current = ONESHOT_SECONDS.kneeldown
    } else if (s === 'kneel') {
      play('kneel')
      timer.current = 3 + Math.random() * 4
    } else if (s === 'standup') {
      play('standup', false, ONESHOT_SECONDS.standup)
      timer.current = ONESHOT_SECONDS.standup
    }
  }

  useEffect(() => {
    enter('idle')
    // Stagger the first transition so the workers don't move as one.
    timer.current += (def.phase ?? 0) * 5
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    timer.current -= dt
    const s = state.current

    if (s === 'walk') {
      const dx = target.current.x - pos.current.x
      const dz = target.current.z - pos.current.z
      const d = Math.hypot(dx, dz)
      if (d > 0.15 && timer.current > 0) {
        pos.current.x += (dx / d) * WALK_SPEED * dt
        pos.current.z += (dz / d) * WALK_SPEED * dt
        const ty = Math.atan2(dx, dz) // model front is +Z
        let dd = ((ty - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
        if (dd < -Math.PI) dd += Math.PI * 2
        yaw.current += dd * Math.min(1, dt * 8)
      } else {
        enter('idle')
      }
    } else if (timer.current <= 0) {
      if (s === 'idle') enter(Math.random() < 0.5 ? 'walk' : 'kneeldown')
      else if (s === 'kneeldown') enter('kneel')
      else if (s === 'kneel') enter('standup')
      else enter('idle') // standup (or any stray) → idle
    }

    group.current.position.set(pos.current.x, 0, pos.current.z)
    group.current.rotation.y = yaw.current
  })

  return (
    <group ref={group} position={[home.x, 0, home.z]} rotation={[0, def.rot, 0]} scale={SCALE}>
      <primitive object={model} />
    </group>
  )
}

/** All ambient workers across the construction sites (see WORKERS in town.ts). */
export function Workers() {
  return (
    <>
      {WORKERS.map((w, i) => (
        <OneWorker key={i} def={w} />
      ))}
    </>
  )
}

useTownGLTF.preload(MODEL)
