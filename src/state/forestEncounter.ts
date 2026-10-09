import { create } from 'zustand'
import { FOREST_ENCOUNTER as E } from '../config/forestEncounter'
import { useGame } from './store'

export type ForestEncounterPhase = 'approach' | 'reveal' | 'ready' | 'inspecting' | 'complete'
export type ForestRevealStage = 'fade-out' | 'black-in' | 'fade-in' | 'hold' | 'story' | 'fade-back' | 'black-back' | 'return'

// Discrete stages enter React; opacity is applied directly to the existing HUD
// element by the encounter's frame callback, before the camera renders.
export const forestReveal = {
  elapsed: 0,
  opacity: 0,
  perspective: false,
  skip: false,
  fadeStart: 0,
  fadeElement: null as HTMLDivElement | null,
}

export const useForestEncounter = create<{
  phase: ForestEncounterPhase
  stage: ForestRevealStage
  nearby: boolean
}>(() => ({ phase: 'approach', stage: 'fade-out', nearby: false }))

function paintFade() {
  if (forestReveal.fadeElement) forestReveal.fadeElement.style.opacity = String(forestReveal.opacity)
}

function stage(next: ForestRevealStage) {
  forestReveal.elapsed = 0
  forestReveal.fadeStart = forestReveal.opacity
  useForestEncounter.setState({ stage: next })
}

export function resetForestEncounter() {
  if (useGame.getState().dialogue?.id === E.revealDialogue.id) useGame.getState().closeDialogue()
  Object.assign(forestReveal, { elapsed: 0, opacity: 0, perspective: false, skip: false, fadeStart: 0 })
  paintFade()
  useForestEncounter.setState({ phase: 'approach', stage: 'fade-out', nearby: false })
}

export function startForestReveal() {
  if (useForestEncounter.getState().phase !== 'approach') return
  Object.assign(forestReveal, { elapsed: 0, opacity: 0, perspective: false, skip: false, fadeStart: 0 })
  useForestEncounter.setState({ phase: 'reveal', stage: 'fade-out', nearby: false })
}

/** Skip still goes through black, so neither camera nor foreground can pop. */
export function skipForestReveal() {
  const state = useForestEncounter.getState()
  if (state.phase !== 'reveal' || forestReveal.skip || state.stage === 'fade-back' || state.stage === 'black-back' || state.stage === 'return') return
  forestReveal.skip = true
  if (useGame.getState().dialogue?.id === E.revealDialogue.id) useGame.getState().closeDialogue()
  if (forestReveal.perspective) stage('fade-back')
}

const ease = (t: number) => {
  const k = Math.max(0, Math.min(1, t))
  return k * k * (3 - 2 * k)
}

export function advanceForestReveal(dt: number) {
  const state = useForestEncounter.getState()
  if (state.phase !== 'reveal') return
  const r = forestReveal
  r.elapsed += dt
  switch (state.stage) {
    case 'fade-out':
    case 'fade-back':
      r.opacity = r.fadeStart + (1 - r.fadeStart) * ease(r.elapsed / E.camera.fade)
      if (r.elapsed >= E.camera.fade) {
        r.opacity = 1
        // Camera / scenery switches happen only after full black is painted.
        stage(state.stage === 'fade-out' && !r.skip ? 'black-in' : 'black-back')
      }
      break
    case 'black-in':
      r.perspective = true
      if (r.elapsed >= E.camera.blackHold) stage(r.skip ? 'black-back' : 'fade-in')
      break
    case 'black-back':
      r.perspective = false
      if (r.elapsed >= E.camera.blackHold) stage('return')
      break
    case 'fade-in':
    case 'return':
      r.opacity = 1 - ease(r.elapsed / E.camera.fade)
      if (r.elapsed >= E.camera.fade) {
        r.opacity = 0
        if (state.stage === 'return') useForestEncounter.setState({ phase: 'ready' })
        else stage('hold')
      }
      break
    case 'hold':
      if (r.elapsed >= E.camera.hold) {
        stage('story')
        useGame.setState({ dialogue: E.revealDialogue, line: 0 })
      }
      break
    case 'story':
      // The player controls the reading time. Closing / advancing starts return.
      if (!useGame.getState().dialogue) stage('fade-back')
      break
  }
  paintFade()
}

export function inspectForestLandmark() {
  const { phase, nearby } = useForestEncounter.getState()
  const game = useGame.getState()
  if (!game.forest || game.dialogue || game.transition || !nearby || (phase !== 'ready' && phase !== 'complete')) return
  useForestEncounter.setState({ phase: 'inspecting' })
  useGame.setState({ dialogue: E.dialogue, line: 0 })
}
