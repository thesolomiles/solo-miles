/** Authored first lesson; all positions are along the walking trail (+X). */
export const FOREST_OPENING = {
  obstacles: [
    { x: 8, kind: 'rock' },
    { x: 23, kind: 'fallenTree' },
    { x: 38, kind: 'rock' },
  ] as const,
  gap: { left: 52, right: 58.8, depth: 2.4, back: -4.65, front: 45 },
  /** Give ordinary jumps a chance before the wisp decides to approach. */
  strandedSecs: 8,
  investigateSecs: 9,
  observeSecs: 3,
  demonstrationSecs: 4,
  /** Gesture first, then offer words only if the player still needs help. */
  hintDelaySecs: 8,
} as const

/** The cut extends toward the camera, exposing the hollow's cross-section. */
export function forestHollowBackAt(x: number): number {
  const g = FOREST_OPENING.gap
  const t = (x - (g.left + g.right) / 2) / ((g.right - g.left) / 2)
  return g.back + 1.2 * Math.min(1.35, t * t)
}

export function inForestHollow(x: number, z: number, margin = 0): boolean {
  const g = FOREST_OPENING.gap
  return x > g.left - margin && x < g.right + margin && z > forestHollowBackAt(x) - margin && z < g.front + margin
}

/** A foot still overlapping either lip is supported by the upper trail. */
export function forestFloorAt(x: number, halfWidth: number): number {
  const g = FOREST_OPENING.gap
  return x - halfWidth >= g.left && x + halfWidth <= g.right ? -g.depth : 0
}

/** Below the lips, the two banks are walls; jumping above them permits exit. */
export function constrainForestHollowX(x: number, y: number, halfWidth: number): number {
  const g = FOREST_OPENING.gap
  return y < -0.02 ? Math.max(g.left + halfWidth, Math.min(g.right - halfWidth, x)) : x
}

const smooth = (a: number, b: number, t: number) => {
  const k = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** Two distinct rises before landing, followed by a pause for the player. */
export function wispJumpDemonstration(t: number): number {
  const cycle = t % FOREST_OPENING.demonstrationSecs
  return (0.8 * smooth(0.6, 1, cycle) + 0.9 * smooth(1.3, 1.7, cycle)) * (1 - smooth(2, 2.7, cycle))
}
