import type { BoxCollider } from '../config/town'
import { CAFE } from '../config/cafe'

/**
 * The café interior's live collider registry — the twin of systems/colliders.ts
 * for the café instead of the town. The Player reads it (via systems/activeWorld)
 * every frame while inside the café, and the `?edit` collision editor drives it
 * live so a box blocks the instant you drag it. A `?edit` draft persists to
 * localStorage and overrides the committed CAFE.colliders until it's saved back
 * into config/cafe.ts (the dev-server /__save-cafe-colliders endpoint).
 */

const STORAGE_KEY = 'solomiles.cafeColliders'

/** Load the café box set: a live `?edit` draft wins over the committed
 *  CAFE.colliders, so in-browser edits survive reloads until they're saved. */
function loadManual(): BoxCollider[] {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as BoxCollider[]
    } catch {
      /* corrupt draft — fall back to the committed defaults */
    }
  }
  return CAFE.colliders.map((b) => ({ ...b }))
}

/**
 * Live café collider registry the Player reads while `interior === 'cafe'`.
 * Mutated in place (same reference held by systems/activeWorld) so the editor's
 * setCafeColliders updates collision without anyone re-subscribing.
 */
export const cafeColliders: BoxCollider[] = [...loadManual()]

/** Replace the whole live café registry and persist it as the `?edit` draft.
 *  Called by the café collision editor on every add/move/delete. */
export function setCafeColliders(boxes: BoxCollider[]) {
  cafeColliders.length = 0
  cafeColliders.push(...boxes.map((b) => ({ ...b })))
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boxes))
    } catch {
      /* storage full / disabled — the in-memory registry still updates */
    }
  }
}
