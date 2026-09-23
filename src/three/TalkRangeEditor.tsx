import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Interactable } from '../config/town'
import { useInteractableRegistry } from '../systems/interactables'
import { useTalkEdit, writeTalkRadius } from '../state/talkEdit'

/**
 * Dev overlay (`?talk`) for the conversation trigger. Each talker has a circle
 * on the ground — that's the area where E opens their chat. Drag the yellow
 * handle to resize it. The new radius is live (the prompt uses it immediately)
 * and kept in localStorage so a reload doesn't snap it back.
 */

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _hit = new THREE.Vector3()

function groundPoint(e: ThreeEvent<PointerEvent>): { x: number; z: number } | null {
  if (!e.ray.intersectPlane(GROUND, _hit)) return null
  return { x: _hit.x, z: _hit.z }
}

function TalkRing({ interactable, pos }: { interactable: Interactable; pos: THREE.Vector3 }) {
  const group = useRef<THREE.Group>(null!)
  const dragging = useRef(false)
  const [radius, setRadius] = useState(interactable.radius)
  const select = useTalkEdit((s) => s.select)
  const upsert = useTalkEdit((s) => s.upsert)
  const selected = useTalkEdit((s) => s.selected) === interactable.id

  useEffect(() => {
    upsert({ id: interactable.id, name: interactable.name, radius: interactable.radius })
  }, [interactable, upsert])

  useFrame(() => {
    group.current.position.set(pos.x, 0.06, pos.z)
  })

  const publish = (r: number) => {
    const next = Math.max(0.6, Math.round(r * 10) / 10)
    interactable.radius = next
    setRadius(next)
    writeTalkRadius(interactable.id, next)
    upsert({ id: interactable.id, name: interactable.name, radius: next })
  }

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    const p = groundPoint(e)
    if (!p) return
    e.stopPropagation()
    publish(Math.hypot(p.x - pos.x, p.z - pos.z))
  }

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    dragging.current = true
    select(interactable.id)
    upsert({ id: interactable.id, name: interactable.name, radius })
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  return (
    <group ref={group}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={startDrag}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial
          color={selected ? 0x35e0ff : 0x20cfff}
          transparent
          opacity={selected ? 0.28 : 0.16}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.05, radius - 0.1), radius, 64]} />
        <meshBasicMaterial
          color={0x20cfff}
          transparent
          opacity={0.9}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        position={[radius, 0.3, 0]}
        onPointerDown={startDrag}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <sphereGeometry args={[0.38, 14, 14]} />
        <meshBasicMaterial color={0xffcc00} depthTest={false} />
      </mesh>
    </group>
  )
}

export function TalkRangeEditor() {
  const reg = useInteractableRegistry()
  const [ids, setIds] = useState<string[]>([])

  useFrame(() => {
    const next = [...reg.current.keys()]
    setIds((prev) =>
      prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next,
    )
  })

  return (
    <>
      {ids.map((id) => {
        const entry = reg.current.get(id)
        if (!entry) return null
        return <TalkRing key={id} interactable={entry.interactable} pos={entry.pos} />
      })}
    </>
  )
}
