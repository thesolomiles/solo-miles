import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CAMERA, PLAYER } from '../config/constants'
import { CAFE } from '../config/cafe'
import { PACMAN } from '../config/arcade'
import { arcadeFocus } from '../systems/arcadeFocus'
import { useGame } from '../state/store'

const _desired = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _pos = new THREE.Vector3()
// Scratch cameras used ONLY to compute the two projection matrices the intro
// morphs between — never made the active camera (that would swap the camera
// object under the EffectComposer and flash black). The real ortho `cam` stays
// the single active camera; the intro just overrides its projection.
const _perspProj = new THREE.PerspectiveCamera()
const _orthoProj = new THREE.OrthographicCamera()

// Half-extent of the town.glb Ground square. The camera is clamped so its
// visible footprint never reaches past this, i.e. the raw map edge / void beyond
// it never enters frame. A hair under the true ±28 so the bevelled edge itself
// also stays just out of view.
const GROUND_HALF = 27.5

/**
 * Opening cinematic (replaces the old intro modal). This is the ONE place the
 * locked 3/4 orthographic view is deliberately broken: before the game
 * `start()`s a manually-driven PERSPECTIVE camera flies ONE continuous pan along
 * a spline, then morphs — pose AND projection — into the exact orthographic
 * gameplay camera, so the hand-off is invisible and the "never rotate" gameplay
 * contract is untouched from that point on.
 *
 * Two beats:
 *  A. FLY-IN — an eye-level perspective pan north through the forest onto the
 *     character, tilting from level to the ortho 3/4 angle as it arrives.
 *  B. ZOOM-OUT — the instant it reaches the character it FLATTENS to orthographic
 *     (a quick perspective→ortho at the close-up framing, so nothing pops), then
 *     the whole zoom-out is an ORTHOGRAPHIC frustum widening — the camera doesn't
 *     move, the view just zooms out to gameplay size. Ortho has no parallax, so
 *     it's calm (not nauseating), and it always covers the ground, so no sky band.
 *
 * Perspective only exists during the fly-in (forward motion, fine); the ortho view
 * arrives at the START of the zoom-out, not the end. The camera parks on the ortho
 * view axis, so the final hop to the perch is invisible. north = −Z; spawn ~(0,0,7).
 */
const FLY = {
  pathIn: [
    new THREE.Vector3(0, 1.6, 24), // eye level, deep in the southern pines
    new THREE.Vector3(0, 2.2, 18), // gliding north, still among the trees
    new THREE.Vector3(0, 3.5, 15), // out of the forest, approaching the character
  ],
  meetDist: 18, // fly-in reaches the character here (close-up), ON the ortho view axis
  aimStart: new THREE.Vector3(0, 1.35, 5), // gaze: north + slightly down toward town
  fov: 55,
  dur: 4.6, // s — the whole move
  flyInFrac: 0.62, // fraction of dur spent flying in (perspective); the rest is the ortho zoom-out
  tiltEnd: 0.5, // orientation finishes tilting by here (before the flatten)
  flattenFrac: 0.16, // fraction of the ZOOM-OUT spent flattening perspective→ortho; the rest is the ortho zoom
}
const smooth = (t: number) => t * t * (3 - 2 * t) // smoothstep — gentle in/out
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) // quick start → eases to gameplay zoom

/** Element-wise lerp one projection matrix toward another, in place. Not
 *  projectively "correct", but a smooth morph that is exact at both ends — the
 *  standard cheap way to blend a perspective and an orthographic projection. */
