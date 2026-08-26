/**
 * Café arcade — game-selector cards + Pac-Man maze. The café's `zhu6zu4`
 * "Play game" zone opens the selector; picking Pac-Man fades into this maze
 * (same ortho camera as the town/café, zoomed to fit).
 */

export type ArcadeGameId = 'pacman' | 'locked-1' | 'locked-2' | 'locked-3' | 'locked-4' | 'locked-5' | 'locked-6' | 'locked-7' | 'locked-8'

export interface ArcadeGame {
  id: ArcadeGameId
  title: string
  locked: boolean
  /** Badge on the thumbnail. */
  badge?: 'current' | 'unlocked' | 'locked'
  thumb?: string
  thumbFrom?: string
  thumbTo?: string
}

export const ARCADE_GAMES: ArcadeGame[] = [
  {
    id: 'pacman',
    title: 'Pac-Man',
    locked: false,
    badge: 'unlocked',
    thumb: '/arcade-pacman.jpg',
  },
  { id: 'locked-1', title: 'Space Raid', locked: true, badge: 'locked', thumbFrom: '#2a3344', thumbTo: '#0d1218' },
  { id: 'locked-2', title: 'Brick Drop', locked: true, badge: 'locked', thumbFrom: '#3a2a44', thumbTo: '#120d18' },
  { id: 'locked-3', title: 'Neon Drift', locked: true, badge: 'locked', thumbFrom: '#1a3a3a', thumbTo: '#071212' },
  { id: 'locked-4', title: 'Forest Run', locked: true, badge: 'locked', thumbFrom: '#24351c', thumbTo: '#0c1208' },
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
  tile: 0.9,
  /** He only ever runs (ninja-run) or stands — no walk gait in the maze. */
  playerSpeed: 5.0, // tiles / second
  ghostSpeed: 4.4,
  frightenedSpeed: 3.0,
  eatenSpeed: 8,
  frightenedSecs: 6,
  lives: 3,
  /** Half-extents the ortho camera must keep on-screen (ground plane). */
  frameHalfX: 9.2,
  frameHalfZ: 8.3,
  /** Low walls: a tall block in this raking view hides the corridor behind it. */
  wallH: 0.5,
  figureScale: 0.52,
} as const

export const GHOST_COLORS = {
  blinky: '#e23b3b',
  pinky: '#f48fb1',
  inky: '#4dd0e1',
  clyde: '#ffb74d',
  frightened: '#3d5afe',
} as const
