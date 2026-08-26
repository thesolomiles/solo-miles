import type { InteractZone } from '../config/town'
import { CAFE } from '../config/cafe'

/**
 * The café interior's live interaction-zone registry — the twin of
 * systems/zones.ts for the café instead of the town. ZoneProximity reads it
 * every frame while inside the café, and the `?zones` editor drives it live so
 * a box prompts the instant you drag it. A `?zones` draft persists to
 * localStorage and overrides the committed CAFE.zones until it's saved back
 * into config/cafe.ts (the dev-server /__save-cafe-zones endpoint).
 */

const STORAGE_KEY = 'solomiles.cafeInteractZones'

/** Load the café zone set: a live `?zones` draft wins over the committed
 *  CAFE.zones, so in-browser edits survive reloads until they're saved. */
function loadZones(): InteractZone[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as InteractZone[]
    } catch {
      /* corrupt draft — fall back to the committed defaults */
    }
  }
  return CAFE.zones.map((z) => ({ ...z }))
}

/**
 * Live café zone registry ZoneProximity reads while `interior === 'cafe'`.
 * Mutated in place so the editor's setCafeZones updates proximity without
 * anyone re-subscribing.
 */
export const cafeZones: InteractZone[] = [...loadZones()]

/** Replace the whole live café zone registry and persist it as the `?zones`
 *  draft. Called by the café zone editor on every add/move/delete/rename. */
export function setCafeZones(next: InteractZone[]) {
  cafeZones.length = 0
  cafeZones.push(...next.map((z) => ({ ...z })))
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cafeZones))
    } catch {
      /* storage full / disabled — the in-memory registry still updates */
    }
  }
}
