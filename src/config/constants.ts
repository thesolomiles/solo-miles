import * as THREE from 'three'

/**
 * Single source of truth for the town's visual language + tuning knobs.
 * Palette carried over from the approved prototype brief. Keep colours here so
 * the greybox and the eventual real art read as one world.
 */
export const PALETTE = {
  // UI
  paper: '#fbf4e8',
  ink: '#2b2620',
  clay: '#d98a5a',
  clayDeep: '#b9663a',
  // World
  skyTop: '#a6cfe1',
  horizon: '#f4e7cf',
  ground: '#8fab68',
  dirt: '#cdb083',
  // Characters
  player: '#e4633c',
  leonard: '#2f8f83',
  mews: '#e08a3c',
} as const

/** Where the draco decoder lives (copied into /public/draco). */
export const DRACO_PATH = '/draco/'

/**
 * Orthographic three-quarter camera rig. Values matched to the approved
 * `solomiles-town-ortho` prototype (the source of truth for feel).
 *
 * LOCKED DESIGN: orientation is set once (via lookAt at init) and never touched
 * again — the rig only ever TRANSLATES to follow the player. Re-aiming every
 * frame is what caused motion sickness in the prototype; do not reintroduce it.
 *
 * `offset` defines framing + tilt; aiming a touch above ground (lookAtHeight)
 * settles the buildings in frame. The effective down-angle,
 * atan((offset.y - lookAtHeight) / offset.z), is ~39°, front-facing (x = 0) so
 * every building shows its front, never its roof.
 */
export const CAMERA = {
  worldViewHeight: 28, // world units visible vertically (drives the ortho frustum)
  offset: new THREE.Vector3(0, 16, 18),
  lookAtHeight: 1.2, // aim slightly above the ground plane, as the prototype does
  /**
   * Frame-rate-independent follow damping: the fraction of the gap still left
   * after one second, applied per frame as `1 - damping^dt`. Smaller = snappier.
   * 0.0015 reproduces the prototype's glide (~0.10 of the gap per frame at 60fps).
   */
  followDamping: 0.0015,
  near: 0.1,
  far: 300,
} as const

/** Placeholder character-controller tuning. Survives the swap to a real model. */
export const PLAYER = {
  speed: 7.5, // world units / second (prototype value)
  radius: 0.6,
  start: new THREE.Vector3(0, 0, 7), // prototype spawn, just south of the plaza
  turnLerp: 0.22, // how quickly the character rotates to face travel direction
} as const
