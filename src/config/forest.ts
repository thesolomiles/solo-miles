import * as THREE from 'three'
import type { Interactable } from './town'

/**
 * The forest walk — a quiet, endless 2D side-on stroll through tall pines,
 * reached by the small trail cut into the town's south-east trees. No goal, no
 * damage, no HUD: walk left / right, jump, and Esc asks to go back to town.
 * Loosely Leonard's memory of the forest at the foot of a mountain on Japan's
 * rindō: tall slim trunks everywhere you look, quiet, light coming down
 * through the canopy.
 *
 * Town side: trail polyline + zone + prompt (SOUTH_TRAIL). Forest side: camera,
 * walking, palette and the scenery layers (FOREST). World code lives in
 * three/forest/.
 */

/** The town end: a dirt trail from the meadow behind the café into the trees. */
export const SOUTH_TRAIL = {
  /** Centre line (town x, z), meadow → into the trees. The last points run past
   *  the walkable end (collision stops you at z ≈ 20.9) so it reads as carrying
   *  on deeper into the forest. Trees within reach of it are cleared at load
   *  (systems/southTrail.ts). */
  line: [
    [12.6, 11.5],
    [13.4, 15],
    [14.5, 18.2],
    [15.2, 20.6],
    [16.0, 24],
    [16.4, 28],
  ] as [number, number][],
  /** Trail width (u) and how far it fades in at the meadow end. */
  width: 1.25,
  fadeIn: 2.2,
  /** Mossy green-brown — a secret path, mostly grown over (three/groundPaint.ts mixes in
   *  grass and a little bare dirt). */
  color: '#64703a',
  /** A tree is cleared when it stands within `clearBase + clearPerScale·scale`
   *  of the line (bigger pines have wider skirts). */
  clearBase: 0.9,
  clearPerScale: 0.45,
  /** Standing in this zone (config/zones.data.ts) at the trail's end offers
   *  the forest. */
  zoneId: 'zsouthtrail',
  /** Where you're put back on leaving the forest: at the trail mouth, so the
   *  walk out of the trees is the first thing you see. */
  returnPos: new THREE.Vector3(13.6, 0, 16.2),
  interact: {
    id: 'south-trail',
    name: 'Trail',
    role: '',
    verb: 'Follow',
    color: 0x54703a,
    radius: 0,
    lines: ['A small trail leads into a deep forest. Continue?'],
    choices: [
      { label: 'Yes', outcome: 'enterForest' },
      { label: 'No', outcome: 'dismiss' },
    ],
  } satisfies Interactable,
  /** Esc (or the back button) in the forest. */
  leave: {
    id: 'forest-leave',
    name: 'Forest',
    role: '',
    verb: 'Leave',
    color: 0x54703a,
    radius: 0,
    lines: ['Return to town?'],
    choices: [
      { label: 'Yes', outcome: 'leaveForest' },
      { label: 'No', outcome: 'dismiss' },
    ],
  } satisfies Interactable,
} as const

/** One depth band of trees. `every` = one tree slot per that many units, and
 *  `fill` the chance a slot has a tree. How fast a band scrolls past comes from
 *  its depth (FOREST.parallax). */
export interface ForestLayer {
  z: [number, number]
  every: number
  /** Chance a slot has a tree at all (gaps keep it from reading as a fence). */
  fill: number
  /** Trunk radius at the base (u) and height. */
  radius: [number, number]
  height: [number, number]
  bark: string
  /** Pine boughs near the top (the canopy). */
  boughs: boolean
}

