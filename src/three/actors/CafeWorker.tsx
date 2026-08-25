import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { CAFE } from '../../config/cafe'

const MODEL = '/models/cafe-worker.glb'
// cafe-worker.glb mesh is ~1.88u; the town wants a ~1.8u human (same as the
// player + construction workers).
const SCALE = 0.9
const FADE = 0.35 // cross-fade between clips
const WALK_SPEED = 1.0 // world u/s — ~matches the walk clip's stride so the feet
// plant instead of slipping (the clip covers ~1.25u of ground per ~1s cycle)
const ROAM_X = 2.0 // how far along the counter a worker strays from its home x
const TURN = 8 // yaw lerp rate (rad/s-ish, via dt clamp)

type WorkerDef = (typeof CAFE.workers)[number]
type State = 'walk' | 'stop'

// The stop-and-do clips (everything but the walk cycle). `primary` (per worker)
// is weighted so the barista mostly makes drinks and the greeter mostly chats,
// but both still break to glance around / react / idle.
const ACTIVE = ['bartend', 'talk', 'look', 'react', 'idle'] as const

const ZONE = CAFE.workZone
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * One ambient café barista: a cloned skinned instance of cafe-worker.glb that
 * works the strip behind the counter — walk to a spot, stop and do something
 * active (make a drink, chat, glance around), then move on. Each instance gets
 * its OWN skeleton via SkeletonUtils.clone — sharing the useGLTF scene would make
 * both baristas drive the same bones and only one would render.
 *
 * The two never sync: their own mixer, randomised targets + hold times, a random
 * start offset into each clip, and a per-worker `phase` stagger. Each roams a
 * band around its home x (ROAM_X) so the barista and the greeter keep to their
 * own ends of the counter rather than piling up.
 */
function OneCafeWorker({ def }: { def: WorkerDef }) {
  const group = useRef<THREE.Group>(null!)
  const { scene, animations } = useTownGLTF(MODEL)
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, model)

  // Mutable behaviour state, kept out of React (hot per-frame data).
  const home = useMemo(() => new THREE.Vector3(def.pos[0], 0, def.pos[1]), [def])
  const pos = useRef(home.clone())
  const yaw = useRef(def.rot)
  const target = useRef(home.clone())
  const state = useRef<State>('stop')
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

  // Cross-fade to `name`. Active (stopped) clips start at a random point so two
  // workers on the same clip aren't frame-synced; the walk cycle starts clean.
  const play = (name: string, randomStart = true) => {
    const next = actions[name]
    if (!next || playing.current === name) return
    actions[playing.current]?.fadeOut(FADE)
    next.reset()
    next.setLoop(THREE.LoopRepeat, Infinity)
    next.time = randomStart ? Math.random() * next.getClip().duration : 0
    next.fadeIn(FADE).play()
    playing.current = name
  }

  // Favour this worker's primary clip, else any other active one.
  const pickActive = () => {
    if (Math.random() < 0.45) return def.primary
    const others = ACTIVE.filter((c) => c !== playing.current)
    return others[Math.floor(Math.random() * others.length)]
  }

  const enter = (s: State) => {
    state.current = s
    if (s === 'walk') {
      // A new spot in this worker's band of the staff strip.
      const tx = clamp(home.x + (Math.random() * 2 - 1) * ROAM_X, ZONE.minX, ZONE.maxX)
      const tz = ZONE.minZ + Math.random() * (ZONE.maxZ - ZONE.minZ)
      target.current.set(tx, 0, tz)
      play('walk', false)
      timer.current = 6 // safety timeout in case the target is never reached
    } else {
      play(pickActive())
      timer.current = 2.5 + Math.random() * 4.5
    }
  }

  useEffect(() => {
    enter('stop')
    // Stagger the first move so the two aren't in phase.
    timer.current += (def.phase ?? 0) * 2.5
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    timer.current -= dt

    if (state.current === 'walk') {
      const dx = target.current.x - pos.current.x
      const dz = target.current.z - pos.current.z
      const d = Math.hypot(dx, dz)
      if (d > 0.12 && timer.current > 0) {
        pos.current.x += (dx / d) * WALK_SPEED * dt
        pos.current.z += (dz / d) * WALK_SPEED * dt
        const ty = Math.atan2(dx, dz) // model front is +Z
        let dd = ((ty - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
        if (dd < -Math.PI) dd += Math.PI * 2
        yaw.current += dd * Math.min(1, dt * TURN)
      } else {
        enter('stop')
      }
    } else {
      // Stopped: settle to the rest facing (toward the customer, +Z), then after
      // the hold either wander off again or switch to a different active clip.
      let dd = ((def.rot - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
      if (dd < -Math.PI) dd += Math.PI * 2
      yaw.current += dd * Math.min(1, dt * TURN)
      if (timer.current <= 0) enter(Math.random() < 0.65 ? 'walk' : 'stop')
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

/** Both baristas working behind the café counter (see CAFE.workers). */
export function CafeWorkers() {
  return (
    <>
      {CAFE.workers.map((w, i) => (
        <OneCafeWorker key={i} def={w} />
      ))}
    </>
  )
}

useTownGLTF.preload(MODEL)
