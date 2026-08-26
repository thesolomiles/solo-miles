import { create } from 'zustand'
import type { DialogueChoice, Interactable, InteractZone, SectionId } from '../config/town'
import { CAFE } from '../config/cafe'

/**
 * Discrete game/UI state shared between the r3f scene and the React HUD.
 *
 * IMPORTANT: only low-frequency, event-driven state lives here (which prompt is
 * showing, which dialogue/section is open). Hot per-frame data — the player and
 * actor positions — stays in plain refs so it never triggers React re-renders.
 * The proximity system computes the nearest interactable each frame and calls
 * setNear() only when it actually changes.
 */

interface GameState {
  started: boolean
  /** Interactable currently in range (drives the E-prompt). null when none. */
  near: Interactable | null
  /** Named interaction zone the player is standing inside (drives its own
      E-prompt). null when not in any box. See systems/zones.ts. */
  nearZone: InteractZone | null
  /** Interactable whose dialogue is open, plus which line we're on. */
  dialogue: Interactable | null
  line: number
  /** Open content section overlay (About, Cycling, …), or null for the town. */
  section: SectionId | null
  /** True while Leonard's ride-picker card modal is open. */
  ridesOpen: boolean
  /** Which interior "world" the player is inside, or null for the town. Set by
      pressing E on the town's café door; cleared by the café's exit zone. Drives
      the town↔café model + collision swap (config/cafe.ts, three/Scene.tsx). */
  interior: 'cafe' | null
  /** An in-progress town↔interior transition (the fade-to-black over the swap),
      or null when idle. `to` is the interior we're moving into. The fade overlay
      (Hud) drives it: request → fade out → commit at black → fade in → end. */
  transition: { to: 'cafe' | null } | null
  /** Latched when a dialogue asks to send the player back toward town; the
      Player controller consumes it, glides there, and clears it. */
  sendBack: boolean

  start: () => void
  setNear: (i: Interactable | null) => void
  setNearZone: (z: InteractZone | null) => void
  /** The single "E / interact" action — mirrors the prototype's edge handling. */
  interact: () => void
  advance: () => void
  /** Resolve a choice dialogue (Leonard's Yes/No). */
  choose: (choice: DialogueChoice) => void
  closeDialogue: () => void
  clearSendBack: () => void
  openSection: (s: SectionId) => void
  closeSection: () => void
  closeRides: () => void
  /** Begin a town↔interior transition (fade out). No-op if one is already
      running. The overlay commits + ends it. */
  requestInterior: (to: 'cafe' | null) => void
  /** Flip `interior` to the pending target — called by the overlay at full
      black, so the model/collision swap + player teleport happen unseen. */
  commitInterior: () => void
  /** Clear the transition once the fade-in finishes. */
  endTransition: () => void
}

export const useGame = create<GameState>((set, get) => ({
  started: false,
  near: null,
  nearZone: null,
  dialogue: null,
  line: 0,
  section: null,
  ridesOpen: false,
  interior: null,
  transition: null,
  sendBack: false,

  start: () => set({ started: true }),

  setNear: (i) => {
    // avoid needless updates when the same target stays in range
    if (get().near?.id === i?.id) return
    set({ near: i })
  },

  setNearZone: (z) => {
    if (get().nearZone?.id === z?.id) return
    set({ nearZone: z })
  },

  interact: () => {
    const { dialogue, near, nearZone, section, ridesOpen, transition } = get()
    if (section || ridesOpen || transition) return // an overlay / fade owns input
    if (dialogue) {
      get().advance()
    } else if (near) {
      set({ dialogue: near, line: 0, near: null })
    } else if (nearZone) {
      // The café door (town side) enters the café interior; the café's exit zone
      // returns to town. Both flip `interior`, which InteriorController watches to
      // swap the model + collision and teleport the player (config/cafe.ts,
      // three/Scene.tsx).
      const { interior } = get()
      if (!interior && nearZone.id === CAFE.enterZoneId) {
        get().requestInterior('cafe')
        return
      }
      if (interior === 'cafe' && nearZone.id === CAFE.exitZoneId) {
        get().requestInterior(null)
        return
      }
      // Any other named zone still just announces itself so a specific box can be
      // wired to real behaviour later. Listen for `solomiles:zone`.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('solomiles:zone', { detail: nearZone }))
        if (import.meta.env?.DEV) console.info('[zone] entered:', nearZone.id)
      }
    }
  },

  advance: () => {
    const { dialogue, line } = get()
    if (!dialogue) return
    // A choice dialogue resolves via choose(), not by pressing E off the last
    // line — otherwise E would dismiss it before the player picks.
    if (line >= dialogue.lines.length - 1 && dialogue.choices?.length) return
    const next = line + 1
    if (next >= dialogue.lines.length) {
      // end of dialogue: sectioned interactables open their content, NPCs close.
      if (dialogue.section) {
        set({ dialogue: null, line: 0, section: dialogue.section })
      } else {
        set({ dialogue: null, line: 0 })
      }
      return
    }
    set({ line: next })
  },

  choose: (choice) => {
    set({ dialogue: null, line: 0 })
    if (choice.outcome === 'sendBack') set({ sendBack: true })
    else if (choice.outcome === 'openRides') set({ ridesOpen: true })
  },

  closeDialogue: () => set({ dialogue: null, line: 0 }),
  clearSendBack: () => set({ sendBack: false }),
  openSection: (s) => set({ section: s, dialogue: null, line: 0 }),
  closeSection: () => set({ section: null }),
  closeRides: () => set({ ridesOpen: false }),

  requestInterior: (to) => {
    if (get().transition) return // one at a time
    set({ transition: { to }, near: null, nearZone: null })
  },
  commitInterior: () => {
    const t = get().transition
    if (t) set({ interior: t.to })
  },
  endTransition: () => set({ transition: null }),
}))
