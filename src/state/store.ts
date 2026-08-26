import { create } from 'zustand'
import type { DialogueChoice, Interactable, InteractZone, SectionId } from '../config/town'
import { CAFE } from '../config/cafe'

export type MinigameId = 'pacman'
export type ArcadeHudStatus = 'play' | 'won' | 'lost' | 'dying'

export interface ArcadeHud {
  score: number
  lives: number
  status: ArcadeHudStatus
  paused: boolean
}

export type Transition =
  | { kind: 'interior'; to: 'cafe' | null }
  | { kind: 'minigame'; to: MinigameId | null }

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
  /** Café arcade game-selector modal. */
  gamesOpen: boolean
  /** Which interior "world" the player is inside, or null for the town. Set by
      pressing E on the town's café door; cleared by the café's exit zone. Drives
      the town↔café model + collision swap (config/cafe.ts, three/Scene.tsx). */
  interior: 'cafe' | null
  /** Full-screen minigame (Pac-Man) mounted over the café. Café interior stays
      set so exiting the maze returns to the same room. */
  minigame: MinigameId | null
  /** Score / lives / pause for the arcade HUD. Null when no minigame. */
  arcade: ArcadeHud | null
  /** An in-progress fade-to-black (town↔café or café↔minigame), or null when
      idle. The fade overlay (Hud) drives it: request → fade out → commit at
      black → fade in → end. */
  transition: Transition | null
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
  openGames: () => void
  closeGames: () => void
  setArcade: (hud: ArcadeHud) => void
  setArcadePaused: (paused: boolean) => void
  /** Begin a town↔interior transition (fade out). No-op if one is already
      running. The overlay commits + ends it. */
  requestInterior: (to: 'cafe' | null) => void
  /** Begin a café↔minigame fade. Closes the selector so SELECT doesn't sit
      on top of the black. */
  requestMinigame: (to: MinigameId | null) => void
  /** Apply the pending world swap — called by the overlay at full black. */
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
  gamesOpen: false,
  interior: null,
  minigame: null,
  arcade: null,
  transition: null,
  sendBack: false,

  start: () => set({ started: true }),

  setNear: (i) => {
    if (get().near?.id === i?.id) return
    set({ near: i })
  },

  setNearZone: (z) => {
    if (get().nearZone?.id === z?.id) return
    set({ nearZone: z })
  },

  interact: () => {
    const { dialogue, near, nearZone, section, ridesOpen, gamesOpen, transition, minigame } =
      get()
    if (section || ridesOpen || gamesOpen || transition || minigame) return
    if (dialogue) {
      get().advance()
    } else if (near) {
      set({ dialogue: near, line: 0, near: null })
    } else if (nearZone) {
      const { interior } = get()
      if (!interior && nearZone.id === CAFE.enterZoneId) {
        get().requestInterior('cafe')
        return
      }
      if (interior === 'cafe' && nearZone.id === CAFE.exitZoneId) {
        get().requestInterior(null)
        return
      }
      if (interior === 'cafe' && nearZone.id === CAFE.playZoneId) {
        get().openGames()
        return
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('solomiles:zone', { detail: nearZone }))
        if (import.meta.env?.DEV) console.info('[zone] entered:', nearZone.id)
      }
    }
  },

  advance: () => {
    const { dialogue, line } = get()
    if (!dialogue) return
    if (line >= dialogue.lines.length - 1 && dialogue.choices?.length) return
    const next = line + 1
    if (next >= dialogue.lines.length) {
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
  openGames: () => set({ gamesOpen: true, near: null, nearZone: null }),
  closeGames: () => set({ gamesOpen: false }),
  setArcade: (hud) => set({ arcade: hud }),
  setArcadePaused: (paused) => {
    const a = get().arcade
    if (a) set({ arcade: { ...a, paused } })
  },

  requestInterior: (to) => {
    if (get().transition) return
    set({ transition: { kind: 'interior', to }, near: null, nearZone: null })
  },
  requestMinigame: (to) => {
    if (get().transition) return
    set({
      transition: { kind: 'minigame', to },
      gamesOpen: false,
      near: null,
      nearZone: null,
    })
  },
  commitInterior: () => {
    const t = get().transition
    if (!t) return
    if (t.kind === 'interior') set({ interior: t.to })
    else if (t.to) {
      set({
        minigame: t.to,
        arcade: { score: 0, lives: 3, status: 'play', paused: false },
      })
    } else {
      set({ minigame: null, arcade: null })
    }
  },
  endTransition: () => set({ transition: null }),
}))
