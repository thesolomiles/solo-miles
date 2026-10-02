import { FOREST } from '../../config/forest'
import { hash3 } from './forestAssets'

export type ObstacleKind = keyof typeof FOREST.obstacles.kinds

export interface Obstacle {
  /** Slot index (stable id). */
  i: number
  kind: ObstacleKind
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
  if (!O.enabled) return out
  const pad = 2
  for (let i = Math.floor((x0 - pad) / O.every); i <= Math.ceil((x1 + pad) / O.every); i++) {
    const o = obstacleAt(i)
    if (o && o.x + o.hw >= x0 && o.x - o.hw <= x1) out.push(o)
  }
  return out
}
