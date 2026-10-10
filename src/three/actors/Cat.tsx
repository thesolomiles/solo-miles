import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { ACTORS } from '../../config/town'
import { HOME } from '../../config/home'
import { useRegisterInteractable, useNpcPointer, canTalk } from '../../systems/interactables'
import { useGame } from '../../state/store'
import { useTownGLTF } from '../gltf'
import { useNpcOutline, NPC_OUTLINE } from '../npcOutline'

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
function CatModel({ outline, pace = 1 }: { outline: RefObject<number>; pace?: number }) {
  const root = useRef<THREE.Group>(null!)
  const { scene, animations } = useTownGLTF(MODEL)
  const { actions } = useAnimations(animations, root)

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && !m.userData.npcHull) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [scene])

  // White outline while you're in petting range or hovering him (like the NPCs).
  const setOutline = useNpcOutline(scene, NPC_OUTLINE)
  useFrame(() => setOutline(outline.current))

  useEffect(() => {
    // `pace` slows the stride to match a slower walk speed (1 = town Mews).
    actions.walk?.reset().setEffectiveTimeScale(pace).play()
  }, [actions, pace])

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
  const { hovered, handlers } = useNpcPointer(M.interact.id, pos.current)
  const outline = useRef(0) // in-range / hover highlight, eased 0..1

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()
    const petting = st.dialogue?.id === 'mews'
    const lit = canTalk() && (st.near?.id === M.interact.id || hovered.current)
    outline.current = THREE.MathUtils.damp(outline.current, lit ? 1 : 0, 14, dt)

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
    <group ref={group} position={[M.home.x, 0, M.home.z]} {...handlers}>
      {/* Invisible, roomier hit area — he's small and never stops moving. */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.2, 0.9, 1.2]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <CatModel outline={outline} />
    </group>
  )
}

const H = HOME.cat

/**
 * Mews indoors — strolls a slow loop round the lounge's coffee table, passing
 * Amily on the sofa (HOME.cat). Same model, outline and petting as the town
 * Mews; he pauses mid-loop while you pet him.
 */
export function HomeCat() {
  const group = useRef<THREE.Group>(null!)
  const pos = useRef(new THREE.Vector3(H.cx + H.rx, 0, H.cz))
  const t = useRef(0) // angle round the loop

  useRegisterInteractable(M.interact, pos.current)
  const { hovered, handlers } = useNpcPointer(M.interact.id, pos.current)
  const outline = useRef(0)

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()
    const petting = st.dialogue?.id === 'mews'
    const lit = canTalk() && (st.near?.id === M.interact.id || hovered.current)
    outline.current = THREE.MathUtils.damp(outline.current, lit ? 1 : 0, 14, dt)

    // Advance by arc length so the speed is even round the ellipse.
    if (!petting) {
      const step = Math.hypot(H.rx * Math.sin(t.current), H.rz * Math.cos(t.current))
      t.current += (H.speed * dt) / Math.max(step, 1e-3)
    }
    const a = t.current
    pos.current.set(H.cx + Math.cos(a) * H.rx, 0, H.cz + Math.sin(a) * H.rz)
    // Face along the tangent (dx, dz) → yaw = atan2(dx, dz) (model nose = +Z).
    const dx = -Math.sin(a) * H.rx
    const dz = Math.cos(a) * H.rz
    group.current.rotation.y = Math.atan2(dx, dz)
    group.current.position.set(
      pos.current.x,
      petting ? 0 : Math.abs(Math.sin(state.clock.elapsedTime * 2)) * 0.02,
      pos.current.z,
    )
  })

  return (
    <group ref={group} position={[pos.current.x, 0, pos.current.z]} {...handlers}>
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.2, 0.9, 1.2]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <CatModel outline={outline} pace={H.speed / M.speed} />
    </group>
  )
}

useTownGLTF.preload(MODEL)
