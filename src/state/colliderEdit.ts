import { create } from 'zustand'
import type { BoxCollider } from '../config/town'
import { colliders, derivedColliders, setManualColliders } from '../systems/colliders'

/**
 * State for the `?edit` collision editor (three/ColliderEditor.tsx + the HTML
 * toolbar ui/ColliderEditorPanel.tsx, which live in separate React roots and so
 * share through this store rather than context).
 *
 * Every mutation pushes the boxes into the live collider registry via
 * setManualColliders — which also saves a localStorage draft — so collision
 * updates the instant you drag, and survives a reload until you export the JSON.
 */
interface ColliderEditState {
  boxes: BoxCollider[]
  /** Index of the box showing drag handles, or null. */
  selected: number | null
  add: () => void
  update: (i: number, box: BoxCollider) => void
  remove: (i: number) => void
  select: (i: number | null) => void
  seedFromDerived: () => void
  clear: () => void
}

/** Seed the editor from whatever the registry already holds (localStorage draft
 *  or the committed defaults); the registry only ever carries boxes here. */
function initialBoxes(): BoxCollider[] {
  return colliders.filter((c): c is BoxCollider => 'minX' in c).map((b) => ({ ...b }))
}

/** Sync helper: push to the live registry + persist, then update store state. */
function commit(set: (s: Partial<ColliderEditState>) => void, boxes: BoxCollider[], selected: number | null) {
  setManualColliders(boxes)
  set({ boxes, selected })
}

export const useColliderEdit = create<ColliderEditState>((set, get) => ({
  boxes: initialBoxes(),
  selected: null,

  // A fresh box drops in near the world centre so it's on-screen; drag it home.
  add: () => {
    const boxes = [...get().boxes, { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }]
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

  // Pull in the auto-derived building/tree boxes as a starting point, appended
  // to whatever's already drawn. Handy to grab the buildings, then prune.
  seedFromDerived: () => {
    const boxes = [...get().boxes, ...derivedColliders.map((b) => ({ ...b }))]
    commit(set, boxes, null)
  },

  clear: () => commit(set, [], null),
}))
