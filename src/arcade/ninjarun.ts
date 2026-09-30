import {
  NINJA_ENEMY,
  NINJA_OBSTACLES,
  NINJA_RUN as N,
  type NinjaObstacleKind,
} from '../config/arcade'

/**
 * Ninja Run simulation — plain data, no three.js, stepped by NinjaRunWorld.
 *
 * Coordinates are runner-relative: the runner stands at x = 0 (feet at `y`) and
 * everything else scrolls toward −x at `speed`. `distance` is how far he's run.
 */

export type NinjaStatus = 'play' | 'dying' | 'lost'
export type NinjaSfx = 'jump' | 'doubleJump' | 'throw' | 'empty' | 'hit' | 'clink' | 'windup' | 'foeThrow' | 'parry' | 'die'

export interface NinjaThing {
  id: number
  x: number
  kind: NinjaObstacleKind | 'enemy'
  w: number
  h: number
  /** Enemies only: seconds since a shuriken felled it (null = alive). */
  downT: number | null
  /** Enemies only: x at which he winds up to throw (−∞ = he won't), seconds
   *  into the wind-up (null = not winding), and whether he's thrown already. */
  throwAt: number
  windT: number | null
  thrown: boolean
}

/** A rival's star, flying at the runner. */
export interface FoeStar {
  id: number
  x: number
  y: number
}

/** The puff of air left where he stepped on it to double-jump. */
export interface AirStep {
  id: number
  x: number
  y: number
  age: number
}

/** A burst of sparks: `big` for star-on-star, small for a clink. */
export interface Spark {
  id: number
  x: number
  y: number
  age: number
  big: boolean
}

export interface Shuriken {
  id: number
  x: number
  y: number
  /** Thrown from mid-air it angles down to the throwing line (so a jump-throw
   *  still meets a ninja instead of sailing over his head), then flies level. */
  vy: number
  /** Past its range: it arcs down into the path (harmless now). */
  falling: boolean
  /** Stuck in an obstacle or the ground: it rides along with the ground. */
  stuck: boolean
}

export interface NinjaState {
  status: NinjaStatus
  speed: number
  distance: number
  kills: number
  y: number
  vy: number
  grounded: boolean
  /** Seconds left on a buffered jump press. */
  jumpBuffer: number
  /** Mid-air jumps used since leaving the ground. */
  airJumpsUsed: number
  cooldown: number
  /** Stars in hand (0…shurikenMax), and seconds into refilling the next one. */
  ammo: number
  reload: number
  /** Rival stars knocked out of the air. */
  parries: number
  things: NinjaThing[]
  shuriken: Shuriken[]
  foeStars: FoeStar[]
  sparks: Spark[]
  airSteps: AirStep[]
  /** Distance at which the next thing spawns. */
  nextSpawn: number
  /** Seconds into the death stumble. */
  dieT: number
  nextId: number
  rand: () => number
}

