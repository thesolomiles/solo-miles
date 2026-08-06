import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import { CAMERA } from '../config/constants'

const _desired = new THREE.Vector3()
const _aim = new THREE.Vector3()

/**
 * The fixed three-quarter orthographic camera rig.
 *
 * Contract (LOCKED — see brief):
 *  - orientation is established exactly ONCE, then never modified
 *  - every frame only TRANSLATES the camera toward player + offset
 *  - the camera never rotates and never re-aims at the player
 *
 * We own the camera fully (`manual = true`) so react-three-fiber doesn't reset
 * the ortho frustum on resize — we recompute it ourselves from worldViewHeight.
 */
export function OrthoRig({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const size = useThree((s) => s.size)
  const set = useThree((s) => s.set)

  const cam = useMemo(() => {
    const c = new THREE.OrthographicCamera()
    // Escape hatch: tell r3f "hands off" so it won't overwrite our frustum.
    ;(c as unknown as { manual: boolean }).manual = true
    return c
  }, [])

  // Establish position + orientation once, then make it the default camera.
  useEffect(() => {
    cam.up.set(0, 1, 0)
    cam.position.copy(posRef.current).add(CAMERA.offset)
    _aim.copy(posRef.current).setY(CAMERA.lookAtHeight)
    cam.lookAt(_aim) // the ONE and only aim — locks the quaternion
    cam.near = CAMERA.near
    cam.far = CAMERA.far
    set({ camera: cam })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recompute the ortho frustum whenever the viewport changes. worldViewHeight
  // stays constant so the town reads at a consistent scale across window sizes.
  useEffect(() => {
    const aspect = size.width / size.height
    const h = CAMERA.worldViewHeight
    cam.top = h / 2
    cam.bottom = -h / 2
    cam.left = (-h * aspect) / 2
    cam.right = (h * aspect) / 2
    cam.updateProjectionMatrix()
  }, [cam, size.width, size.height])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    _desired.copy(posRef.current).add(CAMERA.offset)
    // frame-rate-independent glide; rotation is intentionally never touched.
    cam.position.lerp(_desired, 1 - Math.pow(CAMERA.followDamping, dt))
  })

  return null
}
