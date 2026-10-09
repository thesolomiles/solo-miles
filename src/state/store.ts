import { create } from 'zustand'
import type { DialogueChoice, Interactable, InteractZone, SectionId } from '../config/town'
import { CAFE } from '../config/cafe'
import { HOME } from '../config/home'
import { TURNTABLE } from '../config/turntable'
import { FOREST_SIGN } from '../config/town'
import { SOUTH_TRAIL } from '../config/forest'
import { ROUTES, routeScript } from '../config/worlds'
import type { IntroPhase } from '../systems/intro'

/** Total lines Leonard says on a route: his chat + the appended closing line
 *  (RIDE_OUTRO_LINE, rendered by the HUD). */
function rideLineCount(routeId: string): number {
  const route = ROUTES[routeId]
  if (!route) return 0
  return routeScript(route).length + 1
}

export type MinigameId = 'pacman' | 'ninjarun'
/** The enterable interiors: the café and Leonard's home (config/cafe.ts, config/home.ts). */
export type InteriorId = 'cafe' | 'home'
export type ArcadeHudStatus = 'play' | 'won' | 'lost' | 'dying'

export interface ArcadeHud {
  score: number
  lives: number
  status: ArcadeHudStatus
  paused: boolean
  /** Best score kept across runs (Ninja Run). */
  best?: number
  /** Shuriken in hand (Ninja Run). */
  ammo?: number
}

export type Transition =
  | { kind: 'interior'; to: InteriorId | null }
  | { kind: 'minigame'; to: MinigameId | null }
  | { kind: 'ride'; to: string | null }
  | { kind: 'forest'; to: boolean }

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
  /** Where the opening skydive is (systems/intro.ts). 'done' once started. */
  introPhase: IntroPhase
  /** The town is loaded + settled, so the intro's Start button is live. */
  introReady: boolean
  /** The player pressed Start: the freefall exits and the game begins. */
  introGo: boolean
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
  /** Leonard's personal site in the fake browser (the home's work desk). */
  siteOpen: boolean
  /** The home turntable's record crate (ui/RecordsModal.tsx). */
  recordsOpen: boolean
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
  interior: InteriorId | null
  /** Full-screen minigame (Pac-Man) mounted over the café. Café interior stays
      set so exiting the maze returns to the same room. */
  minigame: MinigameId | null
  /** Score / lives / pause for the arcade HUD. Null when no minigame. */
  arcade: ArcadeHud | null
  /** Bumped by "Retry" — the running minigame restarts when it changes. */
  arcadeRun: number
  /** True while on the forest walk (the side-on world past the south trail,
      three/forest/). The town Player is unmounted; the walker takes over. */
  forest: boolean
  /** An in-progress fade-to-black (town↔café or café↔minigame), or null when
      idle. The fade overlay (Hud) drives it: request → fade out → commit at
      black → fade in → end. */
  transition: Transition | null
  /** Latched when a dialogue asks to send the player back toward town; the
      Player controller consumes it, glides there, and clears it. */
  sendBack: boolean

  start: () => void
  setIntroPhase: (p: IntroPhase) => void
  setIntroReady: () => void
  goIntro: () => void
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
  closeSite: () => void
  closeRecords: () => void
  /** Begin a town↔ride fade (pass a route id to start, null to leave). Closes the
      world selector so the fade isn't sitting under it. */
  requestRide: (to: string | null) => void
  /** Advance Leonard's ride chat by one line; leaving the ride once it's done. */
  advanceRide: () => void
  setArcade: (hud: ArcadeHud) => void
  setArcadePaused: (paused: boolean) => void
  /** Restart the current minigame from scratch (Ninja Run's Retry). */
  retryArcade: () => void
  /** Begin a town↔interior transition (fade out). No-op if one is already
      running. The overlay commits + ends it. */
  requestInterior: (to: InteriorId | null) => void
  /** Begin a café↔minigame fade. Closes the selector so SELECT doesn't sit
      on top of the black. */
  requestMinigame: (to: MinigameId | null) => void
  /** Begin a town↔forest fade. */
  requestForest: (to: boolean) => void
  /** Apply the pending world swap — called by the overlay at full black. */
  commitInterior: () => void
  /** Clear the transition once the fade-in finishes. */
  endTransition: () => void
}

