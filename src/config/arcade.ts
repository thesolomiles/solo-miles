/**
 * Café arcade — game-selector cards + Pac-Man maze. The café's `zhu6zu4`
 * "Play game" zone opens the selector; picking Pac-Man fades into this maze
 * (same ortho camera as the town/café, zoomed to fit).
 */

import type { MinigameId } from '../state/store'
import { CAMERA } from './constants'

export type ArcadeGameId = MinigameId | 'locked-1' | 'locked-2' | 'locked-3' | 'locked-5' | 'locked-6' | 'locked-7' | 'locked-8'

export interface ArcadeGame {
  id: ArcadeGameId
  title: string
  locked: boolean
  /** The minigame SELECT launches (unlocked games only). */
  minigame?: MinigameId
  /** Badge on the thumbnail. */
  badge?: 'current' | 'unlocked' | 'locked'
  thumb?: string
  /** Hero subtitle under the title in the selector. */
  tagline?: string
  thumbFrom?: string
  thumbTo?: string
}

export const ARCADE_GAMES: ArcadeGame[] = [
  {
    id: 'pacman',
    title: 'Pac-Man',
    locked: false,
    minigame: 'pacman',
    badge: 'unlocked',
    thumb: '/arcade-pacman.jpg',
    tagline: 'Clear the maze · dodge the ghosts',
  },
  {
    id: 'ninjarun',
    title: 'Ninja Run',
    locked: false,
    minigame: 'ninjarun',
    badge: 'unlocked',
    thumb: '/arcade-ninjarun.jpg',
    tagline: 'Jump the rocks · shuriken the ninjas',
  },
  { id: 'locked-1', title: 'Space Raid', locked: true, badge: 'locked', thumbFrom: '#2a3344', thumbTo: '#0d1218' },
  { id: 'locked-2', title: 'Brick Drop', locked: true, badge: 'locked', thumbFrom: '#3a2a44', thumbTo: '#120d18' },
  { id: 'locked-3', title: 'Neon Drift', locked: true, badge: 'locked', thumbFrom: '#1a3a3a', thumbTo: '#071212' },
  { id: 'locked-5', title: 'Sky Fort', locked: true, badge: 'locked', thumbFrom: '#2a3a55', thumbTo: '#0a1018' },
  { id: 'locked-6', title: 'Lava Rush', locked: true, badge: 'locked', thumbFrom: '#4a2218', thumbTo: '#140806' },
  { id: 'locked-7', title: 'Deep Mine', locked: true, badge: 'locked', thumbFrom: '#2a2818', thumbTo: '#0e0c08' },
  { id: 'locked-8', title: 'Star Dock', locked: true, badge: 'locked', thumbFrom: '#1c2040', thumbTo: '#080810' },
]

/**
 * A compact 19×17 maze — classic shape (side tunnels, four power pellets, a
 * centre ghost house) but small enough that the character reads big on screen
 * once the camera frames the whole board.
 *
 * `#` wall, `.` pellet, `o` power, `-` ghost door, space empty, `P` player
 * spawn, `B/N/I/C` ghost starts (Blinky waits above the door; Pinky/Inky/Clyde
 * start inside the house).
 */
export const PACMAN_MAZE = [
  '###################',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o...............o#',
  '#.##.##.###.##.##.#',
  '#....#...#...#....#',
  '####.#.#.#.#.#.####',
  '#......#...#......#',
  '#.####.#.B.#.####.#',
  '#.###..##-##..###.#',
  '......##NIC##......',
  '#.####.#####.####.#',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o..#....P....#..o#',
  '#.................#',
  '###################',
] as const

