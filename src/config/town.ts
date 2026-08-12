import * as THREE from 'three'

/**
 * The town, as data. Everything about the layout lives here so that adding or
 * moving a building later is a config edit, not a refactor (brief guardrail).
 * Positions, colours, sizes and dialogue are lifted from the approved
 * `solomiles-town-ortho` prototype.
 *
 * Colours are hex numbers (three.js material colours). The UI converts to CSS
 * where it needs to (e.g. the dialogue accent dot).
 */

export type SectionId = 'about' | 'cycling' | 'travel' | 'contact' | 'story'

/**
 * What choosing a dialogue option does.
 * - `dismiss`  — just close the dialogue.
 * - `sendBack` — close, then send the player back to the bridge, facing town.
 */
export type ChoiceOutcome = 'dismiss' | 'sendBack'

/** A branch offered at the end of a dialogue (Leonard's "go for a ride?"). */
export interface DialogueChoice {
  label: string
  outcome: ChoiceOutcome
}

/** A thing the player can walk up to and press E on. */
export interface Interactable {
  id: string
  name: string
  role: string
  verb: string
  color: number
  lines: string[]
  radius: number
  /** If set, the dialogue offers to open this content section. NPCs omit it. */
  section?: SectionId
  /** If set, the last line ends with a choice instead of a "Continue". */
  choices?: DialogueChoice[]
}

export interface BuildingDef {
  id: string
  pos: [number, number] // x, z (all buildings face +z, toward the camera)
  size: { w: number; d: number; h: number }
  wall: number
  roof: number
  /** True once the building is modelled in town.glb — drives collision. */
  built?: boolean
  props: {
    chimney?: boolean
    smoke?: boolean
    awning?: number // awning colour
    stripe?: number // awning stripe colour
    bikeSign?: boolean
    parkedBike?: boolean
    flowers?: number // flower colour
  }
  interact: Interactable
}

/** World-scale layout constants. */
export const WORLD = {
  groundRadius: 48, // visible ground disc
  boundary: 37, // how far from the plaza the player can roam
  plazaRadius: 8,
  // forest ring
  forestRings: 3,
  forestInner: 39, // boundary + 2
  trailGap: [Math.PI * 1.42, Math.PI * 1.72] as [number, number], // where the trail breaks through
  fog: { color: 0xc3dbe2, near: 55, far: 130 },
  sky: { top: '#a6cfe1', mid: '#cfe3df', bottom: '#f4e7cf' },
  ground: 0x8fab68,
} as const

export const DEFAULT_BUILDING_HEIGHT = 3.2

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'casa',
    pos: [-22, -4],
    size: { w: 5.2, d: 5, h: DEFAULT_BUILDING_HEIGHT },
    wall: 0x8fa9be,
    roof: 0x50596b,
    built: true,
    props: { chimney: true, parkedBike: true },
    interact: {
      id: 'casa',
      name: 'Mi casa',
      role: 'home base',
      verb: 'Go in',
      color: 0x50596b,
      radius: 3.0,
      section: 'about',
      lines: [
        'Home base. Where a visitor lands — who you are, what Solomiles is.',
        "That's my bike out front. Fitting, since it all started on two wheels.",
        'In the real build, stepping in opens your About.',
      ],
    },
  },
  {
    id: 'mom',
    pos: [-22, 20],
    size: { w: 5, d: 4.6, h: DEFAULT_BUILDING_HEIGHT },
    wall: 0xf1e3c6,
    roof: 0xb4553f,
    props: { chimney: true, smoke: true, flowers: 0xe06a86 },
    interact: {
      id: 'mom',
      name: "Mom's house",
      role: 'the family corner',
      verb: 'Knock',
      color: 0xb4553f,
      radius: 3.0,
      section: 'story',
      lines: [
        '*knock knock* — the cosy one, smoke always curling from the chimney.',
        'A warm corner: the story behind the channel, the people in it.',
        'Every town needs a home you can always go back to.',
      ],
    },
  },
  {
    id: 'cafe',
    pos: [22, -4],
    size: { w: 5.4, d: 4.8, h: DEFAULT_BUILDING_HEIGHT },
    wall: 0xd98a5a,
    roof: 0x7a5238,
    built: true,
    props: { awning: 0xc0503a, stripe: 0xf4ead3 },
    interact: {
      id: 'cafe',
      name: 'The café',
      role: 'pull up a chair',
      verb: 'Enter',
      color: 0x7a5238,
      radius: 3.0,
      section: 'contact',
      lines: [
        'Grab a seat outside. The social corner — a guestbook, or where people reach you.',
        "Coffee's always on. Good place to leave a note.",
        'Contact, comments, community — whatever the café becomes.',
      ],
    },
  },
  {
    id: 'shop',
    pos: [22, 20],
    size: { w: 5.4, d: 5, h: DEFAULT_BUILDING_HEIGHT },
    wall: 0x9bae77,
    roof: 0x4e6138,
    props: { bikeSign: true },
    interact: {
      id: 'shop',
      name: 'Bike shop',
      role: 'rides & gear',
      verb: 'Browse',
      color: 0x4e6138,
      radius: 3.0,
      section: 'cycling',
      lines: [
        'The workshop. Everything cycling — rides, routes, the gear I use.',
        'Your Zwift roots and ride logs sit here, front and centre.',
        'Wheel out front, door always open.',
      ],
    },
  },
]

