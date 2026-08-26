import { PACMAN, PACMAN_MAZE } from '../config/arcade'

export type Dir = 0 | 1 | 2 | 3 // N E S W
export const DC = [0, 1, 0, -1]
export const DR = [-1, 0, 1, 0]
export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir

export type Cell = 'wall' | 'door' | 'empty' | 'pellet' | 'power'

export type GhostId = 'blinky' | 'pinky' | 'inky' | 'clyde'
export type GhostMode = 'house' | 'scatter' | 'chase' | 'frightened' | 'eaten'

export interface Actor {
  x: number
  y: number
  dir: Dir
  next: Dir
}

export interface Ghost extends Actor {
  id: GhostId
  mode: GhostMode
  home: { x: number; y: number }
  scatter: { x: number; y: number }
  releaseAt: number
}

export interface PacmanState {
  cells: Cell[][]
  pelletsLeft: number
  player: Actor
  playerHome: { x: number; y: number }
  /** Tile just inside the ghost house — where an eaten ghost regenerates. */
  house: { x: number; y: number }
  ghosts: Ghost[]
  score: number
  lives: number
  combo: number
  frightened: number
  elapsed: number
  wave: number
  status: 'play' | 'won' | 'lost' | 'dying'
  dieTimer: number
}

const C = PACMAN.cols
const R = PACMAN.rows

function idxOk(c: number, r: number) {
  return r >= 0 && r < R && c >= 0 && c < C
}

export function wrapCol(c: number) {
  if (c < 0) return C - 1
  if (c >= C) return 0
  return c
}

export function parseMaze() {
  const cells: Cell[][] = []
  let player = { x: Math.floor(C / 2), y: R - 3 }
  let door = { x: Math.floor(C / 2), y: Math.floor(R / 2) - 1 }
  const ghostStarts: Partial<Record<GhostId, { x: number; y: number }>> = {}
  let pellets = 0
  for (let y = 0; y < R; y++) {
    const row = PACMAN_MAZE[y]
    const line: Cell[] = []
    for (let x = 0; x < C; x++) {
      const ch = row[x] ?? '#'
      if (ch === '#') line.push('wall')
      else if (ch === '-') {
        line.push('door')
        door = { x, y }
      } else if (ch === '.') {
        line.push('pellet')
        pellets++
      } else if (ch === 'o') {
        line.push('power')
        pellets++
      } else {
        line.push('empty')
        if (ch === 'P') player = { x, y }
        if (ch === 'B') ghostStarts.blinky = { x, y }
        if (ch === 'N') ghostStarts.pinky = { x, y }
        if (ch === 'I') ghostStarts.inky = { x, y }
        if (ch === 'C') ghostStarts.clyde = { x, y }
      }
    }
    cells.push(line)
  }
  return { cells, player, door, ghostStarts, pellets }
}

function walkable(cells: Cell[][], c: number, r: number, ghost: boolean) {
  const x = wrapCol(c)
  if (!idxOk(x, r)) return false
  const cell = cells[r][x]
  if (cell === 'wall') return false
  if (cell === 'door') return ghost
  return true
}

function canGo(cells: Cell[][], x: number, y: number, dir: Dir, ghost: boolean) {
  const nx = Math.round(x) + DC[dir]
  const ny = Math.round(y) + DR[dir]
  return walkable(cells, nx, ny, ghost)
}

function atCenter(a: Actor, eps = 0.12) {
  return Math.abs(a.x - Math.round(a.x)) < eps && Math.abs(a.y - Math.round(a.y)) < eps
}

function snap(a: Actor) {
  a.x = wrapCol(Math.round(a.x))
  a.y = Math.round(a.y)
}

function move(a: Actor, speed: number, dt: number, cells: Cell[][], ghost: boolean) {
  if (atCenter(a)) {
    snap(a)
    if (canGo(cells, a.x, a.y, a.next, ghost)) a.dir = a.next
    if (!canGo(cells, a.x, a.y, a.dir, ghost)) return false
  }
  a.x += DC[a.dir] * speed * dt
  a.y += DR[a.dir] * speed * dt
  if (a.x < -0.5) a.x += C
  if (a.x >= C - 0.5) a.x -= C
  return true
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.min(Math.abs(ax - bx), C - Math.abs(ax - bx))
  const dy = ay - by
  return dx * dx + dy * dy
}

