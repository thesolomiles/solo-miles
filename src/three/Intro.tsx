import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import { INTRO, intro, type IntroPhase } from '../systems/intro'
import { playIncoming, playLand, setWindLevel, setWindRush, startWind, stopWind } from '../systems/introSfx'

const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined
// Dev shortcut: `?skipintro` drops you straight into the game.
const SKIP = import.meta.env.DEV && !!params?.has('skipintro')

const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

/**
 * Runs the opening sequence (see systems/intro.ts for the phases). Mounted only
 * until the game starts. Every timer uses the same clamped dt as the rest of the
 * scene, so a hitch slows the sequence down rather than skipping part of it.
 */
export function IntroDirector({ posRef }: { posRef: RefObject<THREE.Vector3> }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const t = useRef(0) // seconds into the current phase
  const steady = useRef(0)
  const compile = useRef<'no' | 'busy' | 'done'>('no')
  const steadySince = useRef(0)
  const exitAt = useRef(Infinity) // sky-clock time the exit drop begins
  const vy = useRef(0)
  const landed = useRef(false)
  const incoming = useRef(false)
  const landAt = useRef(0)
  const shake = useRef(0)
  const dust = useRef<DustHandle>(null)

  const setPhase = (p: IntroPhase) => {
    t.current = 0
    useGame.getState().setIntroPhase(p)
  }

  useEffect(() => {
    const st = useGame.getState()
    // Dev shortcuts that boot into another world (?cafe, ?ride=) skip it too.
    if (SKIP || st.interior || st.ride || st.minigame) st.start()
    return () => stopWind()
  }, [])

  useFrame((_, delta) => {
    const st = useGame.getState()
    if (st.started) return
    if (st.interior || st.ride || st.minigame) {
      st.start()
      return
    }
    const dt = intro.hold ? 0 : Math.min(delta, 0.05)
    t.current += dt
    const now = t.current

    switch (st.introPhase) {
      case 'boot': {
        // First 3D frame: the player model is in, so hand over from the CSS sky.
        setPhase('sky')
        exitAt.current = Infinity
        // Start the wind now. Until the page gets a click / tap / key it's
        // silent (audio suspended); the first gesture ANYWHERE resumes it and
        // the howl fades in while they float — not only the Start button.
        startWind()
        break
      }
      case 'sky': {
        intro.camY = INTRO.skyAlt
        intro.zoom = INTRO.skyZoom
        intro.pose = 'fall'
        intro.tilt = INTRO.skyTilt
        intro.roll = Math.sin(now * 1.7) * 0.14

        // Ready to leave once the town has loaded, its shaders are compiled
        // (async, so the freefall doesn't hitch) and frames are steady.
        if (intro.townReady && compile.current === 'no') {
          compile.current = 'busy'
          const done = () => {
            compile.current = 'done'
            steadySince.current = performance.now()
          }
          gl.compileAsync(scene, camera).then(done, done)
        }
        if (compile.current === 'done') {
          steady.current = delta < INTRO.steadyDt ? steady.current + 1 : 0
          const waited = (performance.now() - steadySince.current) / 1000
          const ready = steady.current >= INTRO.steadyFrames || waited > INTRO.steadyMaxSec
          if (ready && !st.introReady && now >= INTRO.skySec) st.setIntroReady()
        }
        // Start pressed: float a beat in the wind, then drop out of frame.
        if (st.introGo && exitAt.current === Infinity) exitAt.current = now + INTRO.goDelay

        // Fall into frame, hang there with a gentle bob, then gravity takes over
        // and they drop out of the bottom while the camera holds.
        const k = Math.min(1, now / INTRO.enterSec)
        const enter = (1 - easeOut(k)) * INTRO.enterFrom
        const bob = Math.sin(now * 2.4) * 0.18
        const tau = Math.max(0, now - exitAt.current)
        intro.y =
          INTRO.skyAlt + enter + bob * (1 - Math.min(1, tau * 4)) - 0.5 * INTRO.exitGravity * tau * tau
        // The CSS sky's clouds + streaks rush faster as they drop away.
        if (tau > 0) {
          setSkyRate(1 + tau * 2.2)
          setWindRush(Math.min(1, tau / INTRO.exitSec))
        }
        if (tau >= INTRO.exitSec) {
          // The wind carries on into the town, softer; it dies out after landing.
          setWindLevel(0.35)
          setPhase('cut')
        }
        break
      }
      case 'cut': {
        if (now >= INTRO.cutSec) {
          intro.camY = 0
          intro.zoom = INTRO.startZoom
          intro.tilt = 0
          intro.roll = 0
          intro.y = INTRO.dropHeight
          vy.current = INTRO.dropSpeed
          landed.current = false
          setPhase('drop')
        }
        break
      }
      case 'drop': {
        if (now < INTRO.dropDelay) break
        if (!landed.current && !incoming.current) {
          incoming.current = true
          // Time the whoosh to peak on impact: solve the drop's fall time.
          const v = INTRO.dropSpeed
          const g = INTRO.dropGravity
          playIncoming((-v + Math.sqrt(v * v + 2 * g * INTRO.dropHeight)) / g)
        }
        if (!landed.current) {
          vy.current += INTRO.dropGravity * dt
          intro.y -= vy.current * dt
          if (intro.y <= 0) {
            intro.y = 0
            landed.current = true
            landAt.current = now
            intro.pose = 'land'
            dust.current?.burst(posRef.current)
            playLand()
            stopWind(2.2)
            shake.current = 0.3
          }
        } else if (now >= landAt.current + INTRO.landSec) {
          intro.pose = null
          setPhase('zoom')
        }
        break
      }
      case 'zoom': {
        const k = Math.min(1, now / INTRO.zoomSec)
        intro.zoom = THREE.MathUtils.lerp(INTRO.startZoom, 1, easeOut(k))
        if (k >= 1) {
          intro.zoom = 1
          st.start()
        }
        break
      }
    }

    // Impact shake: a quick decaying jitter, mostly vertical.
    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - dt)
      const a = (shake.current / 0.3) ** 2 * 0.12
      intro.shakeX = (Math.random() - 0.5) * a
      intro.shakeY = (Math.random() - 0.5) * a * 1.6
    } else {
      intro.shakeX = intro.shakeY = 0
    }
  })

  return (
    <>
      <LandingDust handle={dust} />
    </>
  )
}

