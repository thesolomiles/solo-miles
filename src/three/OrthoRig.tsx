import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CAMERA } from '../config/constants'
import { CAFE } from '../config/cafe'
import { PACMAN } from '../config/arcade'
import { RIDE } from '../config/ride'
import { arcadeFocus } from '../systems/arcadeFocus'
import { useGame } from '../state/store'
import { intro } from '../systems/intro'

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
 * The one camera, created up front and handed to <Canvas camera={RIG_CAMERA}>
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

/** Vertical world-units in the ortho frustum. Town stays at a fixed zoom; the
 *  café / Pac-Man maze zoom out on tall viewports until the whole room fits. */
function viewHeight(
  interior: 'cafe' | null,
  minigame: 'pacman' | null,
  ride: boolean,
  aspect: number,
  sinPitch: number,
): number {
  // The maze / ride keep the town's fixed zoom so the character is the same size
  // as it is outside. The board can be wider than the viewport in portrait —
  // that's fine, the camera follows the player and pans, clamping to the board
  // edge (frameHalfX/Z) below.
  if (minigame === 'pacman' || ride) return CAMERA.worldViewHeight
  if (interior !== 'cafe') return CAMERA.worldViewHeight
  const hFitX = (2 * CAFE.frameHalfX) / Math.max(aspect, 0.05)
  const hFitZ = 2 * CAFE.frameHalfZ * sinPitch
  return Math.max(CAMERA.worldViewHeight, hFitX, hFitZ)
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
 * Contract (LOCKED — see brief):
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

  // Town zoom is constant; café zoom depends on aspect + interior, so the
  // frustum is applied in useFrame (same tick as a town↔café swap).
  const frustum = useRef({ h: 0, aspect: 0 })

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    cam.quaternion.copy(fixedQuat) // constant — locked, never re-aimed

    const p = posRef.current
    const { interior: interiorNow, minigame: minigameNow, ride: rideNow, started } =
      useGame.getState()
    const riding = rideNow !== null
    const framed = interiorNow !== null || minigameNow !== null || riding
    const aspect = size.width / Math.max(size.height, 1)

    // Opening skydive: zoomed in until its final ease-out. `zoom` divides the
    // view height, so >1 = zoomed in.
    const intro_ = !started && !framed
    const zoom = intro_ ? intro.zoom : 1

    const h = viewHeight(interiorNow, minigameNow, riding, aspect, rig.sinPitch) / zoom
    if (h !== frustum.current.h || aspect !== frustum.current.aspect) {
      frustum.current = { h, aspect }
      applyFrustum(cam, h, aspect)
    }

    // Visible half-extents on the ground plane. Screen-X maps straight to world-X
    // (no yaw); screen-Y projects along the tilt, so its ground span is stretched
    // by 1/sinPitch.
    const halfX = (h * aspect) / 2
    const halfZ = h / 2 / rig.sinPitch

    // Interiors (the café) are small single rooms — smaller than the view — so
    // instead of following the player (which shoves the room to one side and
    // reveals the void beside it), lock the camera on a fixed room centre. The
    // player moves around inside a stable, fully-framed shot.
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
    const cgx = minigameNow
      ? clampCentre(arcadeFocus.x, halfX, PACMAN.frameHalfX)
      : framed
        ? 0
        : clampCentre(p.x, halfX)
    const cgz = minigameNow
      ? clampCentre(arcadeFocus.z + rig.groundOffZ, halfZ, PACMAN.frameHalfZ)
      : riding
        ? RIDE.cameraCentreZ // fixed shot: runners in the lower third, road ahead
        : interiorNow
          ? -1.0
          : clampCentre(p.z + rig.groundOffZ, halfZ)

    // Convert the clamped ground centre back into a camera position. With no yaw,
    // camera.x == ground-centre.x; camera.z is the ground centre minus the fixed
    // camera→ground z-offset.
    _desired.set(cgx, p.y + CAMERA.offset.y, cgz - rig.groundFromCamZ)
    if (intro_) _desired.add(_intro.set(intro.shakeX, intro.camY + intro.shakeY, 0))
    // While the intro plays, SNAP the camera to its framing (the sky shot, the
    // landing, the zoom) — it cuts, it never glides. A world SWAP (café) or a big
    // teleport also snaps; otherwise glide.
    if (!started || swapped || cam.position.distanceTo(_desired) > 12) cam.position.copy(_desired)
    else cam.position.lerp(_desired, 1 - Math.pow(CAMERA.followDamping, dt))
  })

  return null
}
