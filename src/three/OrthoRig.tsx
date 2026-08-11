import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import { CAMERA } from '../config/constants'

const _desired = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/**
 * The fixed three-quarter orthographic camera rig.
 *
 * Contract (LOCKED — see brief):
 *  - orientation is a CONSTANT; the camera never rotates and never re-aims
 *  - every frame only TRANSLATES the camera toward player + offset
 *
 * The look direction depends only on `offset` and `lookAtHeight` — both constant
 * and independent of where the player is — so we compute the orientation
 * quaternion once and simply reassign it each frame. That's the most robust way
 * to guarantee "never re-aims": there is no per-frame lookAt to accidentally
 * reintroduce, and no mount-order dependence (re-aiming every frame while the
 * position lagged is what caused motion sickness in the prototype).
 *
 * We own the camera fully (`manual = true`) so react-three-fiber doesn't reset
 * the ortho frustum on resize — we recompute it ourselves from worldViewHeight.
 */
export function OrthoRig({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const size = useThree((s) => s.size)
  const set = useThree((s) => s.set)

  const cam = useMemo(() => {
    const c = new THREE.OrthographicCamera()
    ;(c as unknown as { manual: boolean }).manual = true
    return c
  }, [])

  // The one, constant orientation. Matrix4.lookAt(eye, target, up) with the
  // camera's relative offset as the eye yields the fixed tilt (~39° down).
  const fixedQuat = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(
      CAMERA.offset,
      new THREE.Vector3(0, CAMERA.lookAtHeight, 0),
      _up,
    )
    return new THREE.Quaternion().setFromRotationMatrix(m)
  }, [])

  useEffect(() => {
    cam.near = CAMERA.near
    cam.far = CAMERA.far
    cam.position.copy(posRef.current).add(CAMERA.offset)
    cam.quaternion.copy(fixedQuat)
    set({ camera: cam })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recompute the ortho frustum on viewport change. worldViewHeight is constant
  // so the town reads at a consistent scale across window sizes.
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
    cam.quaternion.copy(fixedQuat) // constant — locked, never re-aimed
    _desired.copy(posRef.current).add(CAMERA.offset)
    cam.position.lerp(_desired, 1 - Math.pow(CAMERA.followDamping, dt))
  })

  return null
}
