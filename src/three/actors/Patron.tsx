import { useEffect, useMemo } from 'react'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { CAFE } from '../../config/cafe'

// The patron GLBs stand ~ the same ~2u human as the player + baristas; 0.9 lands
// them at the shared ~1.8u seated scale.
const SCALE = 0.9

type PatronDef = (typeof CAFE.patrons)[number]

/**
 * One seated café customer: a cloned skinned instance of a patron GLB
 * (`def.model`, e.g. patron-1 = sit-and-talk, patron-2 = cross-legged) parked at
 * a chair, looping its `sit` clip. No movement or behaviour — it's ambient
 * set-dressing, like the baristas but stationary. Each instance gets its OWN
 * skeleton via SkeletonUtils.clone (sharing the useGLTF scene would make all
 * patrons of that model drive the same bones and only one would render), and
 * starts its clip at a random offset so patrons aren't frame-synced.
 */
function OnePatron({ def }: { def: PatronDef }) {
  const { scene, animations } = useTownGLTF(def.model)
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
    const clip = actions.sit
    if (!clip) return
    clip.reset()
    clip.setLoop(THREE.LoopRepeat, Infinity)
    clip.time = Math.random() * clip.getClip().duration
    clip.play()
    return () => void clip.stop()
  }, [actions])

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
        <OnePatron key={i} def={p} />
      ))}
    </>
  )
}

// Preload each distinct patron model.
for (const url of new Set(CAFE.patrons.map((p) => p.model))) useTownGLTF.preload(url)
