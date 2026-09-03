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
  /** Tiled field plots (rice / tea / crops) filling one side (rider-relative). */
  farmland?: 'left' | 'right'
  /** Roadside prop density multiplier (1 = default). <1 = open and airy / sparse. */
  density?: number
  /** Occasional lit street furniture (lamps + a rare traffic light) along the road. */
  streetFurniture?: boolean
  /** Occasional small buildings scattered back from both sides of the road. */
  buildings?: boolean
}

export const RIDE_SCENES: Record<string, RideScene> = {
  // Jeju round island — a coastal round-the-island ride. Tiled farmland plots and
  // a light scatter of trees on the left, sandy beach + calm blue sea on the
  // right, sparse lit street furniture and the odd small coastal house, open and
  // airy. (Source: the climb's Notion "three.js Description", tuned with Leonard —
  // farmland on the left reads truer to Jeju's coast than a solid forest.)
  'jeju-round': {
    beach: 'right',
    farmland: 'left',
    forest: 'left',
    density: 0.28, // coastal Jeju is very open — sparse trees/scrub
    streetFurniture: true,
    buildings: true,
  },
}
