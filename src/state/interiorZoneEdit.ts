import { create } from 'zustand'
import type { InteractZone } from '../config/town'
import type { ZoneEditState } from './zoneEdit'

function newId(): string {
  return 'z' + Math.random().toString(36).slice(2, 8)
}

/**
 * Build the `?zones` editor store for an interior (the café, the home) — the
 * twin of state/zoneEdit for a room. Same shape (ZoneEditState) so it shares
 * the in-scene editor (three/ZoneEditor) and the toolbar (ui/ZoneEditorPanel);
 * it just drives that interior's live registry. Every mutation pushes into the
 * registry via `setZones` — which also saves a localStorage draft — so a box
 * prompts the instant you drag it and survives a reload until it's saved.
 */
export function createInteriorZoneEdit(
  zones: InteractZone[],
  setZones: (next: InteractZone[]) => void,
  openKey: string,
) {
  function readOpen(): boolean {
    try {
      return sessionStorage.getItem(openKey) === '1'
    } catch {
      return false
    }
  }
  function writeOpen(v: boolean) {
    try {
      sessionStorage.setItem(openKey, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  function commit(set: (s: Partial<ZoneEditState>) => void, next: InteractZone[], selected: number | null) {
    setZones(next)
    set({ zones: next, selected })
  }

  return create<ZoneEditState>((set, get) => ({
    open: readOpen(),
    toggle: () =>
      set((s) => {
        const open = !s.open
        writeOpen(open)
        return { open, selected: open ? s.selected : null }
      }),
    zones: zones.map((z) => ({ ...z })),
    selected: null,

    // A fresh box drops in near the room centre so it's on-screen; drag it home.
    add: () => {
      const next: InteractZone[] = [
        ...get().zones,
        { id: newId(), minX: -1.5, maxX: 1.5, minZ: -1.5, maxZ: 1.5 },
      ]
      commit(set, next, next.length - 1)
    },

    update: (i, zone) => {
      const next = get().zones.slice()
      next[i] = zone
      commit(set, next, get().selected)
    },

    setVerb: (i, verb) => {
      const next = get().zones.slice()
      next[i] = { ...next[i], verb }
      commit(set, next, get().selected)
    },

    remove: (i) => {
      const next = get().zones.filter((_, j) => j !== i)
      commit(set, next, null)
    },

    select: (i) => set({ selected: i }),

    clear: () => commit(set, [], null),
  }))
}
