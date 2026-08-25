import { useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { BoxCollider } from '../config/town'
import { useColliderEdit, type ColliderEditStore } from '../state/colliderEdit'

/**
 * In-scene collision editor (enabled with `?edit`). Draws every hand-authored
 * box as a translucent slab you can click to select; the selected box shows five
 * drag handles — one per corner (resize) plus a centre one (move the whole box).
 * Dragging raycasts the pointer onto the ground plane (y=0) and rewrites the
 * box, live, into the collider registry via the store — so you can walk into a
 * wall the instant you place it. The HTML toolbar (ui/ColliderEditorPanel) adds
 * add / delete / seed / clear / copy-JSON.
 *
 * The drag logic is store-agnostic: `ColliderEditorFor` takes any collider-edit
 * store (the town's `useColliderEdit` or the café's `useCafeColliderEdit`) so
 * the same editor drives whichever world is active.
 */

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _hit = new THREE.Vector3()

/** World-space point where the pointer ray crosses y=0, or null if parallel. */
function groundPoint(e: ThreeEvent<PointerEvent>): { x: number; z: number } | null {
  if (!e.ray.intersectPlane(GROUND, _hit)) return null
  return { x: _hit.x, z: _hit.z }
}

const SLAB_Y = 0.8
const SLAB_H = 1.6
const HANDLE = 0.9 // corner-handle sphere radius (generous, easy to grab)

// The four corners, encoded as which x-edge (min/max) and z-edge each one owns.
const CORNERS = [
  { xk: 'minX', zk: 'minZ' },
  { xk: 'maxX', zk: 'minZ' },
  { xk: 'minX', zk: 'maxZ' },
  { xk: 'maxX', zk: 'maxZ' },
] as const

/** Keep minX<maxX and minZ<maxZ after a corner is dragged past the far edge. */
function normalize(b: BoxCollider): BoxCollider {
  return {
    minX: Math.min(b.minX, b.maxX),
    maxX: Math.max(b.minX, b.maxX),
    minZ: Math.min(b.minZ, b.maxZ),
    maxZ: Math.max(b.minZ, b.maxZ),
  }
}

interface Drag {
  kind: 'move' | 'corner'
  corner?: (typeof CORNERS)[number]
  // For 'move': pointer→box-centre offset so the box doesn't jump to the cursor.
  offX?: number
  offZ?: number
}

interface BoxProps {
  box: BoxCollider
  index: number
  selected: boolean
  select: (i: number | null) => void
  update: (i: number, box: BoxCollider) => void
}

function EditableBox({ box, index, selected, select, update }: BoxProps) {
  const drag = useRef<Drag | null>(null)

  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const w = box.maxX - box.minX
  const d = box.maxZ - box.minZ

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    drag.current = null
    ;(e.target as Element).releasePointerCapture?.(e.pointerId)
  }

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!drag.current) return
    const p = groundPoint(e)
    if (!p) return
    e.stopPropagation()
    if (drag.current.kind === 'move') {
      const nx = p.x - (drag.current.offX ?? 0)
      const nz = p.z - (drag.current.offZ ?? 0)
      const hw = w / 2
      const hd = d / 2
      update(index, { minX: nx - hw, maxX: nx + hw, minZ: nz - hd, maxZ: nz + hd })
    } else if (drag.current.corner) {
      const c = drag.current.corner
      update(index, normalize({ ...box, [c.xk]: p.x, [c.zk]: p.z }))
    }
  }

  return (
    <group>
      {/* The box slab — click to select, then drag its face to move it. */}
      <mesh
        position={[cx, SLAB_Y, cz]}
        onPointerDown={(e) => {
          e.stopPropagation()
          select(index)
          const p = groundPoint(e)
          drag.current = { kind: 'move', offX: p ? p.x - cx : 0, offZ: p ? p.z - cz : 0 }
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <boxGeometry args={[Math.max(w, 0.05), SLAB_H, Math.max(d, 0.05)]} />
        <meshBasicMaterial
          color={selected ? 0x00e0a0 : 0xff3b30}
          transparent
          opacity={selected ? 0.34 : 0.24}
          depthWrite={false}
        />
      </mesh>

      {/* Corner handles (resize) — only on the selected box. */}
      {selected &&
        CORNERS.map((c, i) => (
          <mesh
            key={i}
            position={[box[c.xk], SLAB_Y + SLAB_H / 2 + 0.1, box[c.zk]]}
            onPointerDown={(e) => {
              e.stopPropagation()
              select(index)
              drag.current = { kind: 'corner', corner: c }
              ;(e.target as Element).setPointerCapture?.(e.pointerId)
            }}
            onPointerMove={onMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <sphereGeometry args={[HANDLE, 12, 12]} />
            <meshBasicMaterial color={0xffcc00} depthTest={false} />
          </mesh>
        ))}
    </group>
  )
}

/** The draggable boxes for a given collider-edit store. Renders nothing until
 *  that store's editor is toggled open. */
export function ColliderEditorFor({ store }: { store: ColliderEditStore }) {
  const open = store((s) => s.open)
  const boxes = store((s) => s.boxes)
  const selected = store((s) => s.selected)
  const select = store((s) => s.select)
  const update = store((s) => s.update)

  // Hidden until the panel is toggled open — a clean view otherwise.
  if (!open) return null

  return (
    <group>
      {/* Click empty ground to deselect. Large invisible catcher at y=0. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerDown={() => select(null)}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {boxes.map((b, i) => (
        <EditableBox key={i} box={b} index={i} selected={selected === i} select={select} update={update} />
      ))}
    </group>
  )
}

/** The town's collision editor (the default `?edit` world). */
export function ColliderEditor() {
  return <ColliderEditorFor store={useColliderEdit} />
}
