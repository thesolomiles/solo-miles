import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { CAFE } from '../../config/cafe'

// The patron GLBs stand ~ the same ~2u human as the player + baristas; 0.9 lands
// them at the shared ~1.8u seated scale.
const SCALE = 0.9
const FADE = 0.3

type PatronDef = (typeof CAFE.patrons)[number]

/**
 * One seated café customer: a cloned skinned instance of a patron GLB
 * (`def.model`) parked at a chair. Single-clip patrons (patron-1 / patron-2)
 * loop `sit`. Multi-clip ones (george / james / melanie) loop `idle` and
 * periodically play their extra once (thumbs-up / angry / clap), then return.
 * Each instance gets its OWN skeleton via SkeletonUtils.clone (sharing the
 * useGLTF scene would make all patrons of that model drive the same bones),
 * and extras are staggered so the table doesn't gesture in lockstep.
 */
function OnePatron({ def, index }: { def: PatronDef; index: number }) {
  const { scene, animations } = useTownGLTF(def.model)
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, model)

  const idleName = useRef('sit')
  const extras = useRef<string[]>([])
  const playing = useRef('')
  const mode = useRef<'idle' | 'extra'>('idle')
  const timer = useRef(0)

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [model])

  const play = (name: string, loop: boolean) => {
    const next = actions[name]
    if (!next || playing.current === name) return
    actions[playing.current]?.fadeOut(FADE)
    next.reset()
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    next.clampWhenFinished = !loop
    if (loop) next.time = Math.random() * next.getClip().duration
    next.fadeIn(FADE).play()
    playing.current = name
  }

  useEffect(() => {
    idleName.current = actions.idle ? 'idle' : 'sit'
    extras.current = Object.keys(actions).filter((n) => n !== idleName.current && actions[n])
    play(idleName.current, true)
    mode.current = 'idle'
    // Stagger first extras so the four-top doesn't fire as a chorus.
    timer.current = extras.current.length ? 3 + Math.random() * 5 + index * 1.4 : Infinity
    return () => {
      Object.values(actions).forEach((a) => a?.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions])

  useFrame((_, delta) => {
    if (!extras.current.length) return
    timer.current -= Math.min(delta, 0.05)
    if (timer.current > 0) return
    if (mode.current === 'idle') {
      const extra = extras.current[Math.floor(Math.random() * extras.current.length)]
      play(extra, false)
      mode.current = 'extra'
      timer.current = (actions[extra]?.getClip().duration ?? 2) + FADE
    } else {
      play(idleName.current, true)
      mode.current = 'idle'
      timer.current = 5 + Math.random() * 8
    }
  })

  return (
    <group
      position={[def.pos[0], def.yFix ?? 0, def.pos[1]]}
      rotation={[0, def.rot, 0]}
      scale={SCALE}
    >
      <primitive object={model} />
    </group>
  )
}

/** All seated café customers (see CAFE.patrons). */
export function Patrons() {
  return (
    <>
      {CAFE.patrons.map((p, i) => (
        <OnePatron key={p.model} def={p} index={i} />
      ))}
    </>
  )
}

// Preload each distinct patron model.
for (const url of new Set(CAFE.patrons.map((p) => p.model))) useTownGLTF.preload(url)
