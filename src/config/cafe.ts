import * as THREE from 'three'
import type { BoxCollider, InteractZone } from './town'

/**
 * The café interior — a separate little "world" the player drops into when they
 * press E on the town's café door (the `ze6h68k` interaction zone). It's a
 * standalone room modelled in Blender (public/models/cafe.glb, the `cafe.blend`
 * source) with its own spawn, soft boundary, collision, and an exit zone on the
 * entrance carpet. The town↔café swap is driven by `interior` in the store
 * (state/store.ts) and wired in three/Scene.tsx via InteriorController.
 *
 * Coordinate note: Blender is Z-up and exports Y-up, so a Blender point
 * (bx, by, bz) lands in three-space at (bx, bz, -by). The room is X[-7,7],
 * Y[-7,7] in Blender → three X[-7,7], Z[-7,7], with the counter/back wall
 * (Blender +Y) at three −Z and the open entrance (Blender −Y, south) at three
 * +Z. All the numbers below are already in three-space.
 */
export const CAFE = {
  url: '/models/cafe.glb',

  /** The town interaction-zone id that opens the café (config/zones.data.ts). */
  enterZoneId: 'ze6h68k',

  /** Player spawn on the entrance carpet, facing into the room (toward the
   *  counter at −Z). */
  spawn: new THREE.Vector3(4, 0, 5.6),

  /** Where to drop the player back in the town on exit — just south of the
   *  town's café door zone (x 11.6–12.8, z −0.7–1.4), so they don't instantly
   *  re-trigger the "Enter café" prompt. */
  townReturn: new THREE.Vector3(12.2, 0, 2.2),

  /** Soft rectangular play area — keeps the player inside the room (the south
   *  wall was removed, so this is what stops them walking out the open front;
   *  the carpeted exit is the way out). */
  bounds: { minX: -6.6, maxX: 6.6, minZ: -6.6, maxZ: 6.7 },

  /** Solid obstacles inside the room (three-space AABBs). The service counter +
   *  pastry fridge line, and the two arcade machines against the left wall.
   *  Tables are left walkable for now. */
  colliders: [
    { minX: -5.0, maxX: 4.8, minZ: -4.5, maxZ: -3.5 }, // counter + pastry fridge
    { minX: -6.6, maxX: -5.9, minZ: 3.1, maxZ: 5.4 }, // arcade machines
  ] as BoxCollider[],

  /** The exit "door": standing on the entrance carpet shows an Exit prompt;
   *  pressing E returns to the town. */
  exitZone: {
    id: 'cafe-exit',
    verb: 'Exit to town',
    minX: 2.4,
    maxX: 5.6,
    minZ: 4.2,
    maxZ: 7.0,
  } as InteractZone,
} as const
