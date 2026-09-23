import { create } from 'zustand'
import type { Interactable } from '../config/town'

/** Dev draft of talk-circle radii, keyed by interactable id. Survives reload. */
const DRAFT_KEY = 'solomiles.talkRadii'

export function readTalkDraft(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function writeTalkRadius(id: string, radius: number) {
  try {
    const next = { ...readTalkDraft(), [id]: radius }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** Apply a saved draft onto an interactable before it joins the registry. */
export function applyTalkDraft(interactable: Interactable) {
  if (!import.meta.env.DEV) return
  const saved = readTalkDraft()[interactable.id]
  if (typeof saved === 'number' && saved > 0) interactable.radius = saved
}

export interface TalkEntry {
  id: string
  name: string
  radius: number
}

interface TalkEditState {
  selected: string | null
  entries: TalkEntry[]
  select: (id: string | null) => void
  upsert: (entry: TalkEntry) => void
}

export const useTalkEdit = create<TalkEditState>((set) => ({
  selected: null,
  entries: [],
  select: (id) => set({ selected: id }),
  upsert: (entry) =>
    set((s) => {
      const i = s.entries.findIndex((e) => e.id === entry.id)
      const entries = s.entries.slice()
      if (i >= 0) entries[i] = entry
      else entries.push(entry)
      return { entries }
    }),
}))