function pickGhostDir(g: Ghost, cells: Cell[][], tx: number, ty: number) {
  const cx = Math.round(g.x)
  const cy = Math.round(g.y)
  const reverse = opposite(g.dir)
  const opts: Dir[] = []
  for (let d = 0; d < 4; d++) {
    const dir = d as Dir
    if (dir === reverse) continue
    if (canGo(cells, cx, cy, dir, true)) opts.push(dir)
  }
  if (!opts.length) {
    if (canGo(cells, cx, cy, reverse, true)) return reverse
    return g.dir
  }
  if (g.mode === 'frightened') return opts[Math.floor(Math.random() * opts.length)]
  let best = opts[0]
  let bestD = Infinity
  for (const d of opts) {
    const nx = wrapCol(cx + DC[d])
    const ny = cy + DR[d]
    const dd = dist(nx, ny, tx, ty)
    if (dd < bestD) {
      bestD = dd
      best = d
    }
  }
  return best
}

function ghostTarget(g: Ghost, s: PacmanState): { x: number; y: number } {
  if (g.mode === 'eaten') return s.house
  if (g.mode === 'house') return { x: s.house.x, y: s.house.y - 2 }
  if (g.mode === 'scatter') return g.scatter
  const p = s.player
  const pd = p.dir
  if (g.id === 'blinky') return { x: p.x, y: p.y }
  if (g.id === 'pinky') return { x: p.x + DC[pd] * 4, y: p.y + DR[pd] * 4 }
  if (g.id === 'inky') {
    const blinky = s.ghosts.find((h) => h.id === 'blinky')!
    const ax = p.x + DC[pd] * 2
    const ay = p.y + DR[pd] * 2
    return { x: ax * 2 - blinky.x, y: ay * 2 - blinky.y }
  }
  // clyde: chase if far, scatter if close (6 tiles, squared)
  if (dist(g.x, g.y, p.x, p.y) < 36) return g.scatter
  return { x: p.x, y: p.y }
}

function waveMode(elapsed: number): 'scatter' | 'chase' {
  // 7s scatter, 20s chase, 7s, 20s, then chase
  let t = elapsed
  const segs = [7, 20, 7, 20]
  for (const s of segs) {
    if (t < s) return s === 7 ? 'scatter' : 'chase'
    t -= s
  }
  return 'chase'
}

function makeGhost(
  id: GhostId,
  start: { x: number; y: number },
  scatter: { x: number; y: number },
  releaseAt: number,
  dir: Dir,
): Ghost {
  return {
    id,
    x: start.x,
    y: start.y,
    dir,
    next: dir,
    mode: releaseAt <= 0 ? 'scatter' : 'house',
    home: { ...start },
    scatter,
    releaseAt,
  }
}

export function createPacman(): PacmanState {
  const { cells, player, door, ghostStarts, pellets } = parseMaze()
  const house = { x: door.x, y: door.y + 1 }
  const blinky = ghostStarts.blinky ?? { x: door.x, y: door.y - 1 }
  const pinky = ghostStarts.pinky ?? house
  const inky = ghostStarts.inky ?? { x: house.x - 1, y: house.y }
  const clyde = ghostStarts.clyde ?? { x: house.x + 1, y: house.y }
  // Scatter corners: each ghost holds one corner of the board.
  const far = C - 3
  const low = R - 2
  return {
    cells,
    pelletsLeft: pellets,
    player: { x: player.x, y: player.y, dir: 3, next: 3 },
    playerHome: { ...player },
    house,
    ghosts: [
      makeGhost('blinky', blinky, { x: far, y: 1 }, 0, 0),
      makeGhost('pinky', pinky, { x: 2, y: 1 }, 1.2, 1),
      makeGhost('inky', inky, { x: far, y: low }, 4, 3),
      makeGhost('clyde', clyde, { x: 2, y: low }, 6, 1),
    ],
    score: 0,
    lives: PACMAN.lives,
    combo: 0,
    frightened: 0,
    elapsed: 0,
    wave: 0,
    status: 'play',
    dieTimer: 0,
  }
}

