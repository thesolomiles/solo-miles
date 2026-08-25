import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import birdUrl from '../../assets/audio/bird.aac'
import riverUrl from '../../assets/audio/river.aac'

/**
 * Ambient environment sound (replaces the shelved BGM).
 *
 * - Birds: a steady loop everywhere on the map.
 * - River: a loop that gets LOUDER the nearer you are to the water, and fades to
 *   silence as you walk away. Proximity is distance in z from the river band
 *   (WATER_COLLIDERS in config/town.ts: z −14.2 north bank … −4.6 south bank),
 *   since the river is a full-width horizontal strip — on the banks/bridge it's
 *   at full volume, and it falls off over RIVER_FALLOFF units to either side.
 *
 * Both start on the "Enter the town" click (a user gesture, so autoplay policy is
 * satisfied; retries on the next tap if blocked). Lives inside the Canvas so it
 * reads the player's live position ref each frame; renders nothing.
 */
const RIVER_Z_NORTH = -14.2
const RIVER_Z_SOUTH = -4.6
const RIVER_FALLOFF = 14 // units past the bank where the river fades to silence

const BIRD_VOL = 0.18
const RIVER_MAX = 0.6
const FADE_K = 2.5 // per-second volume lerp — smooths proximity + a gentle start

/** 0…1 nearness to the river band: 1 on/over the water, 0 beyond the falloff. */
function riverNearness(z: number): number {
  const dist = Math.max(0, RIVER_Z_NORTH - z, z - RIVER_Z_SOUTH)
  return THREE.MathUtils.clamp(1 - dist / RIVER_FALLOFF, 0, 1)
}

export function AmbientSound({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const bird = useRef<HTMLAudioElement | null>(null)
  const river = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const b = new Audio(birdUrl)
    const r = new Audio(riverUrl)
    for (const a of [b, r]) {
      a.loop = true
      a.preload = 'auto'
      a.volume = 0
    }
    bird.current = b
    river.current = r
    if (import.meta.env?.DEV) (window as unknown as { __ambient?: unknown }).__ambient = { bird: b, river: r }

    const tryPlay = () => {
      const play = () => {
        b.play().catch(() => {})
        r.play().catch(() => {})
      }
      // If autoplay is blocked, retry on the next tap.
      Promise.allSettled([b.play(), r.play()]).then((res) => {
        if (res.some((x) => x.status === 'rejected')) {
          window.addEventListener('pointerdown', play, { once: true })
        }
      })
    }
    const unsub = useGame.subscribe((s, prev) => {
      if (s.started && !prev.started) tryPlay()
    })
    if (useGame.getState().started) tryPlay() // already running (HMR remount)

    return () => {
      unsub()
      for (const a of [b, r]) {
        a.pause()
        a.src = ''
      }
      bird.current = null
      river.current = null
    }
  }, [])

  useFrame((_, delta) => {
    const b = bird.current
    const r = river.current
    if (!b || !r) return
    const started = useGame.getState().started
    const k = Math.min(1, delta * FADE_K)
    const birdTarget = started ? BIRD_VOL : 0
    const riverTarget = started ? riverNearness(playerPos.current.z) * RIVER_MAX : 0
    b.volume = THREE.MathUtils.clamp(b.volume + (birdTarget - b.volume) * k, 0, 1)
    r.volume = THREE.MathUtils.clamp(r.volume + (riverTarget - r.volume) * k, 0, 1)
  })

  return null
}
