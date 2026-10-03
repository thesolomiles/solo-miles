import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { Interactable } from '../config/town'
import { applyTalkDraft } from '../state/talkEdit'
import { pointMove, cancelPointMove, talkTarget } from './input'
import { useGame } from '../state/store'
import { zones } from './zones'
import { cafeZones } from './cafeZones'
import { homeZones } from './homeZones'

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

export function useInteractableRegistry() {
  const ref = useContext(Ctx)
  if (!ref) throw new Error('Interactables used outside <InteractablesProvider>')
  return ref
}

/** Register an interactable. `pos` must be a stable Vector3 (owner may mutate it). */
export function useRegisterInteractable(interactable: Interactable, pos: THREE.Vector3) {
  const reg = useInteractableRegistry()
  useEffect(() => {
    applyTalkDraft(interactable)
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
  const reg = useInteractableRegistry()
  const setNear = useGame((s) => s.setNear)

  useFrame(() => {
    const st = useGame.getState()
    // Town actors unmount when the café is up, so the registry only holds
    // whoever is actually in this world (Leonard outdoors, café talkers inside).
    // Stand down during a transition fade or while a dialogue/section is open.
    if (!st.started || st.dialogue || st.section || st.forest || st.transition) {
      if (st.near) setNear(null)
      talkTarget.id = null
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

    // Click-to-talk: arrived in range of the clicked NPC → stop and talk.
    if (talkTarget.id && !talkTarget.zone) {
      if ((best as Interactable | null)?.id === talkTarget.id) {
        talkTarget.id = null
        cancelPointMove()
        st.interact()
      } else if (!pointMove.active) {
        talkTarget.id = null // the walk ended short (blocked / keys took over)
      }
    }
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
    if (!st.started || st.dialogue || st.section || st.worldOpen || st.gamesOpen || st.siteOpen || st.minigame || st.ride || st.forest || st.transition) {
      if (st.nearZone) setNearZone(null)
      return
    }
    const p = playerPos.current
    // Café / home: that room's live zone registry. Town: hand-authored town set.
    const list = st.interior === 'cafe' ? cafeZones : st.interior === 'home' ? homeZones : zones
    let hit: (typeof list)[number] | null = null
    for (const z of list) {
      if (p.x >= z.minX && p.x <= z.maxX && p.z >= z.minZ && p.z <= z.maxZ) {
        hit = z
        break
      }
    }
    setNearZone(hit)

    // Click-to-use on a prop: walked into its zone → stop and press E.
    if (talkTarget.id && talkTarget.zone) {
      if (hit?.id === talkTarget.id) {
        talkTarget.id = null
        cancelPointMove()
        st.interact()
      } else if (!pointMove.active) {
        talkTarget.id = null
      }
    }
  })

  return null
}

/** Same "free to talk" gate as the NPCs' "!" (no overlay, dialogue or fade up). */
export function canTalk() {
  const st = useGame.getState()
  return (
    st.started && !st.dialogue && !st.section && !st.worldOpen && !st.gamesOpen &&
    !st.siteOpen && !st.minigame && !st.ride && !st.transition && !st.sendBack
  )
}

/**
 * Pointer handlers for a talkable NPC: hover flags `hovered` (drives the outline)
 * and shows the pointer cursor; a click walks the player over (point-to-move at
 * `pos`) and ProximitySystem opens the talk on arrival.
 */
export function useNpcPointer(id: string, pos: THREE.Vector3) {
  const hovered = useRef(false)
  useEffect(
    () => () => {
      if (hovered.current) document.body.style.cursor = ''
      if (talkTarget.id === id) talkTarget.id = null
    },
    [id],
  )
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      hovered.current = true
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      hovered.current = false
      document.body.style.cursor = ''
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.button !== 0 || !canTalk()) return
      e.stopPropagation()
      talkTarget.id = id
      talkTarget.zone = false
      pointMove.x = pos.x
      pointMove.z = pos.z
      pointMove.active = true
      pointMove.held = false
      pointMove.seq++
    },
  }
  return { hovered, handlers }
}
