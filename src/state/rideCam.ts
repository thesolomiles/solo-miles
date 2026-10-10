import { create } from 'zustand'

/**
 * PROTOTYPE (dev only, `?ridecam`): the ride gets real elevation (the road rises
 * and falls with a climb profile) and broadcast-style camera shots. By default an
 * auto director cuts between shots every few seconds; number keys pick one shot
 * and hold it (0 = back to auto). Without the flag the ride is unchanged.
 */
export const RIDECAM_ON =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('ridecam')

export type RideShot =
  | 'overhead' // the classic ortho ride shot
  | 'chase' // low, straight behind the riders
  | 'rearSide' // behind and off to one side (three-quarter rear)
  | 'front' // ahead of the riders, looking back at them
  | 'flyby' // a roadside tripod the riders ride past
  | 'side' // side-on 2D profile (cut-away) — manual only

/** The auto director's running order (Leonard's sequence). */
export const AUTO_SHOTS: RideShot[] = ['overhead', 'chase', 'rearSide', 'front', 'flyby']
export const SHOT_SECONDS = 5

/** Keys → shots for picking one manually. */
export const SHOT_KEYS: Record<string, RideShot> = {
  '1': 'overhead',
  '2': 'chase',
  '3': 'side',
  '4': 'rearSide',
  '5': 'front',
  '6': 'flyby',
}

export const SHOT_LABEL: Record<RideShot, string> = {
  overhead: 'overhead',
  chase: 'rear',
  rearSide: 'rear side',
  front: 'front',
  flyby: 'roadside',
  side: 'side profile',
}

interface RideCamState {
  /** Auto director on (cuts every SHOT_SECONDS) or a held manual shot. */
  auto: boolean
  shot: RideShot
  /** Bumped on every cut so per-shot state (the flyby tripod) can reset. */
  cut: number
  setShot: (shot: RideShot, auto?: boolean) => void
  /** The HUD button: auto → each manual shot → back to auto. */
  cycle: () => void
}

const MANUAL_ORDER: RideShot[] = ['overhead', 'chase', 'rearSide', 'front', 'flyby', 'side']

export const useRideCam = create<RideCamState>((set, get) => ({
  auto: true,
  shot: 'overhead',
  cut: 0,
  setShot: (shot, auto = get().auto) => set((s) => ({ shot, auto, cut: s.cut + 1 })),
  cycle: () => {
    const { auto, shot, setShot } = get()
    if (auto) return setShot(MANUAL_ORDER[0], false)
    const i = MANUAL_ORDER.indexOf(shot)
    if (i === MANUAL_ORDER.length - 1) return setShot(AUTO_SHOTS[0], true)
    setShot(MANUAL_ORDER[i + 1], false)
  },
}))
