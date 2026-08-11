import { create } from 'zustand'
import type { DialogueChoice, Interactable, SectionId } from '../config/town'

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
  /** Latched when a dialogue asks to send the player back toward town; the
      Player controller consumes it, glides there, and clears it. */
  sendBack: boolean

  start: () => void
  setNear: (i: Interactable | null) => void
  /** The single "E / interact" action — mirrors the prototype's edge handling. */
  interact: () => void
  advance: () => void
  /** Resolve a choice dialogue (Leonard's Yes/No). */
  choose: (choice: DialogueChoice) => void
  closeDialogue: () => void
  clearSendBack: () => void
  openSection: (s: SectionId) => void
  closeSection: () => void
}

export const useGame = create<GameState>((set, get) => ({
  started: false,
  near: null,
  dialogue: null,
  line: 0,
  section: null,
  sendBack: false,

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
  },

  closeDialogue: () => set({ dialogue: null, line: 0 }),
  clearSendBack: () => set({ sendBack: false }),
  openSection: (s) => set({ section: s, dialogue: null, line: 0 }),
  closeSection: () => set({ section: null }),
}))
