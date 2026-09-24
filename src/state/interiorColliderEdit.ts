import { create } from 'zustand'
import type { BoxCollider } from '../config/town'
import type { ColliderEditState } from './colliderEdit'

/**
 * Build the `?edit` collision-editor store for an interior (the café, the home)
 * — the twin of state/colliderEdit for a room. Same shape (ColliderEditState)
 * so it shares the in-scene editor (three/ColliderEditor) and the toolbar
 * (ui/ColliderEditorPanel); it drives that interior's live registry and has no
 * seedFromDerived (interiors have no auto-derived boxes). Every mutation pushes
 * into the registry via `setBoxes` — which also saves a localStorage draft — so
 * collision updates the instant you drag and survives a reload until it's saved.
 */
export function createInteriorColliderEdit(
  registry: BoxCollider[],
  setBoxes: (next: BoxCollider[]) => void,
  openKey: string,
) {
  // Persist open/closed so a Save (which rewrites the config → a Vite HMR
  // remount) doesn't snap the panel shut mid-edit.
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
  function commit(set: (s: Partial<ColliderEditState>) => void, boxes: BoxCollider[], selected: number | null) {
    setBoxes(boxes)
    set({ boxes, selected })
  }

  return create<ColliderEditState>((set, get) => ({
    open: readOpen(),
    toggle: () =>
      set((s) => {
        const open = !s.open
        writeOpen(open)
        return { open, selected: open ? s.selected : null }
      }),
    boxes: registry.map((b) => ({ ...b })),
    selected: null,

    // A fresh box drops in near the room centre so it's on-screen; drag it home.
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
}
