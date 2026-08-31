/**
 * Per-route scene composition for the ride auto-runner. The ride world is built
 * from reusable kits (roadside forest, and — new — the Beach kit); this maps a
 * route id to which kits it uses and on which side, so each climb's scenery
 * reflects the real place instead of a generic forest.
 *
 * Sides are **rider-relative** ("beach on the rider's right"), taken from the
 * `# three.js Description` note on each climb's Notion page. RideWorld converts
 * them to screen sides. Routes with no entry here keep the default forest look.
 */
export interface RideScene {
  /** Sandy beach + sea down one side of the road (rider-relative). */
  beach?: 'left' | 'right'
  /** Restrict the roadside forest to one side (rider-relative); omit = both. */
  forest?: 'left' | 'right'
}

export const RIDE_SCENES: Record<string, RideScene> = {
  // Jeju round island — trees on the left, sandy beach + sea on the right.
  // (Source: the climb's Notion "three.js Description".)
  'jeju-round': { beach: 'right', forest: 'left' },
}