export const useGame = create<GameState>((set, get) => ({
  started: false,
  introPhase: 'boot',
  introReady: false,
  introGo: false,
  near: null,
  nearZone: null,
  dialogue: null,
  line: 0,
  section: null,
  worldOpen: false,
  gamesOpen: false,
  siteOpen: false,
  recordsOpen: false,
  ride: null,
  rideLine: 0,
  interior: null,
  minigame: null,
  arcade: null,
  arcadeRun: 0,
  forest: false,
  transition: null,
  sendBack: false,

  start: () => set({ started: true, introPhase: 'done' }),
  setIntroPhase: (p) => set({ introPhase: p }),
  setIntroReady: () => set({ introReady: true }),
  goIntro: () => {
    if (get().introReady && !get().introGo) set({ introGo: true })
  },

  setNear: (i) => {
    if (get().near?.id === i?.id) return
    set({ near: i })
  },

  setNearZone: (z) => {
    if (get().nearZone?.id === z?.id) return
    set({ nearZone: z })
  },

  interact: () => {
    const { dialogue, near, nearZone, section, worldOpen, gamesOpen, siteOpen, recordsOpen, transition, minigame } =
      get()
    if (section || worldOpen || gamesOpen || siteOpen || recordsOpen || transition || minigame) return
    if (dialogue) {
      get().advance()
    } else if (get().forest) {
      // Nothing to press in the forest (the town's zones sit under the walker's
      // parked town position, so don't let them fire).
      return
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
      if (!interior && nearZone.id === HOME.enterZoneId) {
        get().requestInterior('home')
        return
      }
      if (interior === 'home' && nearZone.id === HOME.exitZoneId) {
        get().requestInterior(null)
        return
      }
      if (interior === 'home' && nearZone.id === TURNTABLE.zoneId) {
        set({ recordsOpen: true, near: null, nearZone: null })
        return
      }
      const look = interior === 'home' ? HOME.looks[nearZone.id] : undefined
      if (look) {
        set({ dialogue: look, line: 0, nearZone: null })
        return
      }
      if (interior === 'cafe' && nearZone.id === CAFE.playZoneId) {
        get().openGames()
        return
      }
      if (!interior && nearZone.id === SOUTH_TRAIL.zoneId) {
        set({ dialogue: SOUTH_TRAIL.interact, line: 0, nearZone: null })
        return
      }
      if (!interior && nearZone.id === FOREST_SIGN.zoneId) {
        set({ dialogue: FOREST_SIGN.interact, line: 0, nearZone: null })
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
    // A choice with follow-up lines (a patron's testimonial) keeps the
    // conversation going instead of resolving an outcome: swap in the reply
    // lines, drop the choices, and let `advance` close it on the last one.
    if (choice.reply?.length) {
      const { dialogue } = get()
      if (dialogue) {
        set({ dialogue: { ...dialogue, lines: choice.reply, choices: undefined }, line: 0 })
        return
      }
    }
    set({ dialogue: null, line: 0 })
    if (choice.outcome === 'sendBack') {
      // Leonard's "No" glides you back toward town (TRAIL.returnPos). Same choice from a café
      // talker fades you out the door (sendBack's town glide isn't a café path).
      if (get().interior === 'cafe') get().requestInterior(null)
      else set({ sendBack: true })
    } else if (choice.outcome === 'openWorld') set({ worldOpen: true })
    else if (choice.outcome === 'openSite') set({ siteOpen: true, near: null, nearZone: null })
    else if (choice.outcome === 'enterForest') get().requestForest(true)
    else if (choice.outcome === 'leaveForest') get().requestForest(false)
  },

  closeDialogue: () => set({ dialogue: null, line: 0 }),
  clearSendBack: () => set({ sendBack: false }),
  openSection: (s) => set({ section: s, dialogue: null, line: 0 }),
  closeSection: () => set({ section: null }),
  closeWorld: () => set({ worldOpen: false }),
  openGames: () => set({ gamesOpen: true, near: null, nearZone: null }),
  closeGames: () => set({ gamesOpen: false }),
  closeSite: () => set({ siteOpen: false }),
  closeRecords: () => set({ recordsOpen: false }),

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
  retryArcade: () => set((s) => ({ arcadeRun: s.arcadeRun + 1 })),

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
  requestForest: (to) => {
    if (get().transition) return
    set({ transition: { kind: 'forest', to }, near: null, nearZone: null })
  },
  commitInterior: () => {
    const t = get().transition
    if (!t) return
    if (t.kind === 'interior') set({ interior: t.to })
    else if (t.kind === 'forest') set({ forest: t.to })
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

// Dev-only handle so the running game's store can be poked from the console
// (e.g. previewing a dialogue without walking up to the NPC).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __game: typeof useGame }).__game = useGame
}