function lerpProjInPlace(target: THREE.Matrix4, other: THREE.Matrix4, s: number) {
  const a = target.elements
  const b = other.elements
  for (let i = 0; i < 16; i++) a[i] = a[i] * (1 - s) + b[i] * s
}

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
  aspect: number,
  sinPitch: number,
): number {
  // The maze keeps the town's fixed zoom so the character is the same size in
  // the game as it is outside. The board can be wider than the viewport in
  // portrait — that's fine, the camera follows the player and pans, clamping to
  // the board edge (frameHalfX/Z) below.
  if (minigame === 'pacman') return CAMERA.worldViewHeight
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
 */
export function OrthoRig({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const size = useThree((s) => s.size)
  const set = useThree((s) => s.set)
  // Tracks the world (town / café) so a swap can hard-SNAP the camera rather than
  // glide — the transition should be a plain fade, never a visible "move in".
  const prevInterior = useRef(useGame.getState().interior)
  const prevMinigame = useRef(useGame.getState().minigame)
  // Opening cinematic (see FLY): elapsed time in the pan.
  const introT = useRef(0)

  // The single active camera — an OrthographicCamera we own (`manual` so r3f
  // never resets our frustum on resize). During the intro we override its pose +
  // projectionMatrix to render the perspective fly-through; there is no second
  // camera and no swap, so the EffectComposer never re-inits (no black flash).
  const cam = useMemo(() => {
    const c = new THREE.OrthographicCamera()
    ;(c as unknown as { manual: boolean }).manual = true
    return c
  }, [])

  // Fly-in path + start orientation, and the on-axis meet point. `meetPos` sits
  // directly in front of the ortho perch along its exact view axis, so the final
  // hop meetPos→perch is purely along the view direction — invisible to an ortho
  // camera, which is what lets the zoom-out end with no swing and no swap.
  const { introCurve, startQuat, meetPos, closeViewHeight } = useMemo(() => {
    // `forward` points from the ortho perch toward the scene (down-north). The
    // meet point (close-up on the character) is on this axis, so the ortho zoom-out
    // stays correctly centred and the final hop to the perch is invisible.
    const forward = new THREE.Vector3(0, CAMERA.lookAtHeight, 0).sub(CAMERA.offset).normalize()
    const perch = PLAYER.start.clone().add(CAMERA.offset)
    const meet = perch.clone().addScaledVector(forward, FLY.meetDist)
    // Ortho frustum height that matches the perspective's vertical framing at the
    // character when the fly-in arrives — so the flatten to ortho doesn't pop the
    // character's size. = 2·(distance meet→character along the view)·tan(fov/2).
    const charDist = PLAYER.start.clone().sub(meet).dot(forward)
    const closeH = 2 * charDist * Math.tan(THREE.MathUtils.degToRad(FLY.fov) / 2)
    return {
      introCurve: new THREE.CatmullRomCurve3([...FLY.pathIn, meet], false, 'centripetal'),
      startQuat: new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(FLY.pathIn[0], FLY.aimStart, _up),
      ),
      meetPos: meet,
      closeViewHeight: closeH,
    }
  }, [])

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
    const aspect = size.width / Math.max(size.height, 1)
    cam.near = CAMERA.near
    cam.far = CAMERA.far
    applyFrustum(cam, CAMERA.worldViewHeight, aspect)
    if (useGame.getState().started) {
      // HMR remount mid-game: straight to the ortho gameplay framing.
      cam.position.copy(posRef.current).add(CAMERA.offset)
      cam.quaternion.copy(fixedQuat)
    } else {
      // Fresh load: seat the camera at the first fly-in waypoint (perspective)
      // so frame 0 is already the intro, never a flash of the ortho perch.
      cam.position.copy(FLY.pathIn[0])
      cam.quaternion.copy(startQuat)
      _perspProj.fov = FLY.fov
      _perspProj.aspect = aspect
      _perspProj.near = CAMERA.near
      _perspProj.far = CAMERA.far
      _perspProj.updateProjectionMatrix()
      cam.projectionMatrix.copy(_perspProj.projectionMatrix)
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()
    }
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
    const { interior: interiorNow, minigame: minigameNow, started } = useGame.getState()
    const framed = interiorNow !== null || minigameNow !== null
    const aspect = size.width / Math.max(size.height, 1)

    // --- Ortho gameplay camera. Positioned every frame — including while the
    // intro plays — so it is the exact target the cinematic morphs into. ---
    const h = viewHeight(interiorNow, minigameNow, aspect, rig.sinPitch)
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
      interiorNow !== prevInterior.current || minigameNow !== prevMinigame.current
    prevInterior.current = interiorNow
    prevMinigame.current = minigameNow

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
      : interiorNow
        ? -1.0
        : clampCentre(p.z + rig.groundOffZ, halfZ)

    // Convert the clamped ground centre back into a camera position. With no yaw,
    // camera.x == ground-centre.x; camera.z is the ground centre minus the fixed
    // camera→ground z-offset.
    _desired.set(cgx, p.y + CAMERA.offset.y, cgz - rig.groundFromCamZ)
    // While the intro plays the player is static, so SNAP the ortho cam to its
    // default framing — a stable target for the settle to morph into. A world
    // SWAP (café) or a big teleport also snaps; otherwise glide.
    if (!started || swapped || cam.position.distanceTo(_desired) > 12) cam.position.copy(_desired)
    else cam.position.lerp(_desired, 1 - Math.pow(CAMERA.followDamping, dt))

    // --- Opening cinematic. The ortho block above already put `cam` at the
    // gameplay pose + projection; here we OVERRIDE it on the SAME camera (no swap,
    // so the composer never re-inits and never flashes black). Two moves: a
    // perspective fly-in, then a zoom-out in place. See FLY. ---
    const intro = !started && !framed
    if (!intro) return

    introT.current += dt
    const prog = Math.min(1, introT.current / FLY.dur)

    // Perspective endpoint (fly-in) is always computed; the ortho endpoint only
    // during the zoom-out (its frustum height animates, so it's applied there).
    _perspProj.fov = FLY.fov
    _perspProj.aspect = aspect
    _perspProj.near = CAMERA.near
    _perspProj.far = CAMERA.far
    _perspProj.updateProjectionMatrix()
    _orthoProj.near = CAMERA.near // match cam so the end equals the gameplay ortho proj exactly
    _orthoProj.far = CAMERA.far

    if (prog <= FLY.flyInFrac) {
      // A. FLY-IN: eye-level perspective pan through the forest onto the character,
      //    tilting from the look-north gaze into the ortho 3/4 angle as it arrives.
      const a = smooth(prog / FLY.flyInFrac)
      introCurve.getPoint(a, _pos)
      cam.position.copy(_pos)
      cam.quaternion.copy(startQuat).slerp(fixedQuat, smooth(Math.min(1, prog / FLY.tiltEnd)))
      cam.projectionMatrix.copy(_perspProj.projectionMatrix)
    } else {
      // B. ZOOM-OUT: ortho 3/4 orientation, and the zoom is an ORTHO frustum
      //    widening (no camera motion → no parallax → calm, not nauseating).
      cam.quaternion.copy(fixedQuat)
      const z = (prog - FLY.flyInFrac) / (1 - FLY.flyInFrac) // 0..1 across the zoom-out
      const flattenS = smooth(THREE.MathUtils.clamp(z / FLY.flattenFrac, 0, 1))
      // While flattening, hold at the meet point so the perspective→ortho matches
      // the fly-in. Once flat, leave the camera at the gameplay perch (set above):
      // it's HIGH, so the low meet point's near plane can't clip the south ground
      // into a sky band. meetPos→perch is along the view axis → invisible in ortho.
      if (flattenS < 1) cam.position.copy(meetPos)
      const zoomS = easeOut(THREE.MathUtils.clamp((z - FLY.flattenFrac) / (1 - FLY.flattenFrac), 0, 1))
      const h = THREE.MathUtils.lerp(closeViewHeight, CAMERA.worldViewHeight, zoomS)
      applyFrustum(_orthoProj, h, aspect)
      cam.projectionMatrix.copy(_perspProj.projectionMatrix)
      lerpProjInPlace(cam.projectionMatrix, _orthoProj.projectionMatrix, flattenS)
    }
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert()

    // Done: hand to gameplay. It moves the camera meetPos→perch, but that hop is
    // along the view axis, so an ortho camera sees no change.
    if (prog >= 1) useGame.getState().start()
  })

  return null
}
