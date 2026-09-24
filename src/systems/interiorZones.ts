import type { InteractZone } from '../config/town'

/**
 * A live interaction-zone registry for an interior (the café, the home) — the
 * twin of systems/zones.ts for a room instead of the town. ZoneProximity reads
 * `zones` every frame while inside, and the `?zones` editor drives it live via
 * `setZones` so a box prompts the instant you drag it. Edits persist as a
 * localStorage draft (under `storageKey`) that overrides the committed defaults
 * until they're saved back into the interior's config file.
 */
export function createZoneRegistry(storageKey: string, defaults: readonly InteractZone[]) {
  function load(): InteractZone[] {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(storageKey)
        if (raw) return JSON.parse(raw) as InteractZone[]
      } catch {
        /* corrupt draft — fall back to the committed defaults */
      }
    }
    return defaults.map((z) => ({ ...z }))
  }

  // Mutated in place so the editor updates proximity without re-subscribing.
  const zones: InteractZone[] = [...load()]

  function setZones(next: InteractZone[]) {
    zones.length = 0
    zones.push(...next.map((z) => ({ ...z })))
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(zones))
      } catch {
        /* storage full / disabled — the in-memory registry still updates */
      }
    }
  }

  return { zones, setZones }
}
