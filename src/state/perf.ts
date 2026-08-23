import { create } from 'zustand'

/**
 * Live renderer stats, pushed from a probe inside the Canvas and read by the
 * (debug-only) HUD. Handy while iterating on the scatter: watch the draw-call
 * count so you know if a merge/instancing pass is paying off — or if you've
 * out-scattered it. See systems/instancing.ts and ui/LightingPanel.tsx.
 */
interface PerfState {
  calls: number
  tris: number
  fps: number
  set: (p: Partial<Pick<PerfState, 'calls' | 'tris' | 'fps'>>) => void
}

export const usePerf = create<PerfState>((set) => ({
  calls: 0,
  tris: 0,
  fps: 0,
  set: (p) => set(p),
}))