export const PACMAN = {
  cols: 19,
  rows: 17,
  // Bigger tiles = a bigger board in the frame (it pans when wider than the
  // viewport). The tiles/s speeds below are scaled so the *ground* pace (u/s) is
  // unchanged from the 0.9-tile tuning: ground = tiles/s × tile.
  tile: 1.2,
  /** He only ever runs (the town run clip) or stands — no walk gait in the maze. */
  playerSpeed: 3.38, // tiles/s → 4.05 u/s ground (same pace as the 0.9-tile build)
  ghostSpeed: 3.0, //   → 3.6 u/s ground
  frightenedSpeed: 2.25, // → 2.7 u/s ground
  eatenSpeed: 6.0, //   → 7.2 u/s ground
  frightenedSecs: 6,
  lives: 3,
  /** Half-extents the ortho camera clamps to, so the pan stops at the board edge
   *  when the maze is wider than the viewport. Board is cols/rows × tile; these
   *  are half that plus a little margin. */
  frameHalfX: 12.0,
  frameHalfZ: 10.8,
  /** Low walls: a tall block in this raking view hides the corridor behind it. */
  wallH: 0.5,
  // Match the town figure (RiggedFigure SCALE) so the character is the same size
  // in the maze as it is outside — the maze camera uses the town zoom to match.
  figureScale: 0.9,
} as const

export const GHOST_COLORS = {
  blinky: '#e23b3b',
  pinky: '#f48fb1',
  inky: '#4dd0e1',
  clyde: '#ffb74d',
  frightened: '#3d5afe',
} as const

/**
 * Ninja Run — a side-on endless runner through a bamboo forest, on the same
 * fixed ortho camera as the town (he runs toward screen-right, +X). The runner
 * stays at x = 0 and the world scrolls past him, so nothing drifts on a long run.
 *
 * Two kinds of thing come at him:
 *  - obstacles: immovable (rocks, logs, stumps). Low enough to jump; shuriken
 *    just clink off them.
 *  - enemies: rival ninjas. Too tall to jump — throw a shuriken (E).
 */
export const NINJA_RUN = {
  /** Scroll speed (u/s): starts here, ramps by `speedRamp` per second, capped. */
  speed: 7.5,
  speedRamp: 0.09,
  maxSpeed: 14,
  /** Jump: apex height (u) and gravity (u/s²). Air time = 2·√(2h/g). */
  jumpHeight: 1.7,
  gravity: 34,
  /** A press this close before landing still jumps on touchdown. */
  jumpBuffer: 0.12,
  /** Double jump: he steps on the air and jumps again, gaining this much
   *  height from wherever he is — leaving a puff of misty air where he stepped. */
  airJumps: 1,
  doubleJumpHeight: 1.4,
  airStepSecs: 0.7,
  /** Runner hitbox (feet at y, centred on x = 0), a touch smaller than the figure. */
  runnerHalfW: 0.28,
  runnerH: 1.55,
  /** Shuriken: screen speed (u/s, on top of the scroll), cooldown, launch height. */
  shurikenSpeed: 20,
  shurikenCooldown: 0.2,
  /** How far a star flies before it drops and sticks in the path. Shorter than
   *  the path any screen shows ahead (minAhead), so every kill happens on screen
   *  and spamming E can't clear ninjas you haven't seen yet. */
  shurikenRange: 10,
  /** Ammo: this many stars in hand, refilling one per `shurikenRecharge` s —
   *  spam them and you're empty when a ninja actually shows up. */
  shurikenMax: 3,
  shurikenRecharge: 1.5,
  shurikenY: 1.1,
  shurikenRadius: 0.2,
  /** Seconds a jump-throw takes to angle down to `shurikenY`. */
  shurikenDrop: 0.22,
  /** Things spawn just past the right edge and are culled past the left. */
  spawnX: 30,
  despawnX: -16,
  /** Gap between spawns, in seconds of travel at the current speed. The floor
   *  always leaves room to land from a jump and take off again. */
  gapMin: 0.95,
  gapMax: 1.9,
  /** Enemies only show up after this many metres, then at this share of spawns. */
  enemyAfter: 40,
  enemyChance: 0.38,
  /** Rival ninjas walk toward you a little (u/s), so they close faster. */
  enemyWalk: 1.2,
  /** False: enemies are too tall to jump (you must shoot). True: jumpable too. */
  enemiesJumpable: false,
  enemyScore: 25,
  /** Rival ninjas throw back (after this many metres, this share of them). A
   *  thrower winds up — a red glint in his hand — once he's between
   *  `enemyThrowFrom` and `enemyThrowTo` ahead (always on screen: ≤ minAhead),
   *  just past your star's reach — so you can only interrupt him if you're
   *  quick — then lets fly a star low along the path: jump it, or meet it with
   *  your own (sparks). */
  enemyThrowAfter: 100,
  enemyThrowChance: 0.6,
  enemyThrowFrom: 13,
  enemyThrowTo: 11,
  enemyWindup: 0.35,
  /** Their star's speed toward you, on top of the scroll (u/s). */
  foeStarSpeed: 9,
  /** Bonus for knocking one of their stars out of the air. */
  parryScore: 10,
  sparkSecs: 0.45,
  /** Seconds of stumble before the game-over panel. */
  dieSecs: 0.9,
  /** Camera: its own fixed side-on shot (not the town's ¾ tilt — from up there
   *  the crouched ninja-run reads as crawling). Same ortho zoom, so he's the same
   *  size as in town. It looks at height `lookY` over the path from `pitchDeg`
   *  above level, and never moves while you play. The runner sits `leadFrac` of
   *  the half-width left of centre (most of the screen is road ahead), capped at
   *  `maxLead`. */
  pitchDeg: 8,
  /** Zoomed in past the town's framing: side-on, the crouched ninja-run figure
   *  is tiny at town zoom. >1 = closer (less road visible ahead). */
  zoom: 1.3,
  /** …but never less than this much path visible ahead of him (u): on a
   *  portrait phone the view zooms back out until it fits. */
  minAhead: 13,
  lookY: 3.4,
  // Far enough back that the camera itself sits above the ground plane at the
  // bottom of the frame, even zoomed out on a tall phone (an ortho camera's
  // distance doesn't change the framing, only what's in front of it).
  camDist: 120,
  leadFrac: 0.5,
  maxLead: 9,

  figureScale: 0.9,
} as const

