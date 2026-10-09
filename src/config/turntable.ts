import route68 from '../../assets/audio/records/route-68.m4a'
import sakuraDreaming from '../../assets/audio/records/sakura-dreaming.m4a'
import southernForest from '../../assets/audio/records/southern-forest.m4a'

/**
 * The home's record player: a low console on the east edge of the lounge rug,
 * facing the L-sofa, with a speaker at each end (three/Turntable.tsx). E on its
 * zone (HOME.zones `turntable`) opens the record crate (ui/RecordsModal.tsx).
 *
 * Off on every visit; a record plays through to the next one, wrapping round.
 * Leaving the house stops it (back to the town's own ambience). Volume is
 * highest by the speakers and never fully silent anywhere in the room. The
 * AC hum (HomeAmbience) carries on underneath at its usual level.
 *
 * Coordinates are home three-space (see config/home.ts).
 */
export const TURNTABLE = {
  /** Must match the `turntable` box in HOME.zones. */
  zoneId: 'turntable',

  /** Console centre on the floor; it runs along z (long side faces the sofa, west). */
  console: { x: -2.15, z: 3.9, length: 2.0, depth: 0.5, height: 0.55 },
  /** Speaker floor positions, toed in toward the sofa. */
  speakers: [
    { x: -2.15, z: 2.55 },
    { x: -2.15, z: 5.2 },
  ],

  audio: {
    /** Gain right by a speaker. */
    max: 0.5,
    /** Gain at the far side of the room (fraction of max): never silent indoors. */
    floor: 0.32,
    /** Full volume within this distance of the nearest speaker (m)… */
    near: 1.3,
    /** …easing down to `floor` by this distance. */
    far: 9,
    /** Left/right pan: how far east of the console counts as hard-left (m), and the cap. */
    panSpan: 7,
    panMax: 0.55,
  },
}

export interface Vinyl {
  id: string
  title: string
  /** Square trip photo, printed on the picture disc (public/records/). */
  cover: string
  src: string
  /** Loudness match: the Suno exports differ by ~3 dB, evened out to about −16 dBFS RMS. */
  gain: number
}

// Leonard's Suno BGMs (from his YT videos), 128 kbps AAC. Sources + full-size
// photos: assets/turntable songs/. Covers are square crops, 640 px.
export const RECORDS: Vinyl[] = [
  { id: 'route-68', title: 'Route 68', cover: '/records/route-68.jpg', src: route68, gain: 0.81 },
  { id: 'sakura-dreaming', title: 'Sakura Dreaming', cover: '/records/sakura-dreaming.jpg', src: sakuraDreaming, gain: 0.92 },
  { id: 'southern-forest', title: 'Southern Forest', cover: '/records/southern-forest.jpg', src: southernForest, gain: 1.18 },
]