export const FOREST = {
  /** Side-on camera, like Ninja Run's: pitched a touch down, never re-aimed;
   *  it only slides along x after Leonard. `zoom` > 1 = closer than town. */
  pitchDeg: 10,
  zoom: 1.15,
  camDist: 120,
  /** Camera x eases after the walker (per-second lerp) and leads him a little
   *  in the direction he's walking. */
  follow: 2.2,
  lead: 1.6,

  /** Things on the path. They block you (nothing hurts here) and you can stand
   *  on them. The small ones are a jump (Ninja Run's jump: NINJA_RUN height,
   *  gravity, buffer, one air-step double jump); anything `climbFrom` u tall or
   *  more can be climbed — walk or jump into its face and he climbs up and
   *  pulls himself over onto the top. A boulder can be double-jumped or
   *  climbed; an ancient skull is too tall to jump, so it's a climb.
   *  A slot every `every` u, `fill` of them used, none within `clearStart` of
   *  where you arrive; `p` = how often each kind turns up. */
  obstacles: {
    /** Off for now (Leonard, 2026-10-02: "we'll figure it out later"). The
     *  climbing and pull-up still work; flip this back on to bring them back. */
    enabled: false,
    every: 11,
    fill: 0.6,
    clearStart: 8,
    climbFrom: 2,
    kinds: {
      rock: { w: 0.95, h: 0.7, p: 0.3 },
      fallenTree: { w: 1.3, h: 1.05, p: 0.3 },
      boulder: { w: 1.7, h: 2.3, p: 0.25 },
      skull: { w: 3.6, h: 3.2, p: 0.15 },
    },
    colors: { rock: '#7b867a', moss: '#5f8a3a', bark: '#5c3f2d', wood: '#c09b6c', bone: '#d6cfb4', socket: '#2a2a22' },
  },
  /** Walker's half-width against obstacles. */
  walkerHalfW: 0.28,

  /** What he can do besides walk (Leonard, 2026-10-02): run and jump (with
   *  its air step), no crouch — that still works, just switched off. */
  moves: { run: true, jump: true, crouch: false },

  /** The wisp (three/forest/Wisps.tsx). It arrives in two steps (Leonard,
   *  2026-10-02): once he's `watchAt` u (m) from where he came in, it shows up
   *  far back among the trees (`watch`: at depth `z`, `scale`× its size),
   *  shy: it stays put there `still` s watching him (so as he walks it falls
   *  behind, the trunks sliding between them), and once it's lagged to `lag`
   *  of the half-frame right of centre it slips ahead in `catchUp` s, faint
   *  and looking away, to a new spot `x` share of the half-frame right of
   *  centre, `y` up. At `meetAt` u it zips out past the right edge
   *  (`outZip` s), waits `outWait` s unseen, and comes back along the path
   *  from the right, coyly (`meet`), to just in front of him, then leads as
   *  below.
   *  While he walks its way (right) it zips in and out of
   *  the frame ahead of him: in to a spot (`spotK` = share of the half-frame
   *  right of the camera's centre, so well ahead of him; `spotY` u up),
   *  hovers there `hold` s, then (`outChance` of the time) zips out past the
   *  edge (`outK` > 1, `outY` up) and stays out `away` s, or else just glides
   *  to a new spot — each zip an eased `zip` s glide (Leonard: less zippy).
   *  If he stops it waits; after `waitAfter` s it
   *  drifts closer over `closeIn` s (to `closest` u off; Leonard: not too
   *  near), then circles him (`orbitR` u out, `orbitSpeed` rad/s), arcing
   *  `orbitLift` u up over his head as it passes behind and in front. When he walks on it races back out in front.
   *  `follow`/`dart`/`rush` = how snappily it chases its target (per s). */
  wisp: {
    watchAt: 10,
    watch: {
      z: -20,
      scale: 0.8,
      x: [0.4, 0.8] as [number, number],
      y: [0.9, 2.1] as [number, number],
      still: [2.5, 5] as [number, number],
      lag: 0.1,
      catchUp: 1.3,
      outZip: 0.9,
      outWait: 0.8,
      /** Fading in when it first shows (s). */
      fadeIn: 1.8,
    },
    meetAt: 50,
    /** Its coy approach (Leonard): in from the right along the path, at
     *  `low`× its usual height, to `peekK` of the half-frame right of centre;
     *  pauses; shrinks back to `backK`; pauses; comes up to `ahead` u in front
     *  of him and says hello, staying `hold` s. `legs` = how long each of the
     *  first five steps takes (s). */
    meet: {
      ahead: 2.6,
      hold: 1.8,
      low: 0.55,
      peekK: 0.62,
      backK: 0.82,
      legs: [2.2, 1.6, 0.9, 1.4, 2.2] as [number, number, number, number, number],
    },
    height: 1.35,
    spotK: [0.45, 0.95] as [number, number],
    spotY: [0.6, 5.2] as [number, number],
    outK: 1.4,
    outY: [1.0, 6.5] as [number, number],
    hold: [2.4, 4.2] as [number, number],
    away: [0.8, 1.6] as [number, number],
    outChance: 0.45,
    zip: 0.85,
    waitAfter: 5,
    closeIn: 10,
    closest: 2.4,
    orbitR: 2.2,
    orbitSpeed: 0.9,
    /** How far it rises as it passes behind / in front of him (u). */
    orbitLift: 1.1,
    follow: 2.4,
    dart: 6,
    rush: 5.5,
    rushFor: 1.5,
  },

  /** Walk → run after `runAfter` s of holding a direction. The run is a
   *  gentle jog, slower than the town's (6.6): Leonard wants it unhurried. */
  walkSpeed: 3.2,
  runSpeed: 4.6,
  runAfter: 2.2,
  accel: 6,

  /** Background music volume (the track: assets/audio/southern-forest-bgm.m4a,
   *  see three/forest/ForestBgm). */
  bgmVolume: 0.2,

  palette: {
    // Leonard's references (2026-10-01): cool teal haze and shadow, warm gold
    // light, orange-red bark where the sun catches it, lime-bright ground in the
    // light, near-black foreground silhouettes, warm + a few cyan glows.
    /** Distance haze — also the backdrop, so the far trunks dissolve into it. */
    fog: '#3f7d70',
    ground: '#6a9a2a',
    path: '#b08a52',
    pathEdge: '#3e6a2c',
    bough: '#1d4634',
    fern: '#4f8a3a',
    rock: '#5f7a6c',
    /** Warm light through the canopy. */
    shaft: '#ffd27a',
    mote: '#ffd88a',
    /** The odd cool glow among the warm motes. */
    moteCool: '#8ff5e6',
  },

  /** Linear fog, as depth past the path (camDist). */
  fogNear: 6,
  fogFar: 62,

  /** Light: the forest is dense, so the sun comes from high overhead (a
   *  touch in front, so trunks still catch some warmth) and reaches the floor
   *  only through gaps in the canopy (`canopy`, below) — dappled pools of warm
   *  light in cool teal shade. */
  light: {
    sun: 5.2,
    sunColor: '#ffbe6a',
    sunDir: [-0.18, 1, 0.32] as [number, number, number],
    hemiSky: '#6fb3a3',
    hemiGround: '#16201a',
    hemi: 1.05,
    ambient: 0.16,
  },

  /** The canopy overhead: an unseen leaf layer that only casts shadow, so the
   *  sun lands as scattered pools. `open` = share of sky showing through; one
   *  tile of the pattern spans `tile` u (x, z) and repeats. */
  canopy: { y: 17, open: 0.2, tile: [26, 18] as [number, number] },


  /** Parallax. The camera is orthographic (Leonard is the same size as in
   *  town), so depth is faked: something at depth z scrolls past at
   *  `1 + z·back` of the path's pace behind it (z < 0) and `1 + z·front` in
   *  front of it — plus the fog. */
  parallax: { back: 0.0175, front: 0.064, min: 0.25 },

  /** Depth bands, back to front, all behind the path. (The foreground is the
   *  one dark strip below, `foreground`.) */
  layers: [
    { z: [-46, -34], every: 1.3, fill: 0.85, radius: [0.22, 0.34], height: [26, 30], bark: '#6f4a36', boughs: true },
    { z: [-28, -18], every: 1.7, fill: 0.8, radius: [0.26, 0.4], height: [26, 30], bark: '#734b36', boughs: true },
    { z: [-14, -7], every: 2.3, fill: 0.75, radius: [0.3, 0.45], height: [24, 28], bark: '#774c36', boughs: true },
    { z: [-5.5, -2.6], every: 3.4, fill: 0.7, radius: [0.32, 0.5], height: [22, 26], bark: '#7a4d36', boughs: true },
  ] satisfies ForestLayer[],

  /** Ferns + rocks along the far side of the path (not on it). */
  understory: { z: [-3.4, -1.6] as [number, number], every: 0.8, fill: 0.33 },
  /** Lush grass tufts along the far side of the path and back into the trees. */
  grass: { z: [-9.6, 0] as [number, number], every: 0.22, fill: 0.8, pathHalf: 1.05 },

  /** The foreground (Leonard's reference, 2026-10-02): one near-black strip of
   *  mounds, broad leaves, mushrooms, grass and fern fronds nearest the lens,
   *  filling the ground between you and the path, with a slightly lighter row
   *  behind it and a few warm specks in the dark. It scrolls past `rate`× the
   *  path's pace, painted like the rest. Heights are screen units with the path at 0 (the bottom of
   *  the frame is −3.2): solid dark below `base`, leaf tips up to `peak` (a
   *  touch over the path's front edge, so he's sometimes behind a leaf). One
   *  pattern tile spans `tile` u and repeats. */
  foreground: {
    rate: 1.5,
    base: -1.25,
    peak: 0.7,
    tile: 22,
    color: '#030807',
    back: '#11261f',
    speck: '#e0773e',
    specks: 16,
    /** Brushwork inside the dark (Leonard: textured like the rest): short
     *  strokes of a lifted green, a deeper black and a warm brown. */
    brush: ['#1f4033', '#000000', '#2e1c10'] as [string, string, string],
    strokes: 1600,
  },
  /** The trodden path the walker follows (z = 0). */
  pathHalf: 1.3,

  /** Light shafts through the canopy: a slot every `every` u, each at a depth
   *  in `z`, leaning `lean` rad (top tipped slightly toward the high sun). */
  shafts: {
    every: 6,
    fill: 0.65,
    z: [-18, -2] as [number, number],
    width: [2, 5] as [number, number],
    length: [15, 21] as [number, number],
    lean: 0.12,
    opacity: 1.5,
  },

  /** Rays that come down right on the path, so you walk through them: a pool
   *  of light on the trail under each, and a warm light that catches Leonard as
   *  he passes. A slot every `every` u. */
  pathShafts: {
    every: 9,
    fill: 0.75,
    width: [1.6, 2.8] as [number, number],
    length: [16, 20] as [number, number],
    opacity: 1.3,
    /** The warm light under the nearest one (intensity, reach in u). */
    light: 9,
    reach: 6,
  },

  /** Glowing motes drifting in the light. */
  motes: {
    count: 55,
    size: [0.1, 0.22] as [number, number],
    z: [-14, 4] as [number, number],
    y: [0.3, 8] as [number, number],
  },
} as const
