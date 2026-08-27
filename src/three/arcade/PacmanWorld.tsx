import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnimations, useKeyboardControls } from '@react-three/drei'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from '../gltf'
import { PACMAN, GHOST_COLORS } from '../../config/arcade'
import {
  createPacman,
  intentToDir,
  stepPacman,
  tileToWorld,
  wallCells,
  type Dir,
  type Ghost,
  type PacmanState,
} from '../../arcade/pacman'
import { arcadeMove } from '../../systems/input'
import { arcadeFocus } from '../../systems/arcadeFocus'
import { useGame } from '../../state/store'
import { useShadowDispose } from '../useShadowDispose'
import { createPacmanSfx } from './pacmanSfx'
import { getMazeMaterials, MAZE_FLOOR_PAD, type MazeMaterials } from './mazeMaterials'
import type { CharAnim } from '../Figure'

const MODEL = '/models/character.glb'
const FADE = 0.12
const RUN_GAIT = 'run'
// Ground speed (world u/s) the run clip depicts at timeScale 1 (matches the
// town's RiggedFigure STRIDE.run), and the slowest we'll let it play before it
// reads as slow motion.
const STRIDE_RUN = 4.0
const MIN_TIMESCALE = 0.6
const _ghostQuat = new THREE.Quaternion()
const _ghostUp = new THREE.Vector3(0, 1, 0)

function tileWorld(col: number, row: number) {
  return tileToWorld(col, row)
}

function yawFromDir(dir: Dir) {
  const mx = dir === 1 ? 1 : dir === 3 ? -1 : 0
  const mz = dir === 2 ? 1 : dir === 0 ? -1 : 0
  return Math.atan2(mx, mz)
}

function PacmanFigure({ anim }: { anim: RefObject<CharAnim> }) {
  const root = useRef<THREE.Group>(null!)
  const { scene, animations } = useTownGLTF(MODEL)
  const model = useMemo(() => skeletonClone(scene), [scene])
  const { actions } = useAnimations(animations, model)
  const playing = useRef('')

  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.castShadow = true
        m.receiveShadow = true
      }
    })
  }, [model])

  useEffect(() => {
    actions.idle?.reset().fadeIn(FADE).play()
    playing.current = 'idle'
  }, [actions])

  useFrame(() => {
    const gait = anim.current.gait
    if (playing.current !== gait) {
      const next = actions[gait]
      if (next) {
        actions[playing.current]?.fadeOut(FADE)
        next.reset().fadeIn(FADE).play()
        playing.current = gait
      }
    }
    const clip = actions[gait]
    if (clip && gait === RUN_GAIT) {
      clip.timeScale = Math.max(MIN_TIMESCALE, anim.current.speed / STRIDE_RUN)
    }
  })

  return (
    <group ref={root} scale={PACMAN.figureScale}>
      <primitive object={model} />
    </group>
  )
}

