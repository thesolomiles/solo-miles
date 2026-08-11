import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { ACTORS } from '../../config/town'
import { useRegisterInteractable } from '../../systems/interactables'
import { useGame } from '../../state/store'
import { useTownGLTF } from '../gltf'

const M = ACTORS.mews
const MODEL = '/models/cat.glb'
// The Meshy cat's forward axis vs our heading; tuned so he walks nose-first.
const YAW_OFFSET = M.yawOffset

/**
 * The rigged cat model — a skinned Meshy glTF, built by tools/build-cat.py and
 * normalised to town scale there. Loops its walk clip; the wander controller in
 * `Cat` orients and moves the group, exactly the seam `RiggedFigure` fills for
 * the player.
 */
function CatModel() {
  const root = useRef<THREE.Group>(null!)
  const { scene, animations } = useTownGLTF(MODEL)
  const { actions } = useAnimations(animations, root)

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [scene])

  useEffect(() => {
    actions.walk?.reset().play()
  }, [actions])

  return (
    <group ref={root} rotation={[0, YAW_OFFSET, 0]}>
      <primitive object={scene} />
    </group>
  )
}

/**
 * Mews — ginger cat that wanders near mi casa and is pettable. Same interactable
 * type as everything else; it just happens to move. Holds still while you're
 * petting it (its dialogue is open).
 */
export function Cat() {
  const group = useRef<THREE.Group>(null!)
  const pos = useRef(new THREE.Vector3().copy(M.home))
  const dir = useRef(Math.random() * 6.28)
  const yaw = useRef(-dir.current + Math.PI / 2) // smoothed facing (lags `dir`)
  const timer = useRef(0)

  useRegisterInteractable(M.interact, pos.current)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const petting = useGame.getState().dialogue?.id === 'mews'

    timer.current += dt
    if (timer.current > 2.4) {
      timer.current = 0
      dir.current += (Math.random() - 0.5) * 2.2
    }
    if (!petting) {
      const nx = pos.current.x + Math.cos(dir.current) * M.speed * dt
      const nz = pos.current.z + Math.sin(dir.current) * M.speed * dt
      if (Math.hypot(nx - M.home.x, nz - M.home.z) < M.wanderRadius) {
        pos.current.x = nx
        pos.current.z = nz
      } else {
        dir.current += 1.6 // turn back toward home
      }
    }
    // Ease the facing toward the heading (shortest way round) instead of
    // snapping — `dir` changes in jumps, so a direct set looks abrupt.
    const targetYaw = -dir.current + Math.PI / 2
    let d = ((targetYaw - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
    if (d < -Math.PI) d += Math.PI * 2
    yaw.current += d * Math.min(1, dt * 6)
    group.current.rotation.y = yaw.current
    group.current.position.set(
      pos.current.x,
      Math.abs(Math.sin(state.clock.elapsedTime * 4)) * 0.03,
      pos.current.z,
    )
  })

  return (
    <group ref={group} position={[M.home.x, 0, M.home.z]}>
      <CatModel />
    </group>
  )
}

useTownGLTF.preload(MODEL)