/** The forest trail — a signpost + an interactable just in front of it. */
export const TRAIL = {
  // The north road out of town, just before it disappears into the forest.
  signpostPos: [0, -32] as [number, number],
  interactPos: new THREE.Vector3(0, 0, -32),
  // Just north of the bridge (deck spans z −21…−15 in town.glb). After the chat
  // with Leonard, the player rides back down to here, facing town — a smooth
  // move, not a teleport.
  returnPos: new THREE.Vector3(0, 0, -22),
  interact: {
    id: 'trail',
    name: 'The trail',
    role: 'out into the trips',
    verb: 'Follow',
    color: 0x54703a,
    radius: 3.2,
    section: 'travel' as SectionId,
    lines: [
      'The path slips out of town and into the trees...',
      'The travel side lives here — the cycling and hiking trips, Japan, Korea, the road out.',
      'For now it fades into the forest. In the real build it carries you into the videos.',
    ],
  } satisfies Interactable,
} as const

/** Moving-actor definitions (positions are runtime state; see the components). */
export const ACTORS = {
  mews: {
    id: 'mews',
    home: new THREE.Vector3(-11, 0, 11),
    wanderRadius: 4,
    speed: 0.9,
    yawOffset: 0, // rotation so the model's nose aligns with its heading
    interact: {
      id: 'mews',
      name: 'Mews',
      role: 'the ginger boss',
      verb: 'Pet',
      color: 0xe08a3c,
      radius: 2.4,
      lines: [
        'Mrrp. *he blinks slowly at you*',
        'The town’s actual owner. Everyone else just lives here.',
        '*flops into a patch of sun, thoroughly done with you*',
      ],
    } satisfies Interactable,
  },
  rider: {
    id: 'rider',
    // At the very end of the trail, centred where the path meets the forest.
    post: new THREE.Vector3(0, 0, -30.5),
    jersey: 0x2f8f83,
    interact: {
      id: 'rider',
      name: 'Leonard',
      role: 'up for a ride',
      verb: 'Talk',
      color: 0x2f8f83,
      radius: 3.6,
      lines: ['Hey there! You wanna go for a ride?'],
      // For now both answers send you back down toward town; "Yes" hooks into a
      // real ride later.
      choices: [
        { label: 'Yes', outcome: 'sendBack' },
        { label: 'No', outcome: 'sendBack' },
      ],
    } satisfies Interactable,
  },
} as const

/**
 * Colliders for the character controller. Circles are derived from built
 * buildings; boxes (AABBs) block the river and the two construction sites.
 */
export interface CircleCollider {
  x: number
  z: number
  r: number
}
export interface BoxCollider {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}
export type Collider = CircleCollider | BoxCollider

/**
 * Colliders for the two construction sites — one per PILE, not one big box over
 * the whole pad (that walled off the open dirt between piles → invisible walls).
 * Positions are the Blender Construction props mapped to world: shop props at
 * (22 + 2·px, 20 − 2·py), mom's at (−22 + 2·px, 20 − 2·py). Kept snug/slightly
 * small so the player bumps the visible pile, never empty ground. Small stuff
 * (cones, buckets, footings, ladder, offcuts) is left walkable. Remove a site's
 * entries once a real house is built on the pad and set its `built: true` above.
 */
