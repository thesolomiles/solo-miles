import { create } from 'zustand'
import type { DialogueChoice, Interactable, InteractZone, SectionId } from '../config/town'
import { CAFE } from '../config/cafe'
import { ROUTES, routeScript } from '../config/worlds'

/** Total lines Leonard says on a route: his chat + the appended closing line
 *  (RIDE_OUTRO_LINE, rendered by the HUD). */
function rideLineCount(routeId: string): number {
  const route = ROUTES[routeId]
  if (!route) return 0
  return routeScript(route).length + 1
}

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
  | { kind: 'ride'; to: string | null }

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
  /** True while Leonard's world selector (country → route picker) is open. */
  worldOpen: boolean
  /** Café arcade game-selector modal. */
  gamesOpen: boolean
  /** Active ride route id (the auto-runner scene), or null when not riding. Set
      by picking a route in the world selector; cleared when Leonard's chat ends
      or the player leaves. Drives the town→ride world swap (three/Scene.tsx). */
  ride: string | null
  /** Which line of Leonard's ride chat is showing (index into the route script
      + the appended closing line). */
  rideLine: number
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
  closeWorld: () => void
  openGames: () => void
  closeGames: () => void
  /** Begin a town↔ride fade (pass a route id to start, null to leave). Closes the
      world selector so the fade isn't sitting under it. */
  requestRide: (to: string | null) => void
  /** Advance Leonard's ride chat by one line; leaving the ride once it's done. */
  advanceRide: () => void
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
  worldOpen: false,
  gamesOpen: false,
  ride: null,
  rideLine: 0,
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
    const { dialogue, near, nearZone, section, worldOpen, gamesOpen, transition, minigame } =
      get()
    if (section || worldOpen || gamesOpen || transition || minigame) return
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
    if (choice.outcome === 'sendBack') {
      // Leonard's "No" glides you back to the bridge. Same choice from a café
      // talker fades you out the door (sendBack's town glide isn't a café path).
      if (get().interior === 'cafe') get().requestInterior(null)
      else set({ sendBack: true })
    } else if (choice.outcome === 'openWorld') set({ worldOpen: true })
  },

  closeDialogue: () => set({ dialogue: null, line: 0 }),
  clearSendBack: () => set({ sendBack: false }),
  openSection: (s) => set({ section: s, dialogue: null, line: 0 }),
  closeSection: () => set({ section: null }),
  closeWorld: () => set({ worldOpen: false }),
  openGames: () => set({ gamesOpen: true, near: null, nearZone: null }),
  closeGames: () => set({ gamesOpen: false }),

  requestRide: (to) => {
    if (get().transition) return
    set({
      transition: { kind: 'ride', to },
      worldOpen: false,
      near: null,
      nearZone: null,
      // A ride started from the café must land back in town (by Leonard) when
      // it ends — don't keep interior='cafe' under the ride.
      ...(to ? { interior: null } : {}),
    })
  },
  advanceRide: () => {
    const { ride, rideLine, transition } = get()
    if (!ride || transition) return
    if (rideLine + 1 >= rideLineCount(ride)) get().requestRide(null) // chat done → leave
    else set({ rideLine: rideLine + 1 })
  },
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
    else if (t.kind === 'ride') set({ ride: t.to, rideLine: 0 })
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
