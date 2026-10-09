import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HOME } from '../config/home'
import { RECORDS, TURNTABLE } from '../config/turntable'
import { useGame } from '../state/store'
import { useTurntable } from '../state/turntable'
import { recordLevel, setRecordMix } from '../systems/turntableAudio'
import { useTownGLTF } from './gltf'

/**
 * The home record player's moving parts and its sound. The console, turntable
 * and speakers are modelled in home.blend (`RecordConsole`); the export keeps
 * four nodes separate, each with its origin at its pivot (tools/export-home.py):
 * `TT_Platter`, `TT_Arm`, `TT_Cone_L`, `TT_Cone_R`. Mounted only inside the
 * home, so unmounting (leaving the house) stops the record.
 *
 * Each frame it sets the music's mix from the player's position — loudest by
 * the nearest speaker, never silent in the room, panned by which side of the
 * console you're on — spins the platter while a record plays (with the trip
 * photo on the label), swings the tonearm on, and pulses the woofers.
 */
const RPM = (33.3 * 2 * Math.PI) / 60
const { console: C, speakers: SPEAKERS, audio: A } = TURNTABLE
/** Record sits on the platter mat (Blender TT_PlatterMat top, platter-local). */
const MAT_TOP = 0.019

export function Turntable({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const { scene } = useTownGLTF(HOME.url)
  const nodes = useMemo(
    () => ({
      platter: scene.getObjectByName('TT_Platter'),
      arm: scene.getObjectByName('TT_Arm'),
      cones: [scene.getObjectByName('TT_Cone_L'), scene.getObjectByName('TT_Cone_R')],
    }),
    [scene],
  )
  const spin = useRef(0)
  const playing = useTurntable((s) => s.playing)

  // The record (black disc + photo label) rides on the platter while playing.
  const record = useMemo(() => {
    const g = new THREE.Group()
    const vinyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.003, 40),
      new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.35 }),
    )
    vinyl.position.y = MAT_TOP + 0.0015
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.002, 32),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    )
    label.position.y = MAT_TOP + 0.004
    g.add(vinyl, label)
    g.visible = false
    return { g, label: label.material as THREE.MeshStandardMaterial }
  }, [])
  useEffect(() => {
    const p = nodes.platter
    if (!p) return
    p.add(record.g)
    return () => {
      p.remove(record.g)
    }
  }, [nodes, record])
  useEffect(() => {
    record.g.visible = playing !== null
    if (playing === null) return
    const tex = new THREE.TextureLoader().load(RECORDS[playing]!.cover, () => {
      record.label.map = tex
      record.label.needsUpdate = true
    })
    tex.colorSpace = THREE.SRGBColorSpace
    return () => tex.dispose()
  }, [playing, record])

  // Leaving the house (or HMR) lifts the needle; the next visit starts afresh.
  // The shared glTF scene outlives us, so put the moving parts back at rest.
  useEffect(
    () => () => {
      useTurntable.getState().stop()
      nodes.arm?.rotation.set(0, 0, 0)
      for (const c of nodes.cones) c?.scale.setScalar(1)
    },
    [nodes],
  )

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

    // Platter: spin up / coast down. Tonearm swings in over the record.
    const target = on ? RPM : 0
    spin.current += (target - spin.current) * Math.min(1, delta * (on ? 3 : 1.2))
    if (nodes.platter) nodes.platter.rotation.y -= spin.current * delta
    if (nodes.arm) {
      const a = on ? -0.55 : 0
      nodes.arm.rotation.y += (a - nodes.arm.rotation.y) * Math.min(1, delta * 4)
    }

    const pulse = 1 + recordLevel() * 0.18
    for (const cone of nodes.cones) cone?.scale.setScalar(THREE.MathUtils.lerp(cone.scale.x, pulse, 0.5))
  })

  return null
}
