import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
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
import type { CharAnim } from '../Figure'

const MODEL = '/models/character.glb'
const FADE = 0.12
// Ground speed (world u/s) the ninja-run clip depicts at timeScale 1, and the
// slowest we'll let it play — below this it reads as slow motion, so we accept a
// little foot-slide instead.
const STRIDE_NINJA = 5.5
const MIN_TIMESCALE = 0.8
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
    if (clip && gait === 'ninja-run') {
      clip.timeScale = Math.max(MIN_TIMESCALE, anim.current.speed / STRIDE_NINJA)
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

function Pellets({ state }: { state: PacmanState }) {
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
          <mesh key={`${d.c},${d.r}`} position={[x, 0.32, z]}>
            <octahedronGeometry args={[0.2, 0]} />
            <meshLambertMaterial color="#ffe066" emissive="#ffcc33" emissiveIntensity={0.8} />
          </mesh>
        ) : (
          <mesh key={`${d.c},${d.r}`} position={[x, 0.22, z]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshLambertMaterial color="#ffd54a" emissive="#e6b800" emissiveIntensity={0.55} />
          </mesh>
        )
      })}
    </group>
  )
}

/**
 * The maze blocks. The south border row is skipped: it's the nearest edge to
 * this raking camera, so drawing it puts a wall across the bottom of the frame
 * and hides the corridor behind it. The player still can't walk out — the row is
 * a wall in the sim either way.
 */
function MazeWalls({ state }: { state: PacmanState }) {
  const walls = useMemo(
    () => wallCells(state.cells).filter(({ r }) => r < PACMAN.rows - 1),
    [state],
  )
  const t = PACMAN.tile
  const h = PACMAN.wallH
  return (
    <group>
      {walls.map(({ c, r }) => {
        const { x, z } = tileWorld(c, r)
        return (
          <mesh key={`${c},${r}`} position={[x, h / 2, z]} castShadow receiveShadow>
            <boxGeometry args={[t * 0.98, h, t * 0.98]} />
            <meshLambertMaterial color="#7b8391" />
          </mesh>
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
  const [, getKeys] = useKeyboardControls()

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = useGame.getState()
    const paused = !!st.arcade?.paused || !!st.transition
    const s = state.current

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
      stepPacman(s, dt, intent)
      const moved = s.status === 'play' && Math.hypot(s.player.x - px, s.player.y - py) > 0.0001
      anim.current.moving = moved
      anim.current.gait = moved ? 'ninja-run' : 'idle'
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

  const floorW = PACMAN.cols * PACMAN.tile + 1.2
  const floorD = PACMAN.rows * PACMAN.tile + 1.2

  return (
    <group>
      <ambientLight intensity={0.75} color="#e8e4dc" />
      {/* The shadow biases matter here: without them the blocks self-shadow and
          every wall top picks up acne streaks, muddying the whole maze. */}
      <directionalLight
        position={[8, 16, 10]}
        intensity={1.4}
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[floorW, floorD]} />
        <meshLambertMaterial color="#39404b" />
      </mesh>
      <MazeWalls state={state.current} />
      <Pellets state={state.current} />
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
