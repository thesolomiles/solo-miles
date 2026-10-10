import { CAMERA } from '../config/constants'
import { FOREST } from '../config/forest'

/**
 * Hot per-frame state shared by the forest walk's walker (writes walkerX /
 * facing), the camera rig (eases camX after him) and the parallax scenery
 * (reads camX). Plain object, kept out of React like the town's posRef.
 */
export const forestView = {
  walkerX: 0,
  walkerY: 0,
  /** +1 facing right (+X), −1 left. */
  facing: 1 as 1 | -1,
  camX: 0,
  /** A gentle dip to the hollow's floor; jumps keep their framing. */
  camY: 0,
  /** Set on entering: the camera snaps to the walker instead of easing. */
  snap: true,
}

/** Path height above the bottom of the frame (u). */
const FLOOR_PAD = 3.2
/** Narrowest slice of forest a portrait phone shows (u). */
const MIN_WIDTH = 10

/** Ortho frame height + where the camera looks (above the path) for an aspect. */
export function forestFrame(aspect: number) {
  const h = Math.max(CAMERA.worldViewHeight / FOREST.zoom, MIN_WIDTH / aspect)
  return { h, halfX: (h * aspect) / 2, lookY: h / 2 - FLOOR_PAD }
}

/** How fast something at depth z scrolls past, relative to the path (1). */
export function rateAt(z: number): number {
  const { back, front, min } = FOREST.parallax
  return z < 0 ? Math.max(min, 1 + z * back) : 1 + z * front
}