function GhostMesh({ ghost, state }: { ghost: Ghost; state: PacmanState }) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(() => {
    const g = state.ghosts.find((h) => h.id === ghost.id)
    if (!g || !ref.current) return
    const { x, z } = tileWorld(g.x, g.y)
    ref.current.position.set(x, 0.36, z)
    const color =
      g.mode === 'frightened'
        ? GHOST_COLORS.frightened
        : g.mode === 'eaten'
          ? '#e8eef6'
          : GHOST_COLORS[g.id]
    const body = ref.current.children[0] as THREE.Mesh
    const mat = body.material as THREE.MeshLambertMaterial
    mat.color.set(color)
    const moving = Math.hypot(g.x - Math.round(g.x), g.y - Math.round(g.y)) > 0.02
    if (moving) {
      ref.current.quaternion.slerp(
        _ghostQuat.setFromAxisAngle(_ghostUp, yawFromDir(g.dir)),
        0.25,
      )
    }
    ref.current.scale.setScalar(g.mode === 'eaten' ? 0.45 : 1)
  })
  return (
    <group ref={ref}>
      <mesh castShadow>
        <capsuleGeometry args={[0.28, 0.3, 4, 10]} />
        <meshLambertMaterial color={GHOST_COLORS[ghost.id]} />
      </mesh>
      <mesh position={[0.11, 0.24, 0.19]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshLambertMaterial color="#f4f7fb" />
      </mesh>
      <mesh position={[-0.11, 0.24, 0.19]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshLambertMaterial color="#f4f7fb" />
      </mesh>
    </group>
  )
}

function Pellets({ state, mats }: { state: PacmanState; mats: MazeMaterials }) {
  const group = useRef<THREE.Group>(null!)
  const dots = useMemo(() => {
    const list: { c: number; r: number; power: boolean }[] = []
    for (let r = 0; r < PACMAN.rows; r++) {
      for (let c = 0; c < PACMAN.cols; c++) {
        const cell = state.cells[r][c]
        if (cell === 'pellet' || cell === 'power') list.push({ c, r, power: cell === 'power' })
      }
    }
    return list
  }, [state])

  useFrame(() => {
    const g = group.current
    if (!g) return
    let i = 0
    for (const child of g.children) {
      const d = dots[i++]
      if (!d) break
      const cell = state.cells[d.r][d.c]
      child.visible = cell === 'pellet' || cell === 'power'
    }
  })

  return (
    <group ref={group}>
      {dots.map((d) => {
        const { x, z } = tileWorld(d.c, d.r)
        return d.power ? (
          <mesh key={`${d.c},${d.r}`} position={[x, 0.34, z]} material={mats.power} dispose={null}>
            <octahedronGeometry args={[0.26, 0]} />
          </mesh>
        ) : (
          <mesh key={`${d.c},${d.r}`} position={[x, 0.24, z]} material={mats.pellet} dispose={null}>
            <boxGeometry args={[0.21, 0.21, 0.21]} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Deterministic 0..1 from a wall cell, so the maze looks the same every visit. */
function wallRand(c: number, r: number, salt: number) {
  let s = Math.imul(c + 1, 73856093) ^ Math.imul(r + 1, 19349663) ^ Math.imul(salt, 83492791)
  s = Math.imul(s ^ (s >>> 16), 0x7feb352d)
  s = Math.imul(s ^ (s >>> 15), 0x846ca68b)
  return ((s ^ (s >>> 16)) >>> 0) / 4294967296
}

function wallN(c: number, r: number, salt: number) {
  return wallRand(c, r, salt) * 2 - 1
}

/**
 * The maze blocks. The south border row is skipped: it's the nearest edge to
 * this raking camera, so drawing it puts a wall across the bottom of the frame
 * and hides the corridor behind it. The player still can't walk out — the row is
 * a wall in the sim either way.
 *
 * Each block is nudged a little (yaw, tilt, height, footprint) so a long wall
 * isn't a single machined plane. Collision still uses the grid — this is look
 * only, and the offsets stay well inside a tile.
 */
function MazeWalls({ state, mats }: { state: PacmanState; mats: MazeMaterials }) {
  const walls = useMemo(
    () => wallCells(state.cells).filter(({ r }) => r < PACMAN.rows - 1),
    [state],
  )
  const t = PACMAN.tile
  const h = PACMAN.wallH
  const geom = useMemo(() => new THREE.BoxGeometry(t * 0.98, h, t * 0.98), [t, h])
  useEffect(() => () => geom.dispose(), [geom])
  return (
    <group>
      {walls.map(({ c, r }) => {
        const { x, z } = tileWorld(c, r)
        const sh = 1 + wallN(c, r, 1) * 0.16
        return (
          <mesh
            key={`${c},${r}`}
            geometry={geom}
            position={[x + wallN(c, r, 2) * 0.045, (h * sh) / 2, z + wallN(c, r, 3) * 0.045]}
            rotation={[wallN(c, r, 4) * 0.018, wallN(c, r, 5) * 0.045, wallN(c, r, 6) * 0.018]}
            scale={[1 + wallN(c, r, 7) * 0.05, sh, 1 + wallN(c, r, 8) * 0.05]}
            castShadow
            receiveShadow
            material={mats.wall}
            dispose={null}
          />
        )
      })}
    </group>
  )
}

/**
 * Pac-Man on the same ortho camera as the café: stone-block maze, yellow cube
 * pellets, simple 3D ghosts, and a cloned player character that runs while a
 * direction is held.
 */
export function PacmanWorld() {
  const gl = useThree((s) => s.gl)
  const mats = useMemo(() => getMazeMaterials(gl), [gl])
  const state = useRef<PacmanState>(createPacman())
  const player = useRef<THREE.Group>(null!)
  const yaw = useRef(yawFromDir(3))
  const anim = useRef<CharAnim>({
    moving: false,
    phase: 0,
    speed: 0,
    gait: 'idle',
    jumpSeq: 0,
    jumpKind: 'jump',
    jumping: false,
  })
  const lastHud = useRef('')
  const pausedSfx = useRef(false)
  const sfx = useRef<ReturnType<typeof createPacmanSfx> | null>(null)
  const sun = useRef<THREE.DirectionalLight>(null!)
  useShadowDispose(sun)
  const [, getKeys] = useKeyboardControls()

  useEffect(() => {
    const bank = createPacmanSfx()
    sfx.current = bank
    return () => {
      bank.dispose()
      sfx.current = null
    }
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()
    const paused = !!st.arcade?.paused || !!st.transition
    const s = state.current

    if (paused !== pausedSfx.current) {
      pausedSfx.current = paused
      sfx.current?.setPaused(paused)
    }

    if (!paused && s.status !== 'won' && s.status !== 'lost') {
      const { forward, back, left, right } = getKeys()
      let ix = arcadeMove.x
      let iz = arcadeMove.z
      if (forward) iz = -1
      if (back) iz = 1
      if (left) ix = -1
      if (right) ix = 1
      const intent = s.status === 'play' ? intentToDir(ix, iz) : null
      const px = s.player.x
      const py = s.player.y
      const events = stepPacman(s, dt, intent)
      if (events.length) sfx.current?.play(events)
      const moved = s.status === 'play' && Math.hypot(s.player.x - px, s.player.y - py) > 0.0001
      anim.current.moving = moved
      anim.current.gait = moved ? RUN_GAIT : 'idle'
      anim.current.speed = moved ? PACMAN.playerSpeed * PACMAN.tile : 0
      if (moved) {
        const target = yawFromDir(s.player.dir)
        let d = ((target - yaw.current + Math.PI) % (Math.PI * 2)) - Math.PI
        if (d < -Math.PI) d += Math.PI * 2
        yaw.current += d * Math.min(1, dt * 14)
      }
    }

    const { x, z } = tileWorld(s.player.x, s.player.y)
    arcadeFocus.x = x
    arcadeFocus.z = z
    if (player.current) {
      player.current.position.set(x, 0, z)
      player.current.rotation.y = yaw.current
    }

    const hud = {
      score: s.score,
      lives: s.lives,
      status: s.status,
      paused: !!st.arcade?.paused,
    }
    const key = `${hud.score}|${hud.lives}|${hud.status}|${hud.paused}`
    if (key !== lastHud.current) {
      lastHud.current = key
      st.setArcade(hud)
    }
  })

  // Oversized: at the town zoom the view is wider than the board, so the floor
  // must reach past the frame or the dark void beyond the board would show.
  const floorW = PACMAN.cols * PACMAN.tile + MAZE_FLOOR_PAD
  const floorD = PACMAN.rows * PACMAN.tile + MAZE_FLOOR_PAD

  return (
    <group>
      <ambientLight intensity={0.62} color="#e8e4dc" />
      {/* Cool fill opposite the key sun — PBR walls go muddy on the shadow side
          without a bounce, and the bevel/clearcoat has nothing to catch. */}
      <directionalLight position={[-10, 8, -8]} intensity={0.4} color="#aecbe6" />
      {/* The shadow biases matter here: without them the blocks self-shadow and
          every wall top picks up acne streaks, muddying the whole maze. */}
      <directionalLight
        ref={sun}
        position={[8, 16, 10]}
        intensity={1.65}
        color="#fff1d6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        material={mats.floor}
        dispose={null}
      >
        <planeGeometry args={[floorW, floorD]} />
      </mesh>
      <MazeWalls state={state.current} mats={mats} />
      <Pellets state={state.current} mats={mats} />
      {state.current.ghosts.map((g) => (
        <GhostMesh key={g.id} ghost={g} state={state.current} />
      ))}
      <group ref={player}>
        <PacmanFigure anim={anim} />
      </group>
    </group>
  )
}

useTownGLTF.preload(MODEL)
