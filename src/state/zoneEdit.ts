import { create } from 'zustand'
import type { InteractZone } from '../config/town'
import { zones, setZones } from '../systems/zones'

/**
 * State for the `?zones` interaction-zone editor (three/ZoneEditor.tsx + the HTML
 * toolbar ui/ZoneEditorPanel.tsx, which live in separate React roots and so share
 * through this store rather than context). Mirrors state/colliderEdit.ts.
 *
 * Every mutation pushes the zones into the live registry via setZones — which
 * also saves a localStorage draft — so a box goes live the instant you drag it,
 * and survives a reload until you save the data file.
 */
interface ZoneEditState {
  /** Editor visible? Off by default — brought out on demand, like the collision
   *  panel. When closed the in-scene handles hide and the panel collapses. */
  open: boolean
  toggle: () => void
  zones: InteractZone[]
  /** Index of the zone showing drag handles, or null. */
  selected: number | null
  add: () => void
  /** Replace a zone (coords and/or meta), preserving nothing on its own. */
  update: (i: number, zone: InteractZone) => void
  /** Set the selected zone's prompt verb without touching its box. */
  setVerb: (i: number, verb: string | undefined) => void
  remove: (i: number) => void
  select: (i: number | null) => void
  clear: () => void
}

/** Seed the editor from whatever the registry already holds (localStorage draft
 *  or the committed defaults). */
function initialZones(): InteractZone[] {
  return zones.map((z) => ({ ...z }))
}

// A short, stable handle for a fresh box — referenceable in code + the event.
function newId(): string {
  return 'z' + Math.random().toString(36).slice(2, 8)
}

// Persist the open/closed state so a Save (which rewrites the data file and thus
// triggers a Vite HMR remount) doesn't snap the panel shut mid-edit.
const OPEN_KEY = 'solomiles.zoneOpen'
function readOpen(): boolean {
  try {
    return sessionStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}
function writeOpen(v: boolean) {
  try {
    sessionStorage.setItem(OPEN_KEY, v ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Sync helper: push to the live registry + persist, then update store state. */
function commit(set: (s: Partial<ZoneEditState>) => void, next: InteractZone[], selected: number | null) {
  setZones(next)
  set({ zones: next, selected })
}

export const useZoneEdit = create<ZoneEditState>((set, get) => ({
  open: readOpen(),
  toggle: () =>
    set((s) => {
      const open = !s.open
      writeOpen(open)
      return { open, selected: open ? s.selected : null }
    }),
  zones: initialZones(),
  selected: null,

  // A fresh box drops in near the world centre so it's on-screen; drag it home.
  add: () => {
    const next: InteractZone[] = [
      ...get().zones,
      { id: newId(), minX: -2, maxX: 2, minZ: -2, maxZ: 2 },
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
