import type { InteractZone } from '../config/town'
import { INTERACT_ZONES } from '../config/zones.data'

/**
 * Interaction zones are HAND-AUTHORED, exactly like collision (systems/colliders.ts).
 * The live registry ZoneProximity reads every frame is the hand-drawn set
 * (config/zones.data.ts), editable live in-browser with `?zones` (see
 * three/ZoneEditor.tsx). A `?zones` session persists its work-in-progress to
 * localStorage, which overrides the committed defaults so edits survive a reload
 * until they're saved back into the data file.
 */

const STORAGE_KEY = 'solomiles.interactZones'

/** Load the hand-authored set: a live `?zones` draft in localStorage wins over
 *  the committed defaults, so in-browser edits survive reloads until saved. */
function loadZones(): InteractZone[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as InteractZone[]
    } catch {
      /* corrupt draft — fall back to the committed defaults */
    }
  }
  return INTERACT_ZONES.map((z) => ({ ...z }))
}

/**
 * Live zone registry ZoneProximity reads every frame. Starts from the
 * hand-authored set (localStorage draft, else the committed defaults). Mutated
 * in place so the proximity system never needs to re-subscribe. The editor drives
 * it via setZones on every change, so a box goes live the moment you place it.
 */
export const zones: InteractZone[] = [...loadZones()]

/**
 * Replace the whole live registry with a hand-authored zone set and persist it as
 * the `?zones` draft. Called by the zone editor on every add/move/delete/rename,
 * so a box is active the moment you place it.
 */
export function setZones(next: InteractZone[]) {
  zones.length = 0
  zones.push(...next.map((z) => ({ ...z })))
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(zones))
    } catch {
      /* storage full / disabled — the in-memory registry still updates */
    }
  }
}
