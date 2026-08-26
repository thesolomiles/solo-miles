import { create } from 'zustand'
import type { InteractZone } from '../config/town'
import type { ZoneEditState } from './zoneEdit'
import { cafeZones, setCafeZones } from '../systems/cafeZones'

/**
 * State for the café's `?zones` interaction-zone editor — the twin of
 * state/zoneEdit for the café world. Same shape (ZoneEditState) so it shares
 * the in-scene editor (three/ZoneEditor) and the toolbar (ui/ZoneEditorPanel);
 * it just drives the café registry instead of the town's.
 *
 * Every mutation pushes into the live café registry via setCafeZones — which
 * also saves a localStorage draft — so a box prompts the instant you drag it
 * and survives a reload until you Save it back into config/cafe.ts.
 */

function initialZones(): InteractZone[] {
  return cafeZones.map((z) => ({ ...z }))
}

function newId(): string {
  return 'z' + Math.random().toString(36).slice(2, 8)
}

const OPEN_KEY = 'solomiles.cafeZoneOpen'
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

function commit(set: (s: Partial<ZoneEditState>) => void, next: InteractZone[], selected: number | null) {
  setCafeZones(next)
  set({ zones: next, selected })
}

export const useCafeZoneEdit = create<ZoneEditState>((set, get) => ({
  open: readOpen(),
  toggle: () =>
    set((s) => {
      const open = !s.open
      writeOpen(open)
      return { open, selected: open ? s.selected : null }
    }),
  zones: initialZones(),
  selected: null,

  // A fresh box drops in near the café centre so it's on-screen; drag it home.
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