export function ninjaScore(s: NinjaState) {
  return Math.floor(s.distance) + s.kills * N.enemyScore + s.parries * N.parryScore
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createNinjaRun(seed = (Math.random() * 2 ** 32) >>> 0): NinjaState {
  return {
    status: 'play',
    speed: N.speed,
    distance: 0,
    kills: 0,
    y: 0,
    vy: 0,
    grounded: true,
    jumpBuffer: 0,
    airJumpsUsed: 0,
    cooldown: 0,
    ammo: N.shurikenMax,
    reload: 0,
    parries: 0,
    things: [],
    shuriken: [],
    foeStars: [],
    sparks: [],
    airSteps: [],
    // A clear stretch to get going before the first rock.
    nextSpawn: N.spawnX * 0.6,
    dieT: 0,
    nextId: 1,
    rand: mulberry32(seed),
  }
}

/** Where a star leaves his hand, how fast a spent one drops, and the height it
 *  sticks at (half buried in the path). */
const LAUNCH_X = 0.45
const FALL_SPEED = 7
const STUCK_Y = 0.08

const OBSTACLE_KINDS = Object.keys(NINJA_OBSTACLES) as NinjaObstacleKind[]

function spawn(s: NinjaState) {
  const r = s.rand
  const enemy = s.distance >= N.enemyAfter && r() < N.enemyChance
  if (enemy) {
    // He walks toward you, closing on whatever spawned before him — start him
    // back by the ground he'll cover on the way in, so he arrives on the gap.
    const x = N.spawnX + (N.enemyWalk * N.spawnX) / s.speed
    const throws = s.distance >= N.enemyThrowAfter && r() < N.enemyThrowChance
    const throwAt = throws ? N.enemyThrowTo + r() * (N.enemyThrowFrom - N.enemyThrowTo) : -Infinity
    s.things.push({ id: s.nextId++, x, kind: 'enemy', ...NINJA_ENEMY, downT: null, throwAt, windT: null, thrown: false })
  } else {
    const kind = OBSTACLE_KINDS[Math.floor(r() * OBSTACLE_KINDS.length)]
    s.things.push({
      id: s.nextId++,
      x: N.spawnX,
      kind,
      ...NINJA_OBSTACLES[kind],
      downT: null,
      throwAt: -Infinity,
      windT: null,
      thrown: false,
    })
  }
  // Gap in seconds of travel → metres. Never shorter than a full jump + a beat,
  // so every pair of hazards is clearable.
  const air = 2 * Math.sqrt((2 * N.jumpHeight) / N.gravity)
  const secs = Math.max(air + 0.3, N.gapMin + r() * (N.gapMax - N.gapMin))
  s.nextSpawn = s.distance + secs * s.speed
}

function addSpark(s: NinjaState, x: number, y: number, big: boolean) {
  s.sparks.push({ id: s.nextId++, x, y, age: 0, big })
}

/** Sparks and air-step puffs hang where they burst (riding the scroll) and fade. */
function ageSparks(s: NinjaState, dt: number, dx: number) {
  for (const k of s.sparks) {
    k.age += dt
    k.x -= dx
  }
  s.sparks = s.sparks.filter((k) => k.age < N.sparkSecs)
  for (const a of s.airSteps) {
    a.age += dt
    a.x -= dx
  }
  s.airSteps = s.airSteps.filter((a) => a.age < N.airStepSecs)
}

function overlaps(ax0: number, ax1: number, ay0: number, ay1: number, t: NinjaThing) {
  return ax1 > t.x - t.w / 2 && ax0 < t.x + t.w / 2 && ay1 > 0 && ay0 < t.h
}

/** Advance one frame. `jump`/`fire` are this frame's fresh presses. */
export function stepNinjaRun(s: NinjaState, dt: number, jump: boolean, fire: boolean): NinjaSfx[] {
  const events: NinjaSfx[] = []

  if (s.status === 'lost') return events
  if (s.status === 'dying') {
    ageSparks(s, dt, 0)
    s.dieT += dt
    // Fall back to the ground if he was hit mid-air.
    if (s.y > 0) {
      s.vy -= N.gravity * dt
      s.y = Math.max(0, s.y + s.vy * dt)
    }
    if (s.dieT >= N.dieSecs) s.status = 'lost'
    return events
  }

  // --- speed + distance ------------------------------------------------------
  s.speed = Math.min(N.maxSpeed, s.speed + N.speedRamp * dt)
  const dx = s.speed * dt
  s.distance += dx

  // --- jump --------------------------------------------------------------------
  if (jump && !s.grounded && s.airJumpsUsed < N.airJumps) {
    // Double jump: he steps on the air and kicks off again from wherever he
    // is, leaving a puff of misty air under his feet where he stepped.
    s.vy = Math.sqrt(2 * N.gravity * N.doubleJumpHeight)
    s.airJumpsUsed++
    s.jumpBuffer = 0
    s.airSteps.push({ id: s.nextId++, x: 0, y: s.y, age: 0 })
    events.push('doubleJump')
  } else if (jump) s.jumpBuffer = N.jumpBuffer
  else s.jumpBuffer = Math.max(0, s.jumpBuffer - dt)
  if (s.grounded && s.jumpBuffer > 0) {
    s.vy = Math.sqrt(2 * N.gravity * N.jumpHeight)
    s.grounded = false
    s.jumpBuffer = 0
    events.push('jump')
  }
  if (!s.grounded) {
    s.vy -= N.gravity * dt
    s.y += s.vy * dt
    if (s.y <= 0) {
      s.y = 0
      s.vy = 0
      s.grounded = true
      s.airJumpsUsed = 0
    }
  }

  // --- shuriken ----------------------------------------------------------------
  s.cooldown = Math.max(0, s.cooldown - dt)
  if (s.ammo < N.shurikenMax) {
    s.reload += dt
    if (s.reload >= N.shurikenRecharge) {
      s.ammo++
      s.reload = 0
    }
  } else s.reload = 0
  if (fire && s.cooldown === 0) {
    if (s.ammo > 0) {
      s.ammo--
      s.cooldown = N.shurikenCooldown
      const y = s.y + N.shurikenY
      s.shuriken.push({
        id: s.nextId++,
        x: LAUNCH_X,
        y,
        vy: -(y - N.shurikenY) / N.shurikenDrop,
        falling: false,
        stuck: false,
      })
      events.push('throw')
    } else events.push('empty')
  }

  // --- scroll the world ---------------------------------------------------------
  for (const t of s.things) {
    t.x -= dx
    if (t.kind !== 'enemy') continue
    if (t.downT !== null) {
      t.downT += dt
      continue
    }
    t.x -= N.enemyWalk * dt
    // Wind up once he's close enough (a red glint in his hand), then throw.
    if (!t.thrown && t.windT === null && t.x <= t.throwAt) {
      t.windT = 0
      events.push('windup')
    } else if (t.windT !== null) {
      t.windT += dt
      if (t.windT >= N.enemyWindup) {
        t.windT = null
        t.thrown = true
        s.foeStars.push({ id: s.nextId++, x: t.x - 0.35, y: N.shurikenY })
        events.push('foeThrow')
      }
    }
  }
  const foeFrom = new Map<number, number>()
  for (const f of s.foeStars) {
    foeFrom.set(f.id, f.x - dx)
    f.x -= dx + N.foeStarSpeed * dt
  }
  // Where each flying star started this frame, so the hit test sweeps the whole
  // step (at low fps a star moves further than an enemy is wide).
  const from = new Map<number, number>()
  for (const k of s.shuriken) {
    if (k.stuck) k.x -= dx
    else if (k.falling) {
      // Spent: carries on a little, drops, and sticks point-first in the path.
      k.x += N.shurikenSpeed * 0.3 * dt - dx
      k.y -= FALL_SPEED * dt
      if (k.y <= STUCK_Y) {
        k.y = STUCK_Y
        k.stuck = true
      }
    } else {
      from.set(k.id, k.x - dx) // in this frame's scrolled coords
      k.x += N.shurikenSpeed * dt
      if (k.vy < 0) k.y = Math.max(N.shurikenY, k.y + k.vy * dt)
      if (k.x >= LAUNCH_X + N.shurikenRange) k.falling = true
    }
  }

  // --- shuriken hits ------------------------------------------------------------
  const R = N.shurikenRadius
  for (const k of s.shuriken) {
    if (k.stuck || k.falling) continue
    for (const t of s.things) {
      if (t.downT !== null) continue
      if (!overlaps((from.get(k.id) ?? k.x) - R, k.x + R, k.y - R, k.y + R, t)) continue
      if (t.kind === 'enemy') {
        t.downT = 0
        t.windT = null // felled mid-wind-up: no throw
        s.kills++
        k.x = Infinity // spent — culled below
        events.push('hit')
      } else {
        k.stuck = true
        k.x = Math.min(k.x, t.x - t.w / 2 + R * 0.5)
        addSpark(s, k.x, k.y, false)
        events.push('clink')
      }
      break
    }
  }

  // --- star meets star: both shatter in a burst of sparks --------------------------
  // Swept on x (they close at ~40 u/s, far more than their width per frame).
  for (const k of s.shuriken) {
    if (k.stuck || k.falling || !Number.isFinite(k.x)) continue
    const a0 = from.get(k.id) ?? k.x
    for (const f of s.foeStars) {
      if (!Number.isFinite(f.x) || Math.abs(k.y - f.y) > 2 * R + 0.1) continue
      const d0 = (foeFrom.get(f.id) ?? f.x) - a0
      const d1 = f.x - k.x
      if (Math.min(d0, d1) > 2 * R || Math.max(d0, d1) < -2 * R) continue
      addSpark(s, (k.x + f.x) / 2, (k.y + f.y) / 2, true)
      s.parries++
      // A parry is free: the star comes back to hand, so negating a throw is a
      // real alternative to jumping it (and a kill shot that happens to meet
      // his star doesn't leave you empty with him still coming).
      s.ammo = Math.min(N.shurikenMax, s.ammo + 1)
      k.x = Infinity
      f.x = -Infinity
      events.push('parry')
      break
    }
  }
  // Their stars clink off obstacles too (a stump shields you, same as it blocks you).
  for (const f of s.foeStars) {
    if (!Number.isFinite(f.x)) continue
    for (const t of s.things) {
      if (t.kind === 'enemy') continue
      if (!overlaps(f.x - R, (foeFrom.get(f.id) ?? f.x) + R, f.y - R, f.y + R, t)) continue
      addSpark(s, t.x + t.w / 2, f.y, false)
      f.x = -Infinity
      events.push('clink')
      break
    }
  }

  // --- runner hit ----------------------------------------------------------------
  const hw = N.runnerHalfW
  for (const t of s.things) {
    if (t.downT !== null) continue
    const h = t.kind === 'enemy' && N.enemiesJumpable ? Math.min(t.h, 0.9) : t.h
    if (overlaps(-hw, hw, s.y, s.y + N.runnerH, { ...t, h })) {
      s.status = 'dying'
      s.dieT = 0
      events.push('die')
      break
    }
  }
  if (s.status === 'play') {
    for (const f of s.foeStars) {
      if (!Number.isFinite(f.x)) continue
      const x0 = foeFrom.get(f.id) ?? f.x
      const hitX = f.x - R < hw && x0 + R > -hw
      const hitY = f.y + R > s.y && f.y - R < s.y + N.runnerH
      if (hitX && hitY) {
        s.status = 'dying'
        s.dieT = 0
        events.push('die')
        break
      }
    }
  }

  // --- spawn + cull -----------------------------------------------------------------
  if (s.distance >= s.nextSpawn) spawn(s)
  s.things = s.things.filter((t) => t.x > N.despawnX && (t.downT === null || t.downT < 1.2))
  s.shuriken = s.shuriken.filter((k) => k.x < N.spawnX + 2 && k.x > N.despawnX)
  s.foeStars = s.foeStars.filter((f) => f.x > N.despawnX)
  ageSparks(s, dt, dx)

  return events
}