/** Playback rate of index.html's CSS sky animations (clouds + wind streaks). */
function setSkyRate(rate: number) {
  const el = document.getElementById('boot-sky')
  el?.getAnimations({ subtree: true }).forEach((a) => (a.playbackRate = rate))
}

/** Rendered inside the town's Suspense boundary: mounts once its models load. */
export function TownReady() {
  useEffect(() => {
    intro.townReady = true
  }, [])
  return null
}

// ---------------------------------------------------------------------------
// Landing dust: puffs kicked out from the feet along the ground, a flat shock
// ring, and a few specks of grit hopping away.

interface DustHandle {
  burst: (at: THREE.Vector3) => void
}

const PUFFS = 20
const GRIT = 14
const DUST_LIFE = 1.1

function discTexture(): THREE.CanvasTexture {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.5, 'rgba(255,255,255,0.7)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

/** A feathered ring (soft on both edges) for the ground shockwave. */
function ringTexture(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0, 'rgba(255,255,255,0)')
  grd.addColorStop(0.55, 'rgba(255,255,255,0.05)')
  grd.addColorStop(0.82, 'rgba(255,255,255,0.9)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}

interface Particle {
  p: THREE.Vector3
  v: THREE.Vector3
  size: number
  life: number
}

function LandingDust({ handle }: { handle: RefObject<DustHandle | null> }) {
  const tex = useMemo(discTexture, [])
  const ringTex = useMemo(ringTexture, [])
  useEffect(
    () => () => {
      tex.dispose()
      ringTex.dispose()
    },
    [tex, ringTex],
  )
  const puffRefs = useRef<THREE.Sprite[]>([])
  const gritRefs = useRef<THREE.Sprite[]>([])
  const ring = useRef<THREE.Mesh>(null!)
  const age = useRef(Infinity)
  // Keep everything drawable (at opacity 0) for the first few frames so it's
  // part of the sky phase's shader compile rather than hitching the landing.
  const warm = useRef(3)
  const origin = useRef(new THREE.Vector3())
  const puffs = useMemo<Particle[]>(
    () =>
      Array.from({ length: PUFFS }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        size: 0,
        life: 0,
      })),
    [],
  )
  const grit = useMemo<Particle[]>(
    () =>
      Array.from({ length: GRIT }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        size: 0,
        life: 0,
      })),
    [],
  )

  // Expose burst() through the ref the director holds.
  useEffect(() => {
    handle.current = {
      burst: (at) => {
        origin.current.copy(at).setY(0)
        age.current = 0
        puffs.forEach((d, i) => {
          const a = (i / PUFFS) * Math.PI * 2 + Math.random() * 0.4
          const sp = 1.6 + Math.random() * 3.4
          d.p.set(at.x + Math.cos(a) * 0.3, 0.1 + Math.random() * 0.15, at.z + Math.sin(a) * 0.3)
          d.v.set(Math.cos(a) * sp, 0.3 + Math.random() * 1.1, Math.sin(a) * sp)
          d.size = 0.3 + Math.random() * 0.45
          d.life = DUST_LIFE * (0.7 + Math.random() * 0.3)
        })
        grit.forEach((d) => {
          const a = Math.random() * Math.PI * 2
          const sp = 1.5 + Math.random() * 2.5
          d.p.set(at.x, 0.1, at.z)
          d.v.set(Math.cos(a) * sp, 2.5 + Math.random() * 2.5, Math.sin(a) * sp)
          d.size = 0.06 + Math.random() * 0.06
          d.life = 0.5 + Math.random() * 0.35
        })
      },
    }
    return () => {
      handle.current = null
    }
  }, [handle, puffs, grit])

  useFrame((_, delta) => {
    const dt = intro.hold ? 0 : Math.min(delta, 0.05)
    if (warm.current > 0) {
      warm.current--
      return
    }
    if (age.current > DUST_LIFE + 0.1) {
      if (ring.current.visible) {
        ring.current.visible = false
        puffRefs.current.forEach((s) => (s.visible = false))
        gritRefs.current.forEach((s) => (s.visible = false))
      }
      return
    }
    age.current += dt
    const t = age.current

    // Shock ring: fast out, fading.
    const rk = Math.min(1, t / 0.45)
    ring.current.visible = rk < 1
    ring.current.position.set(origin.current.x, 0.04, origin.current.z)
    ring.current.scale.setScalar(0.6 + easeOut(rk) * 3.4)
    ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - rk) * (1 - rk)

    puffs.forEach((d, i) => {
      const s = puffRefs.current[i]
      if (!s) return
      const k = t / d.life
      s.visible = k < 1
      if (k >= 1) return
      const drag = Math.exp(-4.5 * dt)
      d.v.x *= drag
      d.v.z *= drag
      d.v.y *= Math.exp(-2 * dt)
      d.p.addScaledVector(d.v, dt)
      s.position.copy(d.p)
      s.scale.setScalar(d.size * (0.6 + easeOut(k) * 1.6))
      ;(s.material as THREE.SpriteMaterial).opacity = 0.6 * (1 - k) * (1 - k)
    })
    grit.forEach((d, i) => {
      const s = gritRefs.current[i]
      if (!s) return
      const k = t / d.life
      s.visible = k < 1 && d.p.y > 0
      if (!s.visible) return
      d.v.y -= 18 * dt
      d.p.addScaledVector(d.v, dt)
      s.position.copy(d.p)
      s.scale.setScalar(d.size)
      ;(s.material as THREE.SpriteMaterial).opacity = 1
    })
  })

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={ringTex} color={'#f3e4c4'} transparent opacity={0} depthWrite={false} />
      </mesh>
      {puffs.map((_, i) => (
        <sprite
          key={`p${i}`}
          ref={(el) => {
            if (el) puffRefs.current[i] = el
          }}
        >
          <spriteMaterial map={tex} color={'#eadbbd'} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
      {grit.map((_, i) => (
        <sprite
          key={`g${i}`}
          ref={(el) => {
            if (el) gritRefs.current[i] = el
          }}
        >
          <spriteMaterial map={tex} color={'#a88e66'} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </>
  )
}
