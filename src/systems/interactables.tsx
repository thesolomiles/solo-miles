import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { Interactable } from '../config/town'
import { useGame } from '../state/store'
import { zones } from './zones'
import { cafeZones } from './cafeZones'

/**
 * A tiny registry of everything interactable in the world. Buildings and the
 * trail register a fixed position once; the moving actors (cat, cyclist)
 * register a Vector3 they keep mutating each frame. The proximity system reads
 * this one list — it doesn't care whether a thing moves.
 */
interface Entry {
  interactable: Interactable
  pos: THREE.Vector3 // a LIVE vector; owners may mutate it in place
}
type Registry = Map<string, Entry>

const Ctx = createContext<RefObject<Registry> | null>(null)

export function InteractablesProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Registry>(new Map())
  return <Ctx.Provider value={ref}>{children}</Ctx.Provider>
}

function useRegistry() {
  const ref = useContext(Ctx)
  if (!ref) throw new Error('Interactables used outside <InteractablesProvider>')
  return ref
}

/** Register an interactable. `pos` must be a stable Vector3 (owner may mutate it). */
export function useRegisterInteractable(interactable: Interactable, pos: THREE.Vector3) {
  const reg = useRegistry()
  useEffect(() => {
    reg.current.set(interactable.id, { interactable, pos })
    return () => {
      reg.current.delete(interactable.id)
    }
  }, [reg, interactable, pos])
}

/**
 * Each frame, find the nearest in-range interactable to the player and publish
 * it to the store (which dedupes). Suppresses the prompt while a dialogue or
 * section is open, or before the intro is dismissed.
 */
export function ProximitySystem({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const reg = useRegistry()
  const setNear = useGame((s) => s.setNear)

  useFrame(() => {
    const st = useGame.getState()
    // Town actors unmount when the café is up, so the registry only holds
    // whoever is actually in this world (Leonard outdoors, café talkers inside).
    // Stand down during a transition fade or while a dialogue/section is open.
    if (!st.started || st.dialogue || st.section || st.transition) {
      if (st.near) setNear(null)
      return
    }
    const p = playerPos.current
    let best: Interactable | null = null
    let bestD = Infinity
    reg.current.forEach(({ interactable, pos }) => {
      const dx = p.x - pos.x
      const dz = p.z - pos.z
      const d = Math.hypot(dx, dz)
      if (d < interactable.radius && d < bestD) {
        best = interactable
        bestD = d
      }
    })
    setNear(best)
  })

  return null
}

/**
 * Each frame, test whether the player is standing inside any hand-authored
 * interaction zone (systems/zones.ts) and publish it to the store (which
 * dedupes). Box containment — the twin of ProximitySystem's radius test, but for
 * the named "door" boxes. Suppressed while a dialogue/section/world overlay is
 * open, or before the intro is dismissed. First matching box wins.
 */
export function ZoneProximity({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const setNearZone = useGame((s) => s.setNearZone)

  useFrame(() => {
    const st = useGame.getState()
    if (!st.started || st.dialogue || st.section || st.worldOpen || st.gamesOpen || st.minigame || st.ride || st.transition) {
      if (st.nearZone) setNearZone(null)
      return
    }
    const p = playerPos.current
    // Café: live café zone registry. Town: hand-authored town set.
    const list = st.interior === 'cafe' ? cafeZones : zones
    let hit: (typeof list)[number] | null = null
    for (const z of list) {
      if (p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ) {
        hit = z
        break
      }
    }
    setNearZone(hit)
  })

  return null
}
