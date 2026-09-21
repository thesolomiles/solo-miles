/**
 * The ride scene — an orthographic auto-runner. When you pick a route from the
 * world selector, the town fades out and this mounts: the player and Leonard run
 * in place (facing north, up the road, backs to the camera) while the world
 * scrolls toward the camera, and Leonard chats about the route in a speech box.
 *
 * Everyone stays put; the ground dashes and the roadside props march toward the
 * camera and recycle — the classic endless-runner trick, kept cheap and flat to
 * match the town's low-poly look.
 */
export const RIDE = {
  /** World units/second the scenery moves toward the camera (+Z, down-screen). */
  scrollSpeed: 9.0,
  /** Anim ground-speed fed to the run clip so the legs cadence like a real run. */
  runSpeed: 6.6,
  /** Ortho ground-centre the shared OrthoRig locks onto during a ride. Negative =
   *  screen centre sits north of the runners, so they ride in the lower third and
   *  the road recedes ahead of them. */
  cameraCentreZ: -8,
  figureScale: 0.9, // match RiggedFigure SCALE (same size as in town)
  /** Runners' x offsets — player on the left, Leonard on his right. */
  playerX: -1.5,
  leonardX: 1.5,
  /** Runners' shared z — pulled up-screen (north) so they sit in the upper-middle
   *  of the frame (riding toward the camera, world receding behind them), well
   *  clear of the speech box. */
  runnerZ: -11,
  /** Half-width of the tarmac; grass runs out past it to the frame edge. */
  roadHalfWidth: 3.6,
  /** The road is a raised causeway — a tall slab sitting well proud of the grass,
   *  so its embankment sides catch shade and it throws a shadow onto the grass. */
  roadHeight: 0.45,
  /** Roadside pines reuse the main-map pine mesh, normalised to this height. */
  pineTargetH: 4.2,
  /** Recycle band along Z: props spawn at `far` (up-screen) and wrap once they
   *  pass `near` (below the camera). */
  spawnZ: -48,
  recycleZ: 22,
  /** Baseline cruising speed for the telemetry HUD (km/h); the live readout
   *  varies around this with the synthetic gradient. */
  baseSpeedKmh: 29,
} as const

/** Leonard's closing line, appended to every route's chat; advancing past it ends
 *  the ride and returns to town. */
export const RIDE_OUTRO_LINE = 'That was a great ride — let’s head back.'

/** Kit variants so the two ride riders read as two people. Leonard keeps the
 *  baked blue jersey / white helmet (no recolour); the player rides in a red
 *  jersey + black helmet. Hex sRGB — a recolour also tints the matching gloves
 *  (jersey) and socks/shoes (helmet), reading as a coherent alternate kit. See
 *  three/cyclist.ts. */
export const PLAYER_KIT = { jersey: '#cf3a2f', helmet: '#1c1c1c' } as const

/** Palette for the flat-shaded ride scenery (shared low-poly language). */
export const RIDE_COLORS = {
  grass: 0x8fab68,
  grassBlade: 0x7f9d52,
  shrub: 0x5f7d3f,
  road: 0x45444a,
  roadDark: 0x33323a, // mottled darker asphalt (texture speckle)
  roadLight: 0x55545c, // mottled lighter asphalt (texture speckle)
  edgeLine: 0xe9dcbd, // solid painted lines down each road edge
  dash: 0xf1e7cf,
  embankment: 0x7c5c3b, // dirt sides of the raised causeway
  verge: 0x8a7250,
  pine: 0x4e6138,
  pineLo: 0x5f7d3f,
  rock: 0x9a9186,
  sun: 0xffb066,
} as const
