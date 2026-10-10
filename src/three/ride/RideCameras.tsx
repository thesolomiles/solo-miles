import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RIDE } from '../../config/ride'
import { useRideCam, AUTO_SHOTS, SHOT_KEYS, SHOT_SECONDS } from '../../state/rideCam'
import { RIG_CAMERA } from '../OrthoRig'
import { CURVE, MOTION, VIEW, elevY, roadX, M_PER_U, gradeAtW } from './motion'

/**
 * PROTOTYPE (`?ridecam`): broadcast-style ride cameras with an auto director.
 *  overhead — the shared ortho rig (the classic ride shot)
 *  chase    — low, straight behind the riders, looking up the road
 *  rearSide — behind and off to one side
 *  front    — ahead of the riders, looking back at them
 *  flyby    — a roadside tripod fixed to the WORLD: it scrolls with the scenery,
 *             so the riders ride up to it and past it while it pans to follow
 *  side     — ortho side-on 2D profile: the near half of the world is cut away
 *             (near plane + hidden props + an earth cross-section) and the road's
 *             bends ease flat (manual only)
 * Auto (default) cuts through AUTO_SHOTS every SHOT_SECONDS, starting overhead.
 * Keys 1–6 hold a shot, 0 returns to auto, C cycles. The riders always sit at the
 * origin row, so each shot is an offset from them; the hills flow past.
 */

// Chase: riders framed mid-screen (clear of the speech box), road climbing above.
const CHASE = { height: 3.6, back: 9, lookAhead: 6, lookY: 0.3, tiltWithClimb: 0.35, climbProbe: 18 }
const REAR_SIDE = { x: 5.2, height: 2.6, back: 6.5, lookAhead: 4, lookY: 0.7 }
const FRONT = { height: 1.7, ahead: 5.5, lookY: 0.8 }
/** Tripod: starts this far up the road, this far off the road edge, this high. */
/** Tripod: planted far enough up the road that the riders reach it in about
 *  `approachSeconds` at their current pace (clamped to `minStart`–`maxStart`); the
 *  shot ends once they're `passed` beyond it (not on the clock), with `maxSeconds`
 *  as a safety net. */
const FLYBY = { approachSeconds: 3, minStart: 10, maxStart: 26, off: 2.6, height: 1.9, lookY: 0.9, clear: 4.5, passed: 3, maxSeconds: 9 }
const flybyStart = () =>
  RIDE.runnerZ + THREE.MathUtils.clamp(MOTION.speed * FLYBY.approachSeconds, FLYBY.minStart, FLYBY.maxStart)
const SIDE = { viewH: 12, camDist: 60, lift: 1.2, leadFrac: 0.1, fogNear: 68, fogFar: 115 }
/** Narrowest horizontal field of view the perspective shots allow (degrees). */
const MIN_HFOV = 62
const PERSP_FOG = { near: 18, far: 41 } // scenery recycles ~40 ahead — fog hides the edge
const OVERHEAD_FOG = { near: 34, far: 78 } // RideWorld's own fog
/** Side cut plane: just outside the near road edge (camera sits on −X). */
const CUT_X = -(RIDE.roadHalfWidth + 1.0)

