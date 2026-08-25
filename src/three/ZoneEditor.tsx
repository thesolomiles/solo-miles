import { useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { InteractZone } from '../config/town'
import { useZoneEdit } from '../state/zoneEdit'

/**
 * In-scene interaction-zone editor (enabled with `?zones`). The twin of
 * three/ColliderEditor.tsx, but for the named "door" boxes: each zone is a
 * translucent BLUE slab (vs collision's red) you click to select; the selected
 * one shows four corner handles (resize) plus a face drag (move). Dragging
 * raycasts the pointer onto the ground plane (y=0) and rewrites the box, live,
 * into the zone registry via the store. Its name floats above it while editing.
 * The HTML toolbar (ui/ZoneEditorPanel) adds add / delete / clear / rename / save.
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

/** Keep minX<maxX and minZ<maxZ after a corner is dragged past the far edge,
 *  preserving the zone's meta (id/name/verb). */
function normalize(z: InteractZone): InteractZone {
  return {
    ...z,
    minX: Math.min(z.minX, z.maxX),
    maxX: Math.max(z.minX, z.maxX),
    minZ: Math.min(z.minZ, z.maxZ),
    maxZ: Math.max(z.minZ, z.maxZ),
  }
}

interface Drag {
  kind: 'move' | 'corner'
  corner?: (typeof CORNERS)[number]
  // For 'move': pointer→box-centre offset so the box doesn't jump to the cursor.
  offX?: number
  offZ?: number
}

function EditableZone({ zone, index }: { zone: InteractZone; index: number }) {
  const selected = useZoneEdit((s) => s.selected === index)
  const select = useZoneEdit((s) => s.select)
  const update = useZoneEdit((s) => s.update)
  const drag = useRef<Drag | null>(null)

  const cx = (zone.minX + zone.maxX) / 2
  const cz = (zone.minZ + zone.maxZ) / 2
  const w = zone.maxX - zone.minX
  const d = zone.maxZ - zone.minZ

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
      update(index, { ...zone, minX: nx - hw, maxX: nx + hw, minZ: nz - hd, maxZ: nz + hd })
    } else if (drag.current.corner) {
      const c = drag.current.corner
      update(index, normalize({ ...zone, [c.xk]: p.x, [c.zk]: p.z }))
    }
  }

  return (
    <group>
      {/* No floating label — the box's id lives in the editor panel when it's
          selected. Nothing random hangs in the scene. */}

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
          color={selected ? 0x35e0ff : 0x2f80ed}
          transparent
          opacity={selected ? 0.36 : 0.26}
          depthWrite={false}
        />
      </mesh>

      {/* Corner handles (resize) — only on the selected box. */}
      {selected &&
        CORNERS.map((c, i) => (
          <mesh
            key={i}
            position={[zone[c.xk], SLAB_Y + SLAB_H / 2 + 0.1, zone[c.zk]]}
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

export function ZoneEditor() {
  const open = useZoneEdit((s) => s.open)
  const editZones = useZoneEdit((s) => s.zones)
  const clearSel = useZoneEdit((s) => s.select)

  // Hidden until the panel is toggled open — a clean view otherwise.
  if (!open) return null

  return (
    <group>
      {/* Click empty ground to deselect. Large invisible catcher at y=0. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerDown={() => clearSel(null)}
      >
        <planeGeometry args={[400, 400]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {editZones.map((z, i) => (
        <EditableZone key={z.id} zone={z} index={i} />
      ))}
    </group>
  )
}
