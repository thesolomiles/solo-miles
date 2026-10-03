import * as THREE from 'three'
import type { InteractZone } from '../config/town'
import { useGame } from '../state/store'
import { pointMove, talkTarget } from './input'
import { zones } from './zones'
import { cafeZones } from './cafeZones'
import { homeZones } from './homeZones'

/**
 * Mouse picking for highlighted props (three/ZoneHighlights registers each
 * prop's cut-out mesh here). Hover lights the prop's outline and shows the hand
 * cursor; a click walks the player into the prop's zone, and ZoneProximity
 * presses E on arrival. NPCs use r3f pointer events instead (useNpcPointer) —
 * props are pieces of a merged world mesh, so they're picked by hand.
 */
export const propPicks = new Map<string, THREE.Mesh[]>() // zone id → its pieces
export const propHover = { zone: null as string | null }

const _ray = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _hits: THREE.Intersection[] = []

/** The prop zone under a canvas pointer event, if any. */
export function pickProp(e: PointerEvent, el: HTMLElement, camera: THREE.Camera): string | null {
  if (!propPicks.size) return null
  const r = el.getBoundingClientRect()
  _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  _ray.setFromCamera(_ndc, camera)
  let best: string | null = null
  let bestD = Infinity
  propPicks.forEach((meshes, zone) => {
    for (const m of meshes) {
      _hits.length = 0
      m.raycast(_ray, _hits)
      for (const h of _hits) {
        if (h.distance < bestD) {
          bestD = h.distance
          best = zone
        }
      }
    }
  })
  return best
}

function activeZones(): InteractZone[] {
  const { interior } = useGame.getState()
  return interior === 'cafe' ? cafeZones : interior === 'home' ? homeZones : zones
}

/** Walk into `zoneId` (its nearest point, a little inside) and use it on arrival. */
export function walkToZone(zoneId: string, from: { x: number; z: number }) {
  const z = activeZones().find((zz) => zz.id === zoneId)
  if (!z) return false
  const IN = 0.3
  const clampIn = (v: number, lo: number, hi: number) =>
    lo + IN > hi - IN ? (lo + hi) / 2 : Math.min(hi - IN, Math.max(lo + IN, v))
  talkTarget.id = zoneId
  talkTarget.zone = true
  pointMove.x = clampIn(from.x, z.minX, z.maxX)
  pointMove.z = clampIn(from.z, z.minZ, z.maxZ)
  pointMove.active = true
  pointMove.held = false
  pointMove.seq++
  return true
}
