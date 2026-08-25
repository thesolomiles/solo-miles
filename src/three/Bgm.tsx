import { useEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import bgmUrl from '../../assets/audio/hidden-valley.mp3'

/**
 * Map background music. Loops while you're in town, and smoothly fades out as you
 * cross the bridge into the forest/trail — the volume is a straight crossfade
 * across the river band, so the music fades exactly as you walk the deck and
 * fades back in when you return south.
 *
 * The river/bridge span (app coords) comes from WATER_COLLIDERS in config/town.ts:
 * z −14.2 (north bank) … −4.6 (south bank). Full volume at/south of the south
 * bank, silent at/north of the north bank.
 *
 * Playback starts on the "Enter the town" click (a user gesture, so autoplay
 * policy is satisfied); if a browser still blocks it, we retry on the next tap.
 * Lives inside the Canvas so it can read the player's live position ref each
 * frame; it renders nothing to the 3D scene.
 */
const Z_SOUTH = -4.6 // south bank — full volume (town side)
const Z_NORTH = -14.2 // north bank — silent (forest/trail side)
const MAX_VOL = 0.45 // BGM sits under the scene, not over it
const FADE_K = 2.5 // per-second volume lerp — extra smoothing + a gentle start

export function Bgm({ playerPos }: { playerPos: RefObject<THREE.Vector3> }) {
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const a = new Audio(bgmUrl)
    a.loop = true
    a.preload = 'auto'
    a.volume = 0
    audio.current = a
    if (import.meta.env?.DEV) (window as unknown as { __bgm?: HTMLAudioElement }).__bgm = a

    // Kick playback off the Enter-town gesture. subscribe() fires synchronously
    // inside start()'s setState, which runs in the button's click handler — so
    // play() is still user-initiated. Fall back to the next tap if it's blocked.
    const tryPlay = () => {
      a.play().catch(() => {
        const onTap = () => a.play().catch(() => {})
        window.addEventListener('pointerdown', onTap, { once: true })
      })
    }
    const unsub = useGame.subscribe((s, prev) => {
      if (s.started && !prev.started) tryPlay()
    })
    if (useGame.getState().started) tryPlay() // already running (HMR remount)

    return () => {
      unsub()
      a.pause()
      a.src = ''
      audio.current = null
    }
  }, [])

  useFrame((_, delta) => {
    const a = audio.current
    if (!a) return
    const started = useGame.getState().started
    const z = playerPos.current.z
    // Crossfade across the bridge: 1 south of the river → 0 north of it.
    const cross = THREE.MathUtils.clamp((z - Z_NORTH) / (Z_SOUTH - Z_NORTH), 0, 1)
    const target = started ? cross * MAX_VOL : 0
    const k = Math.min(1, delta * FADE_K)
    a.volume = THREE.MathUtils.clamp(a.volume + (target - a.volume) * k, 0, 1)
  })

  return null
}
