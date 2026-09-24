import type { BoxCollider } from '../config/town'

/**
 * A live collider registry for an interior (the café, the home) — the twin of
 * systems/colliders.ts for a room instead of the town. The Player reads it (via
 * systems/activeWorld) every frame while inside, and the `?edit` collision
 * editor drives it live via `setBoxes`, so a box blocks the instant you drag
 * it. Edits persist as a localStorage draft (under `storageKey`) that overrides
 * the committed defaults until they're saved back into the interior's config.
 */
export function createColliderRegistry(storageKey: string, defaults: readonly BoxCollider[]) {
  function load(): BoxCollider[] {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey)
        if (raw) return JSON.parse(raw) as BoxCollider[]
      } catch {
        /* corrupt draft — fall back to the committed defaults */
      }
    }
    return defaults.map((b) => ({ ...b }))
  }

  // Mutated in place (activeWorld holds this same reference) so the editor
  // updates collision without anyone re-subscribing.
  const boxes: BoxCollider[] = [...load()]

  function setBoxes(next: BoxCollider[]) {
    boxes.length = 0
    boxes.push(...next.map((b) => ({ ...b })))
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(boxes))
      } catch {
        /* storage full / disabled — the in-memory registry still updates */
      }
    }
  }

  return { boxes, setBoxes }
}
