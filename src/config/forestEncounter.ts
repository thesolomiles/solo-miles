import type { Interactable } from './town'
import { inForestHollow } from './forestOpening'
import pathTusk from './forestSkull.json'

/** First sightseeing encounter. All positions are along the forest's +X path. */
export const FOREST_ENCOUNTER = {
  leadAt: 82,
  viewpointX: 104,
  landmarkX: 110,
  landmarkZ: -6,
  clearingHalfWidth: 14,
  clearingDepth: 12,
  sceneryHalfWidth: 42,
  sceneryPrepareRadius: 38,
  inspectRadius: 10,
  /** Generated from the GLB's tusk cross-section by build-forest-skull.py. */
  pathTusk,
  camera: { fade: 0.4, blackHold: 0.15, hold: 1, fov: 48 },
  revealDialogue: {
    id: 'forest-ancient-remains-reveal',
    name: 'Ancient remains',
    role: 'Forest',
    verb: 'Look',
    color: 0xbfe6ff,
    radius: 0,
    lines: ['Imagine these woods when this creature was still walking. Even the tallest trees might have seemed small.'],
  } satisfies Interactable,
  dialogue: {
    id: 'forest-ancient-remains',
    name: 'Ancient remains',
    role: 'Forest',
    verb: 'Inspect',
    color: 0xbfe6ff,
    radius: 0,
    lines: [
      'Small grooves run along the bone. Weather has worn them down, but they almost look like a pattern.',
      'Moss fills the cracks, and roots have found their way through the bone. The forest has been growing around it for a very long time.',
      'The little wisp seems delighted that you stopped to look.',
    ],
  } satisfies Interactable,
} as const

/** Keep the near scenery out of the landmark's authored clearing. */
export function inForestClearing(x: number, z: number): boolean {
  if (inForestHollow(x, z, 1)) return true
  const dx = (x - FOREST_ENCOUNTER.landmarkX) / FOREST_ENCOUNTER.clearingHalfWidth
  const dz = (z - FOREST_ENCOUNTER.landmarkZ) / FOREST_ENCOUNTER.clearingDepth
  return dx * dx + dz * dz < 1
}

/** Populate both shots before arrival; a camera cut never changes these slots. */
export function forestSceneryHalf(camX: number, walkingHalf: number): number {
  return Math.abs(camX - FOREST_ENCOUNTER.landmarkX) < FOREST_ENCOUNTER.sceneryPrepareRadius
    ? Math.max(walkingHalf, FOREST_ENCOUNTER.sceneryHalfWidth)
    : walkingHalf
}
