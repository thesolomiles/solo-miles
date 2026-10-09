import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CAMERA } from '../config/constants'
import { CAFE } from '../config/cafe'
import { HOME } from '../config/home'
import { NINJA_RUN, PACMAN, ninjaView } from '../config/arcade'
import { RIDE } from '../config/ride'
import { FOREST } from '../config/forest'
import { forestFrame, forestView } from '../systems/forestView'
import { arcadeFocus } from '../systems/arcadeFocus'
import { useGame } from '../state/store'
import { intro } from '../systems/intro'
import { useForestRevealCamera } from './forest/useForestRevealCamera'

const _desired = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _intro = new THREE.Vector3()

// Half-extent of the town.glb Ground square. The camera is clamped so its
// visible footprint never reaches past this, i.e. the raw map edge / void beyond
// it never enters frame. A hair under the true ±28 so the bevelled edge itself
// also stays just out of view.
const GROUND_HALF = 27.5

// The opening skydive (systems/intro.ts, driven by three/Intro.tsx) owns the
// zoom, an extra camera height for the sky shot, and the landing shake until
// start(). Same fixed ortho camera throughout — it only translates and zooms.

/**
 * The default camera, created up front and handed to <Canvas camera={RIG_CAMERA}>
 * so it's the camera from the very FIRST frame. Before, the Canvas rendered a
 * frame or two with r3f's default perspective camera until OrthoRig swapped this
 * one in — a wide, zoomed-out flash of the whole town on every load. Its
 * position + frustum are set in OrthoRig's useFrame, which runs before render.
 */
export const RIG_CAMERA = (() => {
  const c = new THREE.OrthographicCamera()
  ;(c as unknown as { manual: boolean }).manual = true
  c.near = CAMERA.near
  c.far = CAMERA.far
  c.position.set(0, -1000, 0) // nothing in view until the rig places it
  return c
})()

/** Clamp a view-centre coord so the visible half-extent stays inside ±bound.
 *  If the view is wider than the map on this axis, centre it (nothing to clamp to). */
function clampCentre(v: number, half: number, bound = GROUND_HALF): number {
  const limit = bound - half
  if (limit <= 0) return 0
  return Math.max(-limit, Math.min(limit, v))
}

function applyFrustum(cam: THREE.OrthographicCamera, h: number, aspect: number) {
  cam.top = h / 2
  cam.bottom = -h / 2
  cam.left = (-h * aspect) / 2
  cam.right = (h * aspect) / 2
  cam.updateProjectionMatrix()
}

/**
 * The fixed three-quarter orthographic camera rig.
 *
 * Normal gameplay contract (the forest's authored reveal temporarily hands off
 * to a perspective camera; all walking and other worlds keep this fixed rig):
 *  - orientation is a CONSTANT; the camera never rotates and never re-aims
 *  - every frame only TRANSLATES the camera toward player + offset
 *
 * The look direction depends only on `offset` and `lookAtHeight` — both constant
 * and independent of where the player is — so we compute the orientation
 * quaternion once and simply reassign it each frame. That's the most robust way
 * to guarantee "never re-aims": there is no per-frame lookAt to accidentally
 * reintroduce, and no mount-order dependence (re-aiming every frame while the
 * position lagged is what caused motion sickness in the prototype).
 *
 * We own the camera fully (`manual = true`) so react-three-fiber doesn't reset
 * the ortho frustum on resize — we recompute it ourselves from worldViewHeight.
 *
 * The opening skydive is this same camera: raised into the sky, then zoomed in
 * on the landing and eased out to 100% — no separate camera, no perspective.
 */
