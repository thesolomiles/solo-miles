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

  /** Half-extents the interior camera must keep on-screen (ground plane,
   *  three-space). Past the modelled walls (~±7) plus a dark gutter so the
   *  walls don't kiss the bezel. On a tall phone the café view zooms out until
   *  `frameHalfX` fits; desktop is already wide enough and keeps the town zoom. */
  frameHalfX: 9.0,
  frameHalfZ: 8.6,

  /** Solid obstacles inside the room (three-space AABBs). The service counter +
   *  pastry fridge line, and the two arcade machines against the left wall.
   *  Tables are left walkable for now. */
  colliders: [
    // Hand-drawn in ?edit inside the café (Leonard), saved from the editor.
    { minX: -5.7, maxX: 5.6, minZ: -8.3, maxZ: -2.8 },
    { minX: -7.6, maxX: -5.4, minZ: 2.4, maxZ: 5.9 },
    { minX: -4.6, maxX: -1, minZ: -0.3, maxZ: 3.7 },
    { minX: 0.9, maxX: 4.6, minZ: -0.3, maxZ: 3.5 },
    { minX: -7.4, maxX: -5.5, minZ: -2.7, maxZ: 3.5 },
    { minX: 5.3, maxX: 7.8, minZ: -2.5, maxZ: 3.6 },
  ] as BoxCollider[],

  /** Floor lift: the café's wood planks sit ~0.16u above y=0 (their modelled
   *  top), so a character standing at y=0 sinks its shins into the floor. Drop
   *  the whole café model by this much (three/CafeModel) so the plank surface
   *  lands at y=0 where the player + staff stand. */
  floorDrop: 0.16,

  /** Two ambient baristas working behind the service counter — a cloned skinned
   *  cafe-worker.glb each. They wander the staff strip below (walk → stop → an
   *  active clip: make a drink, chat, glance round → walk again), each on its own
   *  randomised timeline so they never move in lockstep. `pos` is the home spot
   *  they roam around, `rot` the rest facing (+Z = model front = toward the
   *  customer), `phase` staggers the two, `primary` is the clip each favours.
   *  See three/actors/CafeWorker. */
  workers: [
    { pos: [0.9, -5.2] as [number, number], rot: 0, phase: 0, primary: 'bartend' },
    { pos: [-3.2, -5.2] as [number, number], rot: 0, phase: 1, primary: 'talk' },
  ],

  /** Seated customers. Each is a cloned patron GLB frozen on its `sit` clip at a
   *  chair. `model` is the GLB (patron-1 = sit-and-talk, patron-2 = cross-legged),
   *  `pos` the chair's floor spot (three-space x,z), `rot` the facing (+Z = model
   *  front = toward the camera / into the room; π = toward the back wall), `yFix`
   *  nudges the seat height. See three/actors/Patron. */
  patrons: [
    // Left-wall 2-top (T2L1): the two share a table, facing each other across it.
    // patron-1 at the north chair faces +Z (toward the table + camera; we see his
    // face); patron-2 opposite at the south chair faces −Z (toward him).
    { model: '/models/patron-1.glb', pos: [-6.35, -2.3] as [number, number], rot: 0, yFix: 0 },
    { model: '/models/patron-2.glb', pos: [-6.35, -0.7] as [number, number], rot: Math.PI, yFix: 0 },
  ],

  /** The walkable staff strip the baristas roam: the gap between the counter's
   *  back edge (z≈−4.45) and the back bar (z≈−6.0), spanning most of the counter
   *  length. Kept clear of the counter/back-bar geometry so they don't clip into
   *  it. This region sits inside the player's counter collider, so customers
   *  can't follow them back here. */
  workZone: { minX: -4.6, maxX: 3.4, minZ: -5.9, maxZ: -4.6 },

  /** Interaction boxes inside the room (three-space AABBs). The `cafe-exit` id
   *  is wired to leave (state/store.ts). Extra boxes are authored live with
   *  `?zones` inside the café — same editor as the town, saved here. */
  zones: [
    // Hand-drawn in ?zones inside the café (Leonard), saved from the editor.
    { id: "cafe-exit", verb: "Exit to town", minX: 2.4, maxX: 5.6, minZ: 4.2, maxZ: 7 },
    { id: "zhu6zu4", verb: "Play game", minX: -7.3, maxX: -5.2, minZ: 2.6, maxZ: 6.1 },
  ] as InteractZone[],

  /** Zone id that returns to town (must match a box in `zones` above). */
  exitZoneId: 'cafe-exit',
} as const
