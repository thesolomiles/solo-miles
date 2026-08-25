import { create } from 'zustand'
import type { BoxCollider } from '../config/town'
import type { ColliderEditState } from './colliderEdit'
import { cafeColliders, setCafeColliders } from '../systems/cafeColliders'

/**
 * State for the café's `?edit` collision editor — the twin of state/colliderEdit
 * for the café world. Same shape (ColliderEditState) so it shares the in-scene
 * editor (three/ColliderEditor) and the toolbar (ui/ColliderEditorPanel); it
 * just drives the café registry instead of the town's, and has no
 * seedFromDerived (the café has no auto-derived boxes).
 *
 * Every mutation pushes into the live café registry via setCafeColliders — which
 * also saves a localStorage draft — so collision updates the instant you drag and
 * survives a reload until you Save it back into config/cafe.ts.
 */

/** Seed the editor from whatever the café registry already holds (a draft, or
 *  the committed CAFE.colliders). */
function initialBoxes(): BoxCollider[] {
  return cafeColliders.map((b) => ({ ...b }))
}

// Persist open/closed so a Save (which rewrites cafe.ts → a Vite HMR remount)
// doesn't snap the panel shut mid-edit. Own key, separate from the town editor.
const OPEN_KEY = 'solomiles.cafeColliderOpen'
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

/** Push to the live café registry + persist, then update store state. */
function commit(set: (s: Partial<ColliderEditState>) => void, boxes: BoxCollider[], selected: number | null) {
  setCafeColliders(boxes)
  set({ boxes, selected })
}

export const useCafeColliderEdit = create<ColliderEditState>((set, get) => ({
  open: readOpen(),
  toggle: () =>
    set((s) => {
      const open = !s.open
      writeOpen(open)
      return { open, selected: open ? s.selected : null }
    }),
  boxes: initialBoxes(),
  selected: null,

  // A fresh box drops in near the café centre so it's on-screen; drag it home.
  add: () => {
    const boxes = [...get().boxes, { minX: -1.5, maxX: 1.5, minZ: -1.5, maxZ: 1.5 }]
    commit(set, boxes, boxes.length - 1)
  },

  update: (i, box) => {
    const boxes = get().boxes.slice()
    boxes[i] = box
    commit(set, boxes, get().selected)
  },

  remove: (i) => {
    const boxes = get().boxes.filter((_, j) => j !== i)
    commit(set, boxes, null)
  },

  select: (i) => set({ selected: i }),

  clear: () => commit(set, [], null),
}))