export function OrthoRig({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const size = useThree((s) => s.size)
  const set = useThree((s) => s.set)
  // Tracks the world (town / café) so a swap can hard-SNAP the camera rather than
  // glide — the transition should be a plain fade, never a visible "move in".
  const prevInterior = useRef(useGame.getState().interior)
  const prevMinigame = useRef(useGame.getState().minigame)
  const prevRide = useRef(useGame.getState().ride)

  const cam = RIG_CAMERA
  // Forest sightseeing is the one authored perspective exception to the fixed rig.
  const forestCamera = useForestRevealCamera(cam)

  // The one, constant orientation. Matrix4.lookAt(eye, target, up) with the
  // camera's relative offset as the eye yields the fixed tilt (~39° down).
  const fixedQuat = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(
      CAMERA.offset,
      new THREE.Vector3(0, CAMERA.lookAtHeight, 0),
      _up,
    )
    return new THREE.Quaternion().setFromRotationMatrix(m)
  }, [])

  // Ninja Run's side-on camera: level-ish, looking along −Z at the path.
  const { sideQuat, sideOffset } = useMemo(() => {
    const pitch = THREE.MathUtils.degToRad(NINJA_RUN.pitchDeg)
    const eye = new THREE.Vector3(
      0,
      NINJA_RUN.lookY + Math.sin(pitch) * NINJA_RUN.camDist,
      Math.cos(pitch) * NINJA_RUN.camDist,
    )
    const m = new THREE.Matrix4().lookAt(eye, new THREE.Vector3(0, NINJA_RUN.lookY, 0), _up)
    return { sideQuat: new THREE.Quaternion().setFromRotationMatrix(m), sideOffset: eye }
  }, [])

  // The forest walk's side-on camera: like Ninja Run's, pitched a touch down
  // along −Z, never re-aimed — it only slides along x after the walker.
  const forestQuat = useMemo(() => {
    const pitch = THREE.MathUtils.degToRad(FOREST.pitchDeg)
    const eye = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch))
    const m = new THREE.Matrix4().lookAt(eye, new THREE.Vector3(), _up)
    return new THREE.Quaternion().setFromRotationMatrix(m)
  }, [])

  // Constants for mapping the fixed camera to the ground plane it centres on, so
  // the edge-clamp can reason in ground-space. The camera never re-aims, so the
  // view direction and the player→ground-centre offset are both constant.
  //  - `sinPitch`   : how a vertical screen span projects onto the tilted ground
  //  - `groundOffZ` : ground-centre.z − player.z (screen centre lands a touch
  //                   north of the player because of the tilt)
  //  - `groundFromCamZ` : ground-centre.z − camera.z, to convert a clamped
  //                       ground centre back into a camera position
  const rig = useMemo(() => {
    const dir = new THREE.Vector3(
      -CAMERA.offset.x,
      CAMERA.lookAtHeight - CAMERA.offset.y,
      -CAMERA.offset.z,
    ).normalize()
    const s = -CAMERA.offset.y / dir.y // ray param from camera to ground y=0 (player.y≈0)
    const groundFromCamZ = s * dir.z
    return {
      sinPitch: -dir.y, // dir.y is negative (looking down)
      groundOffZ: CAMERA.offset.z + groundFromCamZ,
      groundFromCamZ,
    }
  }, [])

  useEffect(() => {
    cam.near = CAMERA.near
    cam.far = CAMERA.far
    cam.position.copy(posRef.current).add(CAMERA.offset)
    cam.quaternion.copy(fixedQuat)
    const aspect = size.width / Math.max(size.height, 1)
    // Start zoomed in if the intro is about to play, else the gameplay zoom.
    const zoom = useGame.getState().started ? 1 : intro.zoom
    applyFrustum(cam, CAMERA.worldViewHeight / zoom, aspect)
    set({ camera: cam })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The frustum still depends on aspect (resize) and the intro zoom, so it's
  // applied in useFrame.
  const frustum = useRef({ h: 0, aspect: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    cam.quaternion.copy(fixedQuat) // constant — locked, never re-aimed

    const p = posRef.current
    const { interior: interiorNow, minigame: minigameNow, ride: rideNow, forest, started } =
      useGame.getState()
    const aspectNow = size.width / Math.max(size.height, 1)

    if (forest) {
      const f = forestFrame(aspectNow)
      if (f.h !== frustum.current.h || aspectNow !== frustum.current.aspect) {
        frustum.current = { h: f.h, aspect: aspectNow }
        applyFrustum(cam, f.h, aspectNow)
      }
      // Ease after the walker, a little ahead of the way he faces; snap on entry.
      const want = forestView.walkerX + forestView.facing * FOREST.lead
      if (forestView.snap) {
        forestView.camX = want
        forestView.snap = false
      } else {
        forestView.camX += (want - forestView.camX) * Math.min(1, dt * FOREST.follow)
      }
      const pitch = THREE.MathUtils.degToRad(FOREST.pitchDeg)
      cam.quaternion.copy(forestQuat)
      cam.position.set(
        forestView.camX,
        f.lookY + Math.sin(pitch) * FOREST.camDist,
        Math.cos(pitch) * FOREST.camDist,
      )
      forestCamera.update(aspectNow)
      return
    }
    forestCamera.restore()
    const riding = rideNow !== null
    const framed = interiorNow !== null || minigameNow !== null || riding
    const aspect = size.width / Math.max(size.height, 1)

    // Opening skydive: zoomed in until its final ease-out. `zoom` divides the
    // view height, so >1 = zoomed in.
    const intro_ = !started && !framed
    const zoom = intro_ ? intro.zoom : 1

    // One fixed zoom everywhere — town, interiors, maze, ride — so the character
    // is the same size on every screen (Ninja Run's side-on shot is the one
    // exception). Where the view is narrower than the space (a portrait phone in
    // the café), the camera pans + clamps instead of zooming.
    const h = minigameNow === 'ninjarun' ? ninjaView(aspect).h : CAMERA.worldViewHeight / zoom
    if (h !== frustum.current.h || aspect !== frustum.current.aspect) {
      frustum.current = { h, aspect }
      applyFrustum(cam, h, aspect)
    }

    // Visible half-extents on the ground plane. Screen-X maps straight to world-X
    // (no yaw); screen-Y projects along the tilt, so its ground span is stretched
    // by 1/sinPitch.
    const halfX = (h * aspect) / 2
    const halfZ = h / 2 / rig.sinPitch

    // Interiors are small single rooms. Where the view is wider than the room
    // (desktop) the clamp collapses to a fixed, centred shot; on a narrow phone
    // the camera follows the player sideways, stopping at the side walls
    // (panHalfX). Front-to-back the room always fits, so z stays fixed.
    // A town↔café swap (flag flips at full black) must SNAP the camera into the
    // new room's framed shot, so the fade-in reveals it already in place.
    const swapped =
      interiorNow !== prevInterior.current ||
      minigameNow !== prevMinigame.current ||
      rideNow !== prevRide.current
    prevInterior.current = interiorNow
    prevMinigame.current = minigameNow
    prevRide.current = rideNow

    // The maze follows its own player (the town Player is unmounted in a
    // minigame, so it publishes through arcadeFocus) and clamps to the board
    // edges. When the whole board fits, the clamp collapses to a centred shot.
    // Ninja Run has its own fixed side-on shot (see below).
    const ninja = minigameNow === 'ninjarun'
    const cgx = minigameNow
      ? clampCentre(arcadeFocus.x, halfX, PACMAN.frameHalfX)
      : interiorNow
        ? clampCentre(p.x, halfX, interiorNow === 'home' ? HOME.panHalfX : CAFE.panHalfX)
        : framed
          ? 0
          : clampCentre(p.x, halfX)
    const cgz = minigameNow
      ? clampCentre(arcadeFocus.z + rig.groundOffZ, halfZ, PACMAN.frameHalfZ)
      : riding
        ? RIDE.cameraCentreZ // fixed shot: runners in the lower third, road ahead
        : interiorNow
          ? interiorNow === 'home'
            ? HOME.cameraCentreZ
            : -1.0
          : clampCentre(p.z + rig.groundOffZ, halfZ)

    // Convert the clamped ground centre back into a camera position. With no yaw,
    // camera.x == ground-centre.x; camera.z is the ground centre minus the fixed
    // camera→ground z-offset.
    _desired.set(cgx, p.y + CAMERA.offset.y, cgz - rig.groundFromCamZ)
    if (ninja) {
      // Ninja Run: a side-on shot, constant for the whole game (it swaps in at
      // the fade like any world, and is never re-aimed while you play). The
      // runner stands at x = 0 and the world scrolls past, so the frame just sits
      // ahead of him with most of the screen on the road to come.
      cam.quaternion.copy(sideQuat)
      _desired.copy(sideOffset).setX(ninjaView(aspect).lead)
      cam.position.copy(_desired)
      return
    }
    if (intro_) _desired.add(_intro.set(intro.shakeX, intro.camY + intro.shakeY, 0))
    // While the intro plays, SNAP the camera to its framing (the sky shot, the
    // landing, the zoom) — it cuts, it never glides. A world SWAP (café) or a big
    // teleport also snaps; otherwise glide.
    if (!started || swapped || cam.position.distanceTo(_desired) > 12) cam.position.copy(_desired)
    else cam.position.lerp(_desired, 1 - Math.pow(CAMERA.followDamping, dt))
  }, -1)

  return null
}
