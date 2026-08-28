import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import cafeBgmUrl from '../../assets/audio/cafe-bgm.m4a'

/**
 * Café background music. Loops the whole time the player is inside the café
 * interior and fades to silence out in the town — a smooth crossfade on
 * enter/exit, the indoor counterpart to the town's AmbientSound (which is
 * silenced inside).
 *
 * The file is not fetched until the first café visit (town boot only pays for
 * birds + river). play() may be blocked if that enter isn't a user gesture;
 * the next tap unlocks it, same fallback as the arcade SFX. Renders nothing.
 */
const MAX_VOL = 0.22
const FADE_K = 1.6 // per-second volume lerp — a gentle fade in/out at the door

export function CafeBgm() {
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let a: HTMLAudioElement | null = null

    const arm = () => {
      if (a) return
      a = new Audio(cafeBgmUrl)
      a.loop = true
      a.preload = 'auto'
      a.volume = 0
      audio.current = a
      if (import.meta.env?.DEV) (window as unknown as { __cafeBgm?: HTMLAudioElement }).__cafeBgm = a
      a.play().catch(() => {
        const onTap = () => a?.play().catch(() => {})
        window.addEventListener('pointerdown', onTap, { once: true })
      })
    }

    const inCafe = (s: { started: boolean; interior: string | null }) =>
      s.started && s.interior === 'cafe'

    const unsub = useGame.subscribe((s, prev) => {
      if (inCafe(s) && !inCafe(prev)) arm()
    })
    if (inCafe(useGame.getState())) arm() // already inside (HMR remount)

    return () => {
      unsub()
      if (a) {
        a.pause()
        a.src = ''
      }
      audio.current = null
    }
  }, [])

  useFrame((_, delta) => {
    const a = audio.current
    if (!a) return
    const st = useGame.getState()
    const target = st.started && st.interior === 'cafe' && !st.minigame ? MAX_VOL : 0
    const k = Math.min(1, delta * FADE_K)
    a.volume = THREE.MathUtils.clamp(a.volume + (target - a.volume) * k, 0, 1)
  })

  return null
}
