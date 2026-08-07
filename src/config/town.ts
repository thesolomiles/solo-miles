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
    body: 0xe08a3c,
    ear: 0xd47f34,
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
    waypoints: [
      new THREE.Vector3(10, 0, 10),
      new THREE.Vector3(10, 0, -10),
      new THREE.Vector3(-10, 0, -10),
      new THREE.Vector3(-10, 0, 10),
    ],
    speed: 6.5,
    pauseDistance: 4.2, // stops to chat when the player is this close
    jersey: 0x2f8f83,
    interact: {
      id: 'rider',
      name: 'Leonard',
      role: 'you, mid-ride',
      verb: 'Say hi',
      color: 0x2f8f83,
      radius: 3.2,
      lines: [
        "Oh hey — didn't expect to run into anyone out here!",
        'I do laps most days. Catch me and you get me; miss me and I’m off on the ride.',
        "That's the idea: the host isn't a menu item, he's just... around.",
      ],
    } satisfies Interactable,
  },
} as const

/** Circle colliders derived from buildings — used by the character controller. */
export interface Collider {
  x: number
  z: number
  r: number
}
export const COLLIDERS: Collider[] = BUILDINGS.filter((b) => b.built).map((b) => ({
  x: b.pos[0],
  z: b.pos[1],
  r: Math.max(b.size.w, b.size.d) * 0.6 + 0.4,
}))

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