/**
 * Ninja Run's night look (after Leonard's Nano Banana reference): a dark
 * teal/slate fog swallowing the grove, faint cold moonlight, bioluminescent
 * mushrooms + moss as cool light anchors, and stone lanterns (tōrō) glowing warm
 * orange against it. Colours are sRGB hex; glow strengths are emissive
 * multipliers (> 1 blooms on desktop).
 */
export const NINJA_NIGHT = {
  /** Fog + the horizon of the sky backdrop (they must match). */
  fog: '#2a3d43',
  skyTop: '#0b1316',
  /** Linear fog band, as view depth past the path (camDist): the path + runner
   *  stay crisp, the back of the grove is nearly swallowed. */
  fogNear: -1,
  fogFar: 30,
  ambient: { color: '#6f8f9a', intensity: 0.14 },
  hemisphere: { sky: '#5a7f8c', ground: '#0d1512', intensity: 0.3 },
  /** Cold moonlight from behind-left, rimming everything through the fog. */
  moon: { color: '#8fc3d4', intensity: 1.1, position: [-9, 16, -8] as const },
  /** Barely-there front fill. Kept low on purpose: the runner should read as a
   *  silhouette, caught only by the moon and the forest's own lights (lanterns,
   *  mushrooms) as he passes them. */
  fill: { color: '#9fb8c4', intensity: 0.12, position: [4, 6, 14] as const },
  /** Moonlit edge on hazards (obstacles + ninjas) so they pop out of the dark —
   *  a fresnel rim, not a light, so only the things that can hit you get it. */
  hazardRim: { color: '#a8dcec', strength: 1.2, power: 2.6 },
  /** …plus a pale outline (a back-face shell pushed out along the normals) all
   *  the way round, so even a rock facing the camera keeps its shape. */
  hazardOutline: { color: '#7fb3c2', width: 0.04 },

  bamboo: { culm: '#2b3438', ring: '#1d2528', leaf: ['#2f3b3f', '#262f33'] },
  ground: '#1d2b23',
  path: '#3a483f',
  paver: '#5f6a62',
  shrub: '#1f2d24',
  grass: '#26372b',
  boulder: '#262f2e',

  mushroom: { color: '#7ff4ff', glow: 2.6 },
  moss: { color: '#3fe0b8', glow: 1.1 },
  /** Glow-mushroom clusters per scenery tile (48u). */
  mushrooms: 9,
  lantern: { stone: '#565c58', light: '#ffae55', glow: 3.0 },
  /** Real point lights: they follow the nearest lanterns / mushroom clusters. */
  lanternLight: { intensity: 4.5, distance: 7 },
  mushroomLight: { color: '#6fe8ff', intensity: 2.2, distance: 4.5 },
  /** Drifting fog wisps (u/s, on top of the scroll). */
  wispDrift: 0.35,
  wispColor: '#58767d',

  /** The thing watching from back in the grove (as on the thumbnail): one big
   *  amber animal eye with a slit pupil, high up and far back among the bamboo
   *  — a creature much bigger than him, watching and trying not to be seen. It
   *  gives off no light: it only shows where a lantern or a glow-mushroom
   *  cluster reaches it, in that light's colour, through drifting mist. It's
   *  only ever a glimpse: the lids part, it holds a moment, shuts and is gone. */
  eye: {
    /** Iris round the pupil → toward its rim; the dark of the pupil. */
    color: '#ffd24a',
    rim: '#a8521a',
    dark: '#0b0d0a',
    /** How far a lantern / a mushroom cluster can light it (u), and how strongly. */
    lanternRange: 10.5,
    mushroomRange: 7.5,
    gain: 1.6,
    /** How much its depth behind a light counts toward that distance (< 1: the
     *  light carries back through the stalks). */
    depthFade: 0.3,
    /** How much of the light's own colour it takes on (0 = stays amber, 1 = fully tinted). */
    tint: 0.4,
    /** Overall opacity; the share of fog colour always mixed in (on top of the
     *  fog its depth gives it); and how much the drifting mist patches hide. */
    opacity: 0.85,
    mist: 0.15,
    veil: 0.7,
    /** Eye width corner to corner (u) at scale 1, and the scale range it picks from. */
    width: 3.2,
    scale: [0.7, 1.1] as const,
    /** Height of the eye (he's ~1u tall — this is a big animal), and how deep
     *  in the grove it stands: behind the first rows of bamboo, which pass in
     *  front of it; deeper = foggier. */
    y: [3.6, 5.6] as const,
    z: [-8, -15] as const,
    /** The light it opens by must be this far ahead of the view's centre
     *  (shares of the half-width); it stands this far to one side of that light (u). */
    ahead: [0.2, 0.95] as const,
    lag: [0.5, 3.5] as const,
    /** Most it slants either way (rad). */
    tilt: 0.16,
    /** Seconds before the first one, between glimpses, and held open. */
    first: 7,
    gap: [7, 20] as const,
    glimpse: [0.7, 1.6] as const,
    /** Chance it shows again moments later (after `againGap` s) by another light. */
    again: 0.3,
    againGap: [0.5, 1.4] as const,
    /** Chance a glimpse includes a blink. */
    blinkChance: 0.4,
    /** Pupil half-width: as the lids part → once it's narrowed. */
    slit: [0.17, 0.06] as const,
    /** How far the pupil turns toward him, and how far it flicks about (eye units). */
    gaze: 0.16,
    dart: 0.06,
  },
} as const

