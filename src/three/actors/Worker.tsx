import { useEffect, useMemo } from 'react'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { WORKERS, type WorkerDef } from '../../config/town'

const MODEL = '/models/worker.glb'
// worker.glb mesh is ~1.9u; the town wants a ~1.8u human (same as RiggedFigure).
const SCALE = 0.9

/**
 * One ambient construction worker: a cloned skinned instance of worker.glb
 * looping a single pose clip, standing at a fixed spot. Every worker shares the
 * one loaded glb, so each instance gets its OWN skeleton via SkeletonUtils.clone
 * — otherwise they'd all drive the same bones and only one would render.
 */
function OneWorker({ def }: { def: WorkerDef }) {
  const { scene, animations } = useTownGLTF(MODEL)
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, model)

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [model])

  useEffect(() => {
    const a = actions[def.clip] ?? actions.idle
    if (!a) return
    a.reset().play()
    // Desync identical clips so the workers don't move as one.
    a.time = (def.phase ?? 0) * a.getClip().duration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions])

  return (
    <group position={[def.pos[0], 0, def.pos[1]]} rotation={[0, def.rot, 0]} scale={SCALE}>
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
