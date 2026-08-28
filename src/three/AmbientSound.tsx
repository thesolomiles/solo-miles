import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import birdUrl from '../../assets/audio/bird.m4a'
import riverUrl from '../../assets/audio/river.m4a'

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
 * Clips are not constructed until "Enter the town" (a user gesture, so autoplay
 * policy is satisfied; retries on the next tap if blocked). Lives inside the
 * Canvas so it reads the player's live position ref each frame; renders nothing.
 *
 * Loops go through Web Audio, not HTMLAudioElement.loop. The beds are AAC, which
 * carries encoder delay + trailing packet padding — `<audio loop>` restarts on
 * the padded file and the river sounds like it gets cut off. Buffer-source
 * looping is sample-accurate; we also crossfade the seam so the waveform meets.
 */
const RIVER_Z_NORTH = -14.2
const RIVER_Z_SOUTH = -4.6
const RIVER_FALLOFF = 14 // units past the bank where the river fades to silence

const BIRD_VOL = 0.18
const RIVER_MAX = 0.6
const FADE_K = 2.5 // per-second volume lerp — smooths proximity + a gentle start

const XFADE_SEC = 0.08
const TRIM_MAX_SEC = 0.04
const SILENCE = 0.004

/** 0…1 nearness to the river band: 1 on/over the water, 0 beyond the falloff. */
function riverNearness(z: number): number {
  const dist = Math.max(0, RIVER_Z_NORTH - z, z - RIVER_Z_SOUTH)
  return THREE.MathUtils.clamp(1 - dist / RIVER_FALLOFF, 0, 1)
}

type Voice = { gain: GainNode; stop: () => void }

function seamlessLoop(buf: AudioBuffer, ctx: AudioContext): AudioBuffer {
  const n = buf.length
  const rate = buf.sampleRate
  const trimCap = Math.min(Math.floor(TRIM_MAX_SEC * rate), Math.floor(n / 8))
  const ch0 = buf.getChannelData(0)
  let start = 0
  let end = n - 1
  while (start < trimCap && Math.abs(ch0[start]!) < SILENCE) start++
  while (end > n - 1 - trimCap && Math.abs(ch0[end]!) < SILENCE) end--

  const span = end - start + 1
  const xfade = Math.min(Math.floor(XFADE_SEC * rate), Math.floor(span / 6))
  const outLen = span - xfade
  const out = ctx.createBuffer(buf.numberOfChannels, outLen, rate)

  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c)
    const dst = out.getChannelData(c)
    for (let i = 0; i < outLen; i++) dst[i] = src[start + i]!
    for (let i = 0; i < xfade; i++) {
      const t = i / xfade
      const a = Math.cos(t * Math.PI * 0.5)
      const b = Math.sin(t * Math.PI * 0.5)
      dst[outLen - xfade + i] = src[start + outLen - xfade + i]! * a + src[start + i]! * b
    }
  }
  return out
}

async function startLoop(url: string, ctx: AudioContext): Promise<Voice> {
  const res = await fetch(url)
  const raw = await res.arrayBuffer()
  const decoded = await ctx.decodeAudioData(raw.slice(0))
  const loop = seamlessLoop(decoded, ctx)
  const gain = ctx.createGain()
  gain.gain.value = 0
  gain.connect(ctx.destination)
  const src = ctx.createBufferSource()
  src.buffer = loop
  src.loop = true
  src.connect(gain)
  src.start()
  return {
    gain,
    stop: () => {
      try {
        src.stop()
      } catch {
        /* already stopped */
      }
      src.disconnect()
      gain.disconnect()
    },
  }
}

export function AmbientSound({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const bird = useRef<Voice | null>(null)
  const river = useRef<Voice | null>(null)

  useEffect(() => {
    let cancelled = false
    let birdVoice: Voice | null = null
    let riverVoice: Voice | null = null
    let ctx: AudioContext | null = null
    let armed = false

    const arm = () => {
      if (armed) return
      armed = true

      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
      const c = ctx
      const unlock = () => c.resume().catch(() => {})
      unlock()

      Promise.all([startLoop(birdUrl, c), startLoop(riverUrl, c)])
        .then(([b, r]) => {
          if (cancelled) {
            b.stop()
            r.stop()
            return
          }
          birdVoice = b
          riverVoice = r
          bird.current = b
          river.current = r
          if (import.meta.env?.DEV) {
            // Expose the AudioParams (not the GainNodes) so console reads match
            // the old HTMLAudio `.volume` habit: `__ambient.river.value`.
            ;(window as unknown as { __ambient?: unknown }).__ambient = {
              bird: b.gain.gain,
              river: r.gain.gain,
              ctx: c,
            }
          }
        })
        .catch(() => {
          window.addEventListener('pointerdown', unlock, { once: true })
        })

      window.addEventListener('pointerdown', unlock, { once: true })
    }

    const unsub = useGame.subscribe((s, prev) => {
      if (s.started && !prev.started) arm()
    })
    if (useGame.getState().started) arm() // already running (HMR remount)

    return () => {
      cancelled = true
      unsub()
      birdVoice?.stop()
      riverVoice?.stop()
      void ctx?.close()
      bird.current = null
      river.current = null
    }
  }, [])

  useFrame((_, delta) => {
    const b = bird.current
    const r = river.current
    if (!b || !r) return
    const st = useGame.getState()
    // Outdoor ambience is the TOWN's — silence the birds + river inside an
    // interior (the café), which has its own BGM instead.
    const outdoors = st.started && !st.interior
    const k = Math.min(1, delta * FADE_K)
    const birdTarget = outdoors ? BIRD_VOL : 0
    const riverTarget = outdoors ? riverNearness(playerPos.current.z) * RIVER_MAX : 0
    const bg = b.gain.gain
    const rg = r.gain.gain
    bg.value = THREE.MathUtils.clamp(bg.value + (birdTarget - bg.value) * k, 0, 1)
    rg.value = THREE.MathUtils.clamp(rg.value + (riverTarget - rg.value) * k, 0, 1)
  })

  return null
}
