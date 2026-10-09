import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RECORDS, TURNTABLE } from '../config/turntable'
import { useGame } from '../state/store'
import { useTurntable } from '../state/turntable'
import { recordLevel, setRecordMix } from '../systems/turntableAudio'

/**
 * GREYBOX record player for the home lounge: a low console with a turntable on
 * top and a speaker at each end (config/turntable.ts). Mounted only inside the
 * home, so unmounting (leaving the house) stops the record.
 *
 * Each frame it sets the music's mix from the player's position — loudest by
 * the nearest speaker, never silent in the room, panned by which side of the
 * console you're on — spins the platter while a record plays, and pulses the
 * speaker cones with the low end.
 */
const RPM = (33.3 * 2 * Math.PI) / 60
const { console: C, speakers: SPEAKERS, audio: A } = TURNTABLE
const SPK = { w: 0.42, h: 0.95, d: 0.38 }
// Toe-in: speaker fronts face the sofa (west) and a little toward the camera.
const SPK_YAW = -Math.PI / 2 + 0.55

export function Turntable({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const platter = useRef<THREE.Group>(null)
  const arm = useRef<THREE.Group>(null)
  const cones = useRef<(THREE.Mesh | null)[]>([])
  const spin = useRef(0)
  const playing = useTurntable((s) => s.playing)

  // The label on the 3D record shows the trip photo, loaded on first play.
  const label = useMemo(() => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), [])
  useEffect(() => {
    if (playing === null) return
    const tex = new THREE.TextureLoader().load(RECORDS[playing]!.cover, () => {
      label.map = tex
      label.needsUpdate = true
    })
    tex.colorSpace = THREE.SRGBColorSpace
    return () => tex.dispose()
  }, [playing, label])

  // Leaving the house (or HMR) lifts the needle; the next visit starts afresh.
  useEffect(() => () => useTurntable.getState().stop(), [])

  useFrame((_, delta) => {
    const on = useTurntable.getState().playing !== null
    const st = useGame.getState()

    // Mix: nearest speaker distance → gain; console side → pan. Fade out with
    // the door's fade-to-black so the music doesn't cut at the commit.
    if (on) {
      const p = playerPos.current
      let d = Infinity
      for (const s of SPEAKERS) d = Math.min(d, Math.hypot(p.x - s.x, p.z - s.z))
      const t = THREE.MathUtils.smoothstep(d, A.near, A.far)
      const leaving = st.transition?.kind === 'interior' || document.hidden
      const level = leaving ? 0 : A.max * THREE.MathUtils.lerp(1, A.floor, t)
      const panValue = THREE.MathUtils.clamp((C.x - p.x) / A.panSpan, -A.panMax, A.panMax)
      setRecordMix(level, panValue)
    }

    // Platter: spin up / coast down. Tonearm swings onto the record.
    const target = on ? RPM : 0
    spin.current += (target - spin.current) * Math.min(1, delta * (on ? 3 : 1.2))
    if (platter.current) platter.current.rotation.y -= spin.current * delta
    if (arm.current) {
      const a = on ? -0.42 : 0
      arm.current.rotation.y += (a - arm.current.rotation.y) * Math.min(1, delta * 4)
    }

    const pulse = 1 + recordLevel() * 0.18
    for (const cone of cones.current) cone?.scale.setScalar(THREE.MathUtils.lerp(cone.scale.x, pulse, 0.5))
  })

  return (
    <group>
      {/* Console — long side along z, top at C.height. */}
      <mesh position={[C.x, C.height / 2, C.z]} castShadow receiveShadow>
        <boxGeometry args={[C.depth, C.height, C.length]} />
        <meshStandardMaterial color={0x7a5236} roughness={0.8} />
      </mesh>

      {/* Turntable plinth + platter + record + tonearm. */}
      <group position={[C.x, C.height, C.z - 0.35]}>
        <mesh position={[0, 0.035, 0]} castShadow>
          <boxGeometry args={[0.42, 0.07, 0.52]} />
          <meshStandardMaterial color={0x2a2a2e} roughness={0.5} />
        </mesh>
        <group ref={platter} position={[0, 0.075, 0.03]}>
          <mesh>
            <cylinderGeometry args={[0.18, 0.18, 0.012, 40]} />
            <meshStandardMaterial color={0x9a9aa0} metalness={0.5} roughness={0.4} />
          </mesh>
          {playing !== null && (
            <>
              <mesh position={[0, 0.009, 0]}>
                <cylinderGeometry args={[0.17, 0.17, 0.004, 40]} />
                <meshStandardMaterial color={0x111114} roughness={0.35} />
              </mesh>
              <mesh position={[0, 0.0115, 0]} material={label}>
                <cylinderGeometry args={[0.065, 0.065, 0.002, 32]} />
              </mesh>
            </>
          )}
        </group>
        {/* Tonearm pivots at the back-right corner. */}
        <group ref={arm} position={[0.16, 0.1, -0.2]}>
          <mesh position={[0, 0, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.34, 8]} />
            <meshStandardMaterial color={0xd8d8dc} metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -0.01, 0.34]}>
            <boxGeometry args={[0.03, 0.02, 0.05]} />
            <meshStandardMaterial color={0x222226} />
          </mesh>
        </group>
      </group>

      {/* Record crate at the other end of the console. */}
      <mesh position={[C.x, C.height + 0.13, C.z + 0.45]} castShadow>
        <boxGeometry args={[0.34, 0.26, 0.4]} />
        <meshStandardMaterial color={0xc79a5b} roughness={0.9} />
      </mesh>

      {SPEAKERS.map((s, i) => (
        <group key={i} position={[s.x, 0, s.z]} rotation={[0, SPK_YAW + (i === 0 ? 0.2 : -0.2), 0]}>
          <mesh position={[0, SPK.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[SPK.w, SPK.h, SPK.d]} />
            <meshStandardMaterial color={0x3b2a20} roughness={0.85} />
          </mesh>
          {/* Woofer + tweeter on the front (+z in the speaker's frame). */}
          <mesh
            ref={(m) => {
              cones.current[i] = m
            }}
            position={[0, SPK.h * 0.36, SPK.d / 2 + 0.005]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.14, 0.14, 0.02, 28]} />
            <meshStandardMaterial color={0x161618} roughness={0.7} />
          </mesh>
          <mesh position={[0, SPK.h * 0.75, SPK.d / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 20]} />
            <meshStandardMaterial color={0x161618} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
