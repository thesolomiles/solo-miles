import { create } from 'zustand'
import { FOREST_OPENING as O } from '../config/forestOpening'

export type ForestOpeningPhase = 'watching' | 'stranded' | 'investigate' | 'observe' | 'demonstrate' | 'practice' | 'following'

export const useForestOpening = create<{
  phase: ForestOpeningPhase
  doubleJump: boolean
  usedDoubleJump: boolean
  showHint: boolean
}>(() => ({ phase: 'watching', doubleJump: false, usedDoubleJump: false, showHint: false }))

/** Timing is hot state; only phase transitions notify React. */
export const forestOpeningMotion = { elapsed: 0 }

export function resetForestOpening(learned = false) {
  forestOpeningMotion.elapsed = 0
  useForestOpening.setState({ phase: learned ? 'following' : 'watching', doubleJump: learned, usedDoubleJump: false, showHint: false })
}

export function advanceForestOpening(dt: number, x: number, y: number, grounded: boolean, paused: boolean) {
  if (paused) return
  const state = useForestOpening.getState()
  const setPhase = (phase: ForestOpeningPhase) => {
    forestOpeningMotion.elapsed = 0
    useForestOpening.setState({ phase })
  }
  if (state.phase === 'watching') {
    if (grounded && x > O.gap.left && x < O.gap.right && y <= -O.gap.depth + 0.05) setPhase('stranded')
    return
  }
  if ((state.phase === 'demonstrate' || state.phase === 'practice') && state.usedDoubleJump && grounded && y >= -0.02 && (x < O.gap.left || x > O.gap.right)) {
    setPhase('following')
    useForestOpening.setState({ showHint: false })
    return
  }
  forestOpeningMotion.elapsed += dt
  if (state.phase === 'stranded' && forestOpeningMotion.elapsed >= O.strandedSecs) setPhase('investigate')
  else if (state.phase === 'investigate' && forestOpeningMotion.elapsed >= O.investigateSecs) setPhase('observe')
  else if (state.phase === 'observe' && forestOpeningMotion.elapsed >= O.observeSecs) {
    setPhase('demonstrate')
    useForestOpening.setState({ doubleJump: true })
  } else if (state.phase === 'demonstrate' && forestOpeningMotion.elapsed >= O.demonstrationSecs) {
    setPhase('practice')
  } else if (state.phase === 'practice' && !state.showHint && forestOpeningMotion.elapsed >= O.hintDelaySecs) {
    useForestOpening.setState({ showHint: true })
  }
}

export function noteForestDoubleJump() {
  if (!useForestOpening.getState().usedDoubleJump) useForestOpening.setState({ usedDoubleJump: true })
}
