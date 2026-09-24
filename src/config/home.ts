import * as THREE from 'three'
import type { BoxCollider, Interactable, InteractZone } from './town'

/** Square collider around a potted plant's floor spot (three-space x, z). */
function plant(x: number, z: number, r = 0.28): BoxCollider {
  return { minX: x - r, maxX: x + r, minZ: z - r, maxZ: z + r }
}

/**
 * Leonard's home interior — a second interior "world", entered by pressing E on
 * the town house's door zone. Same mechanics as the café (config/cafe.ts): a
 * standalone Blender room (`~/Desktop/blender/home.blend` → public/models/home.glb,
 * exported as ONE merged mesh on the shared palette material), its own spawn,
 * soft bounds, colliders and an exit zone. Swapped in by `interior === 'home'`.
 *
 * Coordinate note: Blender (bx, by, bz) → three (bx, bz, −by). The room is
 * X[−5,5] × Z[−4,4]: back wall (TV, jerseys, bookshelf) at −Z, stairs up the
 * left wall (−X), and the open cutaway front at +Z. The gap in the low front
 * wall sits where the town house's front door is (right of centre), with the
 * doormat inside it — that's the way out. Plank tops are at y=0 (no floorDrop).
 */
export const HOME = {
  url: '/models/home.glb',

  /** The town interaction-zone id on the house's front door (zones.data.ts). */
  enterZoneId: 'z9mqziw',

  /** Spawn just inside the entrance, past the doormat, facing into the room. */
  spawn: new THREE.Vector3(1.0, 0, 2.8),

  /** Back in town: just south of the house door zone (x −9.7…−7, z −1.4…2.8),
   *  so the "Enter home" prompt doesn't re-trigger on arrival. */
  townReturn: new THREE.Vector3(-8.6, 0, 3.4),

  /** Walkable room (inside the walls; the low front wall is the south edge). */
  bounds: { minX: -4.75, maxX: 4.75, minZ: -3.75, maxZ: 3.75 },

  /** Ground half-extents the interior camera keeps on-screen (see OrthoRig). */
  frameHalfX: 6.6,
  frameHalfZ: 6.0,

  /** Fixed ground centre of the interior shot (three z). Pulled toward the back
   *  so the tall stairs/landing and the back wall stay in frame. */
  cameraCentreZ: -0.6,

  /** Furniture + plants (three-space AABBs). */
  colliders: [
    { minX: -5, maxX: -3.9, minZ: -2.6, maxZ: 2.65 }, // stairs + landing block
    { minX: -2.8, maxX: -2.0, minZ: -2.4, maxZ: -0.2 }, // Zwift bike + trainer
    { minX: -3.55, maxX: -1.25, minZ: -4, maxZ: -3.45 }, // TV console
    { minX: 1.95, maxX: 4.05, minZ: -4, maxZ: -3.5 }, // bookshelf
    { minX: 2.1, maxX: 4.0, minZ: -0.95, maxZ: 0.95 }, // dining table + chairs
    plant(-4.45, -3.45), // fiddle-leaf fig (back-left corner)
    plant(4.4, -3.45), // snake plant (back-right corner)
    plant(-1.05, -3.55, 0.25), // calathea on its stand
    plant(1.85, -3.6, 0.2), // small pot by the shelf
    plant(4.45, -1.4), // rubber plant (right wall)
    plant(4.4, 3.3), // snake plant (front-right)
    plant(2.35, 3.45, 0.22), // snake plant by the entrance
  ] as BoxCollider[],

  /** Interaction boxes inside the room (three-space AABBs). `home-exit` covers
   *  the doormat + the opening in the front wall; the rest open a `looks`
   *  dialogue below. Drag/resize them live with `?zones` inside the home, then
   *  Save — that rewrites this block (dev-server /__save-home-zones). */
  zones: [
    // Hand-drawn in ?zones inside the home (Leonard), saved from the editor.
    { id: "home-exit", verb: "Exit to town", minX: 0.3, maxX: 1.8, minZ: 3.1, maxZ: 4.3 },
    { id: "jersey-sg", verb: "Look", minX: -0.8, maxX: 0.1, minZ: -3.9, maxZ: -2.9 },
    { id: "jersey-ocbc", verb: "Look", minX: 0.5, maxX: 1.4, minZ: -3.9, maxZ: -2.9 },
    { id: "zwift", verb: "Look", minX: -3.4, maxX: -1.5, minZ: -2.7, maxZ: 0.3 },
  ] as InteractZone[],

  /** What pressing E in a zone says, by zone id: a portrait-less speech box.
   *  (Placeholder copy — Leonard to rewrite.) */
  looks: {
    'jersey-sg': {
      id: 'jersey-sg',
      name: 'Singapore jersey',
      role: 'framed on the wall',
      verb: 'Look',
      color: 0xc8342a,
      radius: 0,
      lines: ['My Singapore Cycling jersey, framed on the wall.'],
    },
    'jersey-ocbc': {
      id: 'jersey-ocbc',
      name: 'Nationals jersey',
      role: 'framed on the wall',
      verb: 'Look',
      color: 0xc8342a,
      radius: 0,
      lines: ['My OCBC National Championships jersey, with the medal hung over it.'],
    },
    zwift: {
      id: 'zwift',
      name: 'Zwift setup',
      role: 'the pain cave',
      verb: 'Look',
      color: 0xf07a1a,
      radius: 0,
      lines: [
        'The bike on the trainer, pointed at the TV.',
        'When the weather says no, the miles happen here on Zwift.',
      ],
    },
  } as Record<string, Interactable>,

  /** Zone id that returns to town (must match a box in `zones` above). */
  exitZoneId: 'home-exit',
} as const