function resetPositions(s: PacmanState) {
  s.player.x = s.playerHome.x
  s.player.y = s.playerHome.y
  s.player.dir = 3
  s.player.next = 3
  for (const g of s.ghosts) {
    g.x = g.home.x
    g.y = g.home.y
    g.mode = g.releaseAt <= 0 ? 'scatter' : 'house'
    g.dir = 0
    g.next = 0
  }
  s.frightened = 0
  s.combo = 0
  s.elapsed = 0
}

/** Intent from WASD / arrows / D-pad: x right+, z down+ (matches town). */
export function intentToDir(x: number, z: number): Dir | null {
  if (Math.abs(x) < 0.4 && Math.abs(z) < 0.4) return null
  if (Math.abs(x) > Math.abs(z)) return x > 0 ? 1 : 3
  return z > 0 ? 2 : 0
}

export function stepPacman(s: PacmanState, dt: number, intent: Dir | null) {
  if (s.status === 'won' || s.status === 'lost') return
  if (s.status === 'dying') {
    s.dieTimer -= dt
    if (s.dieTimer <= 0) {
      s.lives -= 1
      if (s.lives <= 0) s.status = 'lost'
      else {
        s.status = 'play'
        resetPositions(s)
      }
    }
    return
  }

  s.elapsed += dt
  if (s.frightened > 0) s.frightened = Math.max(0, s.frightened - dt)
  const scatterOrChase = waveMode(s.elapsed)

  // Unlike arcade Pac-Man, he does NOT coast: no key held means he stands still
  // (the idle clip). A held direction is queued and taken at the next tile
  // centre, so he keeps his current heading until the turn is actually possible.
  if (intent != null) {
    s.player.next = intent
    move(s.player, PACMAN.playerSpeed, dt, s.cells, false)
  }

  if (atCenter(s.player)) {
    const cx = wrapCol(Math.round(s.player.x))
    const cy = Math.round(s.player.y)
    const cell = s.cells[cy]?.[cx]
    if (cell === 'pellet') {
      s.cells[cy][cx] = 'empty'
      s.pelletsLeft--
      s.score += 10
    } else if (cell === 'power') {
      s.cells[cy][cx] = 'empty'
      s.pelletsLeft--
      s.score += 50
      s.frightened = PACMAN.frightenedSecs
      s.combo = 0
      for (const g of s.ghosts) {
        if (g.mode !== 'eaten' && g.mode !== 'house') {
          g.mode = 'frightened'
          g.dir = opposite(g.dir)
        }
      }
    }
    if (s.pelletsLeft <= 0) s.status = 'won'
  }

  for (const g of s.ghosts) {
    if (g.mode === 'house' && s.elapsed >= g.releaseAt) g.mode = 'scatter'
    if (g.mode === 'eaten' && dist(g.x, g.y, s.house.x, s.house.y) < 0.4) {
      g.mode = 'house'
      g.releaseAt = s.elapsed + 0.6
    } else if (g.mode !== 'house' && g.mode !== 'eaten' && g.mode !== 'frightened') {
      g.mode = scatterOrChase
    } else if (g.mode === 'frightened' && s.frightened <= 0) {
      g.mode = scatterOrChase
    }

    const tgt = ghostTarget(g, s)
    if (atCenter(g)) {
      snap(g)
      g.dir = pickGhostDir(g, s.cells, tgt.x, tgt.y)
      g.next = g.dir
    }
    const spd =
      g.mode === 'eaten'
        ? PACMAN.eatenSpeed
        : g.mode === 'frightened'
          ? PACMAN.frightenedSpeed
          : PACMAN.ghostSpeed
    move(g, spd, dt, s.cells, true)

    if (s.status !== 'play') continue
    if (dist(g.x, g.y, s.player.x, s.player.y) < 0.45) {
      if (g.mode === 'frightened') {
        g.mode = 'eaten'
        s.combo++
        s.score += 200 * 2 ** (s.combo - 1)
      } else if (g.mode !== 'eaten' && g.mode !== 'house') {
        s.status = 'dying'
        s.dieTimer = 1.1
      }
    }
  }
}

export function tileToWorld(col: number, row: number) {
  const x = (col - (C - 1) / 2) * PACMAN.tile
  const z = (row - (R - 1) / 2) * PACMAN.tile
  return { x, z }
}

export function wallCells(cells: Cell[][]) {
  const out: { c: number; r: number }[] = []
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (cells[r][c] === 'wall') out.push({ c, r })
    }
  }
  return out
}
