import * as THREE from 'three'
import type { BoxCollider, Interactable, InteractZone } from './town'

/**
 * Leonard's home interior — a second interior "world", entered by pressing E on
 * the town house's door zone. Same mechanics as the café (config/cafe.ts): a
 * standalone Blender room (`~/Desktop/blender/home.blend` → public/models/home.glb,
 * exported as ONE merged mesh on the shared palette material), its own spawn,
 * soft bounds, colliders and an exit zone. Swapped in by `interior === 'home'`.
 *
 * Coordinate note: Blender (bx, by, bz) → three (bx, bz, −by). The room is
 * X[−7,7] × Z[−7,7] (the café's size): back wall (TV, jerseys, bookshelf) at −Z, stairs up the
 * left wall (−X), and the open cutaway front at +Z. The gap in the low front
 * wall sits where the town house's front door is (right of centre), with the
 * doormat inside it — that's the way out. Plank tops are at y=0 (no floorDrop).
 */
export const HOME = {
  url: '/models/home.glb',

  /** The town interaction-zone id on the house's front door (zones.data.ts). */
  enterZoneId: 'z9mqziw',

  /** Spawn just inside the entrance, past the doormat, facing into the room. */
  spawn: new THREE.Vector3(1.1, 0, 5.8),

  /** Back in town: just south of the house door zone (x −9.7…−7, z −1.4…2.8),
   *  so the "Enter home" prompt doesn't re-trigger on arrival. */
  townReturn: new THREE.Vector3(-8.6, 0, 3.4),

  /** Walkable room (inside the walls; the low front wall is the south edge). */
  bounds: { minX: -6.75, maxX: 6.75, minZ: -6.75, maxZ: 6.75 },

  /** Ground half-extents the interior camera keeps on-screen (see OrthoRig).
   *  Same 14×14 room as the café, so the same framing. */
  frameHalfX: 9.0,
  frameHalfZ: 8.6,

  /** Fixed ground centre of the interior shot (three z) — matches the café. */
  cameraCentreZ: -1.0,

  /** Furniture + plants (three-space AABBs). Drag/resize them live with
   *  `?edit` inside the home, then Save — that rewrites this block
   *  (dev-server /__save-home-colliders). */
  colliders: [
    // Hand-drawn in ?edit inside the home (Leonard), saved from the editor.
    { minX: -7, maxX: -5, minZ: -7, maxZ: -0.9 },
    { minX: -3.6, maxX: -2.8, minZ: -5.4, maxZ: -3.2 },
    { minX: -4.3, maxX: -2, minZ: -7, maxZ: -6.4 },
    { minX: 1.2, maxX: 5.6, minZ: -7.5, maxZ: -5.9 },
    { minX: 1.6, maxX: 6, minZ: -2.2, maxZ: 1.1 },
    { minX: -7, maxX: -5.5, minZ: 1.8, maxZ: 5.1 },
    { minX: -5.4, maxX: -4.2, minZ: 2.2, maxZ: 4 },
    { minX: -3.7, maxX: -2.2, minZ: 2, maxZ: 4 },
    { minX: -6.7, maxX: -6.1, minZ: 0.6, maxZ: 1.2 },
    { minX: 5.7, maxX: 6.7, minZ: -7.3, maxZ: -5.8 },
    { minX: -2.1, maxX: -0.5, minZ: -7.7, maxZ: -6 },
    { minX: 2.4, maxX: 2.8, minZ: -6.8, maxZ: -6.4 },
    { minX: 5.7, maxX: 7.2, minZ: -8, maxZ: -2.1 },
    { minX: 6.1, maxX: 6.7, minZ: 6, maxZ: 6.6 },
    { minX: 2.3, maxX: 2.7, minZ: 6.2, maxZ: 6.7 },
  ] as BoxCollider[],

  /** Interaction boxes inside the room (three-space AABBs). `home-exit` covers
   *  the doormat + the opening in the front wall; the rest open a `looks`
   *  dialogue below. Drag/resize them live with `?zones` inside the home, then
   *  Save — that rewrites this block (dev-server /__save-home-zones). */
  zones: [
    // Hand-drawn in ?zones inside the home (Leonard), saved from the editor.
    { id: "home-exit", verb: "Exit to town", minX: 0.35, maxX: 1.85, minZ: 6.1, maxZ: 7.3 },
    { id: "jersey-sg", verb: "Look", minX: -0.8, maxX: 0.1, minZ: -6.9, maxZ: -5.9 },
    { id: "jersey-ocbc", verb: "Look", minX: 0.5, maxX: 1.4, minZ: -6.9, maxZ: -5.9 },
    { id: "zwift", verb: "Look", minX: -4.2, maxX: -2.3, minZ: -5.7, maxZ: -2.7 },
  ] as InteractZone[],

  /** What pressing E in a zone says, by zone id: a portrait-less speech box. */
  looks: {
    'jersey-sg': {
      id: 'jersey-sg',
      name: 'Singapore jersey',
      role: 'framed on the wall',
      verb: 'Look',
      color: 0xc8342a,
      radius: 0,
      lines: ["1st, 2024 Men's Masters Esport National Championship"],
    },
    'jersey-ocbc': {
      id: 'jersey-ocbc',
      name: 'Nationals jersey',
      role: 'framed on the wall',
      verb: 'Look',
      color: 0xc8342a,
      radius: 0,
      lines: ["1st, 2026 Men's Masters Individual Time Trial National Championship"],
    },
    zwift: {
      id: 'zwift',
      name: 'Zwift setup',
      role: 'the pain cave',
      verb: 'Look',
      color: 0xf07a1a,
      radius: 0,
      lines: ["This is the Cycplus T7 and it's connected to Zwift."],
    },
  } as Record<string, Interactable>,

  /** Zone id that returns to town (must match a box in `zones` above). */
  exitZoneId: 'home-exit',
} as const