export function RideCameras() {
  const shot = useRideCam((s) => s.shot)
  const auto = useRideCam((s) => s.auto)
  const cut = useRideCam((s) => s.cut)
  const set = useThree((s) => s.set)
  const scene = useThree((s) => s.scene)
  const persp = useMemo(() => new THREE.PerspectiveCamera(50, 1, 0.1, 160), [])
  const side = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200), [])
  const shotTime = useRef(0)
  const tripod = useRef({ z: 0, side: 1 })

  // Every ride starts on the normal shot with the director running.
  useEffect(() => {
    useRideCam.getState().setShot(AUTO_SHOTS[0], true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useRideCam.getState()
      if (SHOT_KEYS[e.key]) st.setShot(SHOT_KEYS[e.key], false)
      else if (e.key === '0') st.setShot(AUTO_SHOTS[0], true)
      else if (e.key === 'c' || e.key === 'C') st.cycle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // A new shot: restart its clock; the tripod plants itself up the road, on
  // alternating sides each time.
  useEffect(() => {
    shotTime.current = 0
    tripod.current = { z: flybyStart(), side: -tripod.current.side }
  }, [cut])

  useEffect(() => {
    const cam = shot === 'overhead' ? RIG_CAMERA : shot === 'side' ? side : persp
    set({ camera: cam })
    return () => set({ camera: RIG_CAMERA })
  }, [shot, persp, side, set])

  // Dev handle: jump along the route (`__ride.goto(metres)`) to check a climb.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__ride = {
      goto: (m: number) => (CURVE.phase = m / M_PER_U - RIDE.runnerZ),
      grade: () => gradeAtW(RIDE.runnerZ + CURVE.phase),
    }
    return () => {
      delete w.__ride
    }
  }, [])

  // Leaving the ride: the road's bends and the cut-away go back to normal.
  useEffect(
    () => () => {
      CURVE.amp = 1
      VIEW.cutX = -Infinity
      VIEW.stagger = 0
      VIEW.clearR = 0
    },
    [],
  )

  useFrame(({ size }, delta) => {
    const dt = Math.min(delta, 0.05)
    const aspect = size.width / Math.max(size.height, 1)

    // Auto director: cut to the next shot every SHOT_SECONDS.
    shotTime.current += dt
    // The roadside shot runs until the riders have ridden past (below), not 5 s.
    const shotLength = shot === 'flyby' ? FLYBY.maxSeconds : SHOT_SECONDS
    if (auto && shotTime.current >= shotLength) {
      const i = AUTO_SHOTS.indexOf(shot)
      useRideCam.getState().setShot(AUTO_SHOTS[(i + 1) % AUTO_SHOTS.length], true)
    }

    // The side profile straightens the road (its bends would swing it through the
    // cut plane and are invisible side-on anyway); ease so nothing pops.
    const isSide = shot === 'side'
    CURVE.amp += ((isSide ? 0 : 1) - CURVE.amp) * (1 - Math.pow(0.02, dt))
    VIEW.cutX = isSide ? CUT_X : -Infinity
    VIEW.clearR = shot === 'flyby' ? FLYBY.clear : 0
    VIEW.stagger += ((isSide ? 1 : 0) - VIEW.stagger) * (1 - Math.pow(0.02, dt))

    const fog = scene.fog as THREE.Fog | null
    if (fog) {
      const f = shot === 'overhead' ? OVERHEAD_FOG : isSide ? { near: SIDE.fogNear, far: SIDE.fogFar } : PERSP_FOG
      fog.near = f.near
      fog.far = f.far
    }

    const rz = RIDE.runnerZ
    const road = RIDE.roadHeight
    if (shot === 'side') {
      const h = SIDE.viewH
      const w = h * aspect
      side.left = -w / 2
      side.right = w / 2
      side.top = h / 2
      side.bottom = -h / 2
      side.near = SIDE.camDist + CUT_X // clip everything nearer than the cut plane
      side.far = SIDE.camDist + 60
      side.updateProjectionMatrix()
      // Camera on −X looking +X: riders travel +Z = screen-right; sit them left
      // of centre so most of the frame is road ahead.
      const cz = rz + w * SIDE.leadFrac
      side.position.set(-SIDE.camDist, road + SIDE.lift, cz)
      side.lookAt(0, road + SIDE.lift, cz)
      return
    }
    if (shot === 'overhead') return // the ortho rig drives itself

    if (persp.aspect !== aspect) {
      // 50° tall on landscape; on a narrow (portrait) screen widen it so the view
      // stays at least MIN_HFOV across and both riders still fit.
      const vMin = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(MIN_HFOV) / 2) / aspect)
      persp.fov = Math.max(50, THREE.MathUtils.radToDeg(vMin))
      persp.aspect = aspect
      persp.updateProjectionMatrix()
    }
    if (shot === 'chase') {
      persp.position.set(0, road + CHASE.height, rz - CHASE.back)
      // Look up the road; on a climb the target rises so the horizon tilts up.
      persp.lookAt(0, road + CHASE.lookY + CHASE.tiltWithClimb * elevY(rz + CHASE.climbProbe), rz + CHASE.lookAhead)
    } else if (shot === 'rearSide') {
      persp.position.set(REAR_SIDE.x, road + REAR_SIDE.height, rz - REAR_SIDE.back)
      persp.lookAt(0, road + REAR_SIDE.lookY, rz + REAR_SIDE.lookAhead)
    } else if (shot === 'front') {
      // Sits on the road ahead, so it rides on the hill's height there.
      const cz = rz + FRONT.ahead
      persp.position.set(0, road + FRONT.height + elevY(cz), cz)
      persp.lookAt(0, road + FRONT.lookY, rz)
    } else if (shot === 'flyby') {
      // Fixed to the world: scroll with the scenery (same roadX/elevY placement
      // as the props), pan to keep the riders in frame as they pass.
      const t = tripod.current
      t.z -= MOTION.speed * dt
      if (t.z < rz - FLYBY.passed) {
        // Riders have gone by: auto cuts to the next angle; a held shot replants
        // the tripod up the road for another pass.
        if (auto) {
          useRideCam.getState().setShot(AUTO_SHOTS[(AUTO_SHOTS.indexOf(shot) + 1) % AUTO_SHOTS.length], true)
          return
        }
        t.z = flybyStart()
        t.side = -t.side
      }
      const x = roadX(t.z) + t.side * (RIDE.roadHalfWidth + FLYBY.off)
      persp.position.set(x, elevY(t.z) + FLYBY.height, t.z)
      VIEW.clearX = x
      VIEW.clearZ = t.z
      persp.lookAt(0, road + FLYBY.lookY, rz)
    }
  })

  return null
}