/**
 * Ninja Run framing for a viewport aspect: ortho view height `h`, visible
 * half-width `halfX`, and `lead` — how far right of the runner (x = 0) the camera
 * centres. Shared by OrthoRig and the scenery (whose lights track the view).
 */
export function ninjaView(aspect: number) {
  const h = Math.max(
    CAMERA.worldViewHeight / NINJA_RUN.zoom,
    // path ahead = halfX·(1 + leadFrac); keep it ≥ minAhead on narrow screens
    (2 * NINJA_RUN.minAhead) / ((1 + NINJA_RUN.leadFrac) * aspect),
  )
  const halfX = (h * aspect) / 2
  return { h, halfX, lead: Math.min(halfX * NINJA_RUN.leadFrac, NINJA_RUN.maxLead) }
}

export type NinjaObstacleKind = 'rock' | 'log' | 'stump'

/** Obstacle footprints (width along the run, height). All clearable by a jump. */
export const NINJA_OBSTACLES: Record<NinjaObstacleKind, { w: number; h: number }> = {
  rock: { w: 0.95, h: 0.7 },
  log: { w: 1.5, h: 0.55 },
  stump: { w: 0.6, h: 0.95 },
}

/** Rival ninja hitbox. Taller than the jump apex + runner, so it can't be cleared. */
export const NINJA_ENEMY = { w: 0.6, h: 2.0 }
