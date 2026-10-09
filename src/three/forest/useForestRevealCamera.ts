import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FOREST_ENCOUNTER as E } from '../../config/forestEncounter'
import { forestView } from '../../systems/forestView'
import { forestReveal } from '../../state/forestEncounter'

/** An authored low shot behind the player, switched under the HUD's black fade. */
export function useForestRevealCamera(ortho: THREE.OrthographicCamera) {
  const get = useThree((s) => s.get)
  const set = useThree((s) => s.set)
  const camera = useMemo(() => {
    const shot = new THREE.PerspectiveCamera(E.camera.fov, 1, 0.1, 400)
    ;(shot as unknown as { manual: boolean }).manual = true
    return shot
  }, [])

  const restore = () => {
    if (get().camera === camera) set({ camera: ortho })
  }
  useEffect(() => () => {
    if (get().camera === camera) set({ camera: ortho })
  }, [get, set, camera, ortho])

  const update = (aspect: number) => {
    if (!forestReveal.perspective) {
      restore()
      return
    }
    // Pull straight back on portrait while keeping the eye low to the ground.
    const pullBack = Math.max(0, 1 / aspect - 1) * 13
    camera.position.set(forestView.walkerX - 6 - pullBack, 1.4, 14 + pullBack * 0.35)
    camera.lookAt(E.landmarkX - 1, 5.1, E.landmarkZ + 2)
    if (camera.aspect !== aspect) {
      camera.aspect = aspect
      camera.updateProjectionMatrix()
    }
    if (get().camera !== camera) set({ camera })
  }
  return { update, restore }
}
