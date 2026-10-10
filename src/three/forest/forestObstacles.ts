import { FOREST } from '../../config/forest'
import { FOREST_ENCOUNTER as E } from '../../config/forestEncounter'
import { FOREST_OPENING } from '../../config/forestOpening'
import { hash3 } from './forestAssets'

export type ObstacleKind = keyof typeof FOREST.obstacles.kinds

export interface Obstacle {
  /** Slot index (stable id). */
  i: number
  kind: ObstacleKind | 'tusk'
  /** Centre x, half-width, top height. */
  x: number
  hw: number
  h: number
}

const O = FOREST.obstacles
const KINDS = Object.keys(O.kinds) as ObstacleKind[]

/** The obstacle in slot i, if any — hashed, so it's always the same one. */
export function obstacleAt(i: number): Obstacle | null {
  const r = (salt: number) => hash3(i, 404, salt)
  if (r(0) > O.fill) return null
  const x = (i + 0.2 + 0.6 * r(1)) * O.every
  if (Math.abs(x) < O.clearStart) return null
  let pick = r(2)
  let kind: ObstacleKind = KINDS[0]
  for (const k of KINDS) {
    kind = k
    pick -= O.kinds[k].p
    if (pick <= 0) break
  }
  const { w, h } = O.kinds[kind]
  return { i, kind, x, hw: w / 2, h }
}

/** All obstacles overlapping [x0, x1]. */
export function obstaclesIn(x0: number, x1: number): Obstacle[] {
  const out: Obstacle[] = []
  FOREST_OPENING.obstacles.forEach((authored, index) => {
    const size = O.kinds[authored.kind]
    const obstacle: Obstacle = { i: -10 - index, kind: authored.kind, x: authored.x, hw: size.w / 2, h: size.h }
    if (obstacle.x + obstacle.hw >= x0 && obstacle.x - obstacle.hw <= x1) out.push(obstacle)
  })
  // The authored tusk uses the existing jump/landing collision even while
  // procedural obstacles are off. Its visual is already part of the skull GLB.
  const tusk: Obstacle = { i: -1, kind: 'tusk', x: E.landmarkX + E.pathTusk.x, hw: E.pathTusk.hw, h: E.pathTusk.h }
  if (tusk.x + tusk.hw >= x0 && tusk.x - tusk.hw <= x1) out.push(tusk)
  if (!O.enabled) return out
  const pad = 2
  for (let i = Math.floor((x0 - pad) / O.every); i <= Math.ceil((x1 + pad) / O.every); i++) {
    const o = obstacleAt(i)
    if (o && o.x > FOREST_OPENING.gap.right + 8 && o.x + o.hw >= x0 && o.x - o.hw <= x1) out.push(o)
  }
  return out
}
