import { useMemo, useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ACTORS } from '../../config/town'
import { useRegisterInteractable } from '../../systems/interactables'
import { useGame } from '../../state/store'

const R = ACTORS.rider
const SKIN = 0xf0c9a4

/**
 * A billboarded "!" bubble, drawn once to a canvas texture. Palette matches the
 * town's UI: a warm paper bubble with a clay rim and a clay-deep mark, echoing
 * the dialogue box and prompt badges rather than a generic RPG yellow.
 */
function useAlertTexture() {
  return useMemo(() => {
    const PAPER = '#fbf4e8'
    const CLAY = '#d98a5a'
    const CLAY_DEEP = '#b9663a'
    const c = document.createElement('canvas')
    c.width = 112
    c.height = 140
    const x = c.getContext('2d')!
    const bubble = (inset: number, r: number) => {
      x.beginPath()
      x.roundRect(16 + inset, 12 + inset, 80 - inset * 2, 84 - inset * 2, r)
      x.closePath()
    }
    // tail (behind the bubble so the seam is hidden)
    x.fillStyle = CLAY
    x.beginPath()
    x.moveTo(44, 92)
    x.lineTo(56, 122)
    x.lineTo(68, 92)
    x.closePath()
    x.fill()
    // clay rim as a soft drop-shadowed base
    x.save()
    x.shadowColor = 'rgba(43, 38, 32, 0.28)'
    x.shadowBlur = 10
    x.shadowOffsetY = 5
    x.fillStyle = CLAY_DEEP
    bubble(0, 24)
    x.fill()
    x.restore()
    // paper face, sitting just inside the rim
    x.fillStyle = PAPER
    bubble(5, 20)
    x.fill()
    // the "!" in clay-deep
    x.fillStyle = CLAY_DEEP
    x.font = '800 58px "Space Grotesk", sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText('!', 56, 52)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

/**
 * Cycling Leonard — standing at the very end of the forest trail, up for a ride.
 * When the visitor gets close a "!" pops above his head and the E-prompt lights
 * up; pressing E opens his "wanna go for a ride?" question (see the store /
 * Hud choice handling). He's a normal registered interactable — the proximity
 * system finds him like any door.
 */
export function Rider({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const group = useRef<THREE.Group>(null!)
  const mark = useRef<THREE.Sprite>(null!)
  const yaw = useRef(Math.PI / 2) // start facing town (down the trail)
  const alertTex = useAlertTexture()

  useRegisterInteractable(R.interact, R.post)
  useEffect(() => () => alertTex.dispose(), [alertTex])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()
    const dx = playerPos.current.x - R.post.x
    const dz = playerPos.current.z - R.post.z
    const distToPlayer = Math.hypot(dx, dz)
    const t = performance.now()

    // Turn to face whoever's approaching; otherwise settle facing town.
    const looking = distToPlayer < R.interact.radius + 8
    const targetYaw = (looking ? Math.atan2(dx, dz) : 0) + Math.PI / 2
    let d = ((targetYaw - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
    if (d < -Math.PI) d += Math.PI * 2
    yaw.current += d * Math.min(1, dt * 6)
    group.current.rotation.y = yaw.current

    // A little idle life: a slow breathing bob while he waits.
    group.current.position.y = Math.sin(st.started ? t * 0.002 : 0) * 0.03

    // "!" over his head while the player is in range and free to talk.
    const alert = st.started && !st.dialogue && !st.section && distToPlayer < R.interact.radius
    if (mark.current) {
      mark.current.visible = alert
      mark.current.position.y = 2.65 + Math.sin(t * 0.006) * 0.09
    }
  })

  return (
    <group ref={group} position={[R.post.x, 0, R.post.z]}>
      {/* attention "!" — always upright (sprite), toggled per-frame */}
      <sprite ref={mark} position={[0, 2.65, 0]} scale={[0.85, 1.06, 1]} renderOrder={4} visible={false}>
        <spriteMaterial map={alertTex} transparent depthTest={false} depthWrite={false} />
      </sprite>
      {/* rider (leaning) */}
      <mesh position={[0, 1.05, 0]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.4, 0.9, 12]} />
        <meshStandardMaterial color={R.jersey} roughness={0.7} />
      </mesh>
      <mesh position={[0.35, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.34, 16, 14]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0.35, 1.62, 0]} rotation={[0, 0, -0.5]}>
        <sphereGeometry args={[0.37, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={0x1f6f66} roughness={0.6} />
      </mesh>
      <mesh position={[0.45, 1.1, 0]} rotation={[0, 0, 1]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.7, 8]} />
        <meshStandardMaterial color={R.jersey} roughness={0.7} />
      </mesh>
      {/* bike */}
      {[0.62, -0.62].map((dx) => (
        <mesh key={dx} position={[dx, 0.44, 0]} castShadow>
          <torusGeometry args={[0.44, 0.07, 8, 18]} />
          <meshStandardMaterial color={0x2f2a25} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.15, 0.08, 0.08]} />
        <meshStandardMaterial color={0xe4633c} roughness={0.6} />
      </mesh>
      <mesh position={[-0.35, 0.85, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
        <meshStandardMaterial color={0xe4633c} roughness={0.6} />
      </mesh>
      <mesh position={[0.5, 0.85, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.55, 8]} />
        <meshStandardMaterial color={0xe4633c} roughness={0.6} />
      </mesh>
    </group>
  )
}
