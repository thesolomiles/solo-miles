import { create } from 'zustand'
import type { Interactable, SectionId } from '../config/town'

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
  /** Interactable whose dialogue is open, plus which line we're on. */
  dialogue: Interactable | null
  line: number
  /** Open content section overlay (About, Cycling, …), or null for the town. */
  section: SectionId | null

  start: () => void
  setNear: (i: Interactable | null) => void
  /** The single "E / interact" action — mirrors the prototype's edge handling. */
  interact: () => void
  advance: () => void
  closeDialogue: () => void
  openSection: (s: SectionId) => void
  closeSection: () => void
}

export const useGame = create<GameState>((set, get) => ({
  started: false,
  near: null,
  dialogue: null,
  line: 0,
  section: null,

  start: () => set({ started: true }),

  setNear: (i) => {
    // avoid needless updates when the same target stays in range
    if (get().near?.id === i?.id) return
    set({ near: i })
  },

  interact: () => {
    const { dialogue, near, section } = get()
    if (section) return // content overlay handles its own input
    if (dialogue) {
      get().advance()
    } else if (near) {
      set({ dialogue: near, line: 0, near: null })
    }
  },

  advance: () => {
    const { dialogue, line } = get()
    if (!dialogue) return
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

  closeDialogue: () => set({ dialogue: null, line: 0 }),
  openSection: (s) => set({ section: s, dialogue: null, line: 0 }),
  closeSection: () => set({ section: null }),
}))