const CUT = { zFar: -60, zNear: 40, samples: 81, grass: 0.28, depth: 24 }

/** Two vertical strips in the cut plane: a grass band on top and earth below, both
 *  following the ground's height — the side profile's solid cross-section. */
function makeStrip(): THREE.BufferGeometry {
  const n = CUT.samples
  const pos = new Float32Array(n * 2 * 3)
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const a = 2 * i, b = a + 1, c = a + 2, d = a + 3
    idx.push(a, b, c, b, d, c)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g
}

export function SideCutaway() {
  const mode = useRideCam((s) => s.shot)
  const grass = useMemo(makeStrip, [])
  const earth = useMemo(makeStrip, [])
  useEffect(() => () => {
    grass.dispose()
    earth.dispose()
  }, [grass, earth])
  useFrame(() => {
    if (mode !== 'side') return
    const x = CUT_X + 0.02
    const gp = grass.attributes.position.array as Float32Array
    const ep = earth.attributes.position.array as Float32Array
    for (let i = 0; i < CUT.samples; i++) {
      const z = CUT.zFar + (i / (CUT.samples - 1)) * (CUT.zNear - CUT.zFar)
      const e = elevY(z)
      const t = 2 * i * 3, b = (2 * i + 1) * 3
      gp[t] = x; gp[t + 1] = e; gp[t + 2] = z
      gp[b] = x; gp[b + 1] = e - CUT.grass; gp[b + 2] = z
      ep[t] = x; ep[t + 1] = e - CUT.grass; ep[t + 2] = z
      ep[b] = x; ep[b + 1] = e - CUT.depth; ep[b + 2] = z
    }
    grass.attributes.position.needsUpdate = true
    earth.attributes.position.needsUpdate = true
    grass.computeBoundingSphere()
    earth.computeBoundingSphere()
  })
  if (mode !== 'side') return null
  return (
    <group>
      <mesh geometry={grass}>
        <meshBasicMaterial color={0x6d8a49} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={earth}>
        <meshBasicMaterial color={0x5a4430} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
