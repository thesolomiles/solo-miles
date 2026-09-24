/**
 * The opening sequence: a skydive over the town, then the landing.
 *
 *   boot  → before the 3D scene exists: index.html paints a CSS sky (clouds +
 *           wind) from the very first frame, so the page is never blank. That
 *           same sheet stays up as THE sky for the freefall — it sits behind the
 *           canvas, which renders transparent (no scene background) during the
 *           sky, so there's never a swap between two different skies.
 *   sky   → as soon as the player model is in, they fall into frame and freefall
 *           against blue sky, wind streaks + clouds rushing past. The town loads
 *           in its own Suspense boundary meanwhile; the freefall holds until it's
 *           in, compiled and the frame rate is steady (the old intro was a timed
 *           zoom that ran through the load hitch, so a slow start showed it
 *           already zoomed out), then shows a Start button and floats there
 *           until it's pressed. That press is also the user gesture browsers
 *           need before audio plays, so the wind starts with it. A beat later
 *           they drop out of the bottom of the frame.
 *   cut   → the sky sheet moves in front of the canvas (the player has already
 *           left frame, so nothing visibly changes); camera swaps to the town
 *           spawn behind it, then the sheet fades out.
 *   drop  → the player falls in from the top of frame and lands, with dust.
 *   zoom  → the camera eases out to the gameplay framing, then start().
 *
 * Phase lives in the store (the HUD curtain and sky background react to it);
 * the hot per-frame values below are plain mutable state, read by Player and
 * OrthoRig each frame.
 */
export type IntroPhase = 'boot' | 'sky' | 'cut' | 'drop' | 'zoom' | 'done'

export const INTRO = {
  startZoom: 1.5, // camera zoom on the landing, eased out to 1 at the end
  skyZoom: 2.4, // closer for the freefall — the flailing pose is compact
  skyTilt: -0.72, // pitch the body so its front faces the camera, head up-screen
  steadyFrames: 10, // consecutive frames under steadyDt before the exit
  steadyDt: 1 / 24,
  steadyMaxSec: 4, // stop waiting for a steady rate after this long (wall clock)
  enterSec: 0.7, // falling into frame from above at the start of the sky
  enterFrom: 9, // how far above centre they start
  skyAlt: 150, // how far above the town the freefall happens (well out of view)
  skySec: 2.2, // earliest the Start button can appear (after the fall-in)
  goDelay: 0.9, // float in the howling wind this long after Start, then exit
  exitSec: 0.75, // the last part of the freefall: dropping out of frame
  exitGravity: 40,
  cutSec: 0.15, // a beat with the sky sheet in front before the swap
  dropDelay: 0.3, // sky sheet fades out before the player appears
  dropHeight: 12, // start above the top of the frame
  dropSpeed: 16,
  dropGravity: 40,
  landSkip: 0.2, // start the land clip here — its first frames are still airborne
  landSec: 0.95, // hold on the landing before zooming out
  zoomSec: 1.4,
} as const

// Starts in the sky framing so the very first 3D frame is already the freefall
// shot (player still above frame) — never a glimpse of the town.
export const intro = {
  /** Player's height above their ground position. */
  y: INTRO.skyAlt + INTRO.enterFrom as number,
  /** Extra camera height (the sky phase films at altitude). */
  camY: INTRO.skyAlt as number,
  zoom: INTRO.skyZoom as number,
  /** Screen shake offset (world units), set on impact. */
  shakeX: 0,
  shakeY: 0,
  /** Which one-off clip the player should show, or null for normal gaits. */
  pose: 'fall' as 'fall' | 'land' | null,
  /** Body pitch (radians about X) — the freefall tilts the skydiver's front up
      toward the camera. */
  tilt: INTRO.skyTilt as number,
  /** Body roll (radians about Z) — a lazy sway in the wind. */
  roll: 0,
  /** Set once the town's models have loaded (TownReady mounts). */
  townReady: false,
  /** Dev: freeze the sequence clock (window.__intro.hold = true) to inspect a beat. */
  hold: false,
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__intro = intro
}