const SITE_COLLIDERS: Collider[] = [
  // --- bike-shop site ---
  { minX: 18.2, maxX: 19.4, minZ: 21.2, maxZ: 24.0 }, // brick pile
  { x: 25.2, z: 22.8, r: 0.85 }, // cinder blocks
  { minX: 17.6, maxX: 19.6, minZ: 16.3, maxZ: 18.5 }, // cement bags on pallet
  { minX: 23.6, maxX: 26.4, minZ: 16.5, maxZ: 18.3 }, // scaffold
  { x: 18.2, z: 20.2, r: 1.0 }, // gravel heap
  { minX: 20.7, maxX: 23.3, minZ: 22.8, maxZ: 24.8 }, // tarp pile
  { x: 20.8, z: 23.8, r: 0.55 }, // wheelbarrow
  { x: 23.2, z: 16.8, r: 0.7 }, // sawhorse
  // --- mom's site ---
  { minX: -20.0, maxX: -17.2, minZ: 21.0, maxZ: 24.2 }, // lumber pile
  { minX: -25.7, maxX: -24.7, minZ: 20.5, maxZ: 25.1 }, // sawhorse + plank
  { minX: -19.9, maxX: -17.7, minZ: 16.0, maxZ: 18.4 }, // cement bags on pallet
  { x: -25.6, z: 17.0, r: 1.0 }, // sand heap
  { x: -21.2, z: 23.8, r: 0.55 }, // wheelbarrow
]

/**
 * The river (world z ≈ −23.4…−12.6, full width) as two banks with a gap at the
 * bridge (deck spans x ≈ −3.2…3.2) so the player can only cross on the bridge.
 * Outer extents are capped past the roam boundary; the gap is a touch narrower
 * than the deck to keep the player off the rails.
 */
const WATER_COLLIDERS: BoxCollider[] = [
  { minX: -42, maxX: -3.0, minZ: -23.6, maxZ: -12.4 }, // west of the bridge
  { minX: 3.0, maxX: 42, minZ: -23.6, maxZ: -12.4 }, // east of the bridge
]

export const COLLIDERS: Collider[] = [
  ...BUILDINGS.filter((b) => b.built).map(
    (b): CircleCollider => ({
      x: b.pos[0],
      z: b.pos[1],
      r: Math.max(b.size.w, b.size.d) * 0.6 + 0.4,
    }),
  ),
  ...SITE_COLLIDERS,
  ...WATER_COLLIDERS,
]

/**
 * Ambient construction workers on the two sites. Each runs a little behavior
 * loop (idle → walk a few steps → kneel down → work → stand up → repeat; see
 * Worker.tsx) around its `pos`, so the sites look worked rather than staged.
 * Purely decorative: no collider, no interactable. `pos` is the home spot the
 * worker roams around (world x,z); `rot` is its starting yaw (0 = facing the
 * camera, +Z); `phase` (0–1) staggers the loop so they're not in lockstep.
 * Positions sit in the gaps between the prop piles (see the Blender Construction
 * layout). Remove a site's workers when a real house replaces it.
 */
export interface WorkerDef {
  pos: [number, number] // world x, z — home spot the worker roams around
  rot: number
  phase?: number
}
export const WORKERS: WorkerDef[] = [
  // Bike-shop site (props span x ≈ 17…26.5, z ≈ 15.5…25.2)
  { pos: [24.4, 23.6], rot: -2.2, phase: 0.0 },
  { pos: [18.6, 21.4], rot: 0.7, phase: 0.3 },
  { pos: [22.2, 26.6], rot: 0.1, phase: 0.6 },
  // Mom's site (props span x ≈ -26.8…-16.4, z ≈ 15.7…25.2)
  { pos: [-19.0, 23.6], rot: 2.2, phase: 0.15 },
  { pos: [-25.0, 21.4], rot: -0.7, phase: 0.45 },
  { pos: [-21.6, 26.6], rot: -0.1, phase: 0.75 },
]

/** Static interactable world positions (front / near side of each building). */
export function buildingInteractPos(b: BuildingDef): THREE.Vector3 {
  return new THREE.Vector3(b.pos[0], 0, b.pos[1] + b.size.d / 2 + 1.4)
}

/** Section metadata for the content overlays (real content lands in Phase 4). */
export const SECTIONS: Record<SectionId, { title: string; blurb: string }> = {
  about: { title: 'About', blurb: 'Who you are, and what Solomiles is.' },
  cycling: { title: 'Cycling', blurb: 'Zwift roots, rides, routes, and the gear.' },
  travel: { title: 'Travel', blurb: 'Trips on bike and on foot — Japan, Korea, the road out.' },
  contact: { title: 'Contact', blurb: 'Guestbook, comments, community — pull up a chair.' },
  story: { title: 'The story', blurb: 'The people and the story behind the channel.' },
}
