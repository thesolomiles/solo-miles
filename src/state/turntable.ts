import { create } from 'zustand'
import { RECORDS } from '../config/turntable'
import { playRecord, stopRecord } from '../systems/turntableAudio'

/**
 * What the home record player is doing: the index of the record on the
 * platter, or null when it's off. Actions call the audio graph directly so
 * play() stays inside the click/key gesture (iOS). Whether the crate modal is
 * open lives in the game store (`recordsOpen`), alongside the other modals.
 */
interface TurntableState {
  playing: number | null
  play: (i: number) => void
  next: () => void
  stop: () => void
}

export const useTurntable = create<TurntableState>((set, get) => ({
  playing: null,
  play: (i) => {
    const rec = RECORDS[i]
    if (!rec) return
    set({ playing: i })
    playRecord(rec.src, rec.gain, () => get().next())
  },
  next: () => {
    const { playing } = get()
    if (playing === null) return
    get().play((playing + 1) % RECORDS.length)
  },
  stop: () => {
    if (get().playing === null) return
    set({ playing: null })
    stopRecord()
  },
}))
