import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../state/store'
import cafeBgmUrl from '../../assets/audio/cafe-bgm.mp3'

/**
 * Café background music. Loops the whole time the player is inside the café
 * interior and fades to silence out in the town — a smooth crossfade on
 * enter/exit, the indoor counterpart to the town's AmbientSound (which is
 * silenced inside).
 *
 * The element starts playing (muted) off the "Enter the town" gesture so the
 * browser's autoplay policy is already satisfied by the time you step into the
 * café; volume is then driven purely by `interior`. Renders nothing.
 */
const MAX_VOL = 0.4
const FADE_K = 1.6 // per-second volume lerp — a gentle fade in/out at the door

export function CafeBgm() {
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const a = new Audio(cafeBgmUrl)
    a.loop = true
    a.preload = 'auto'
    a.volume = 0
    audio.current = a
    if (import.meta.env?.DEV) (window as unknown as { __cafeBgm?: HTMLAudioElement }).__cafeBgm = a

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
    const st = useGame.getState()
    const target = st.started && st.interior === 'cafe' ? MAX_VOL : 0
    const k = Math.min(1, delta * FADE_K)
    a.volume = THREE.MathUtils.clamp(a.volume + (target - a.volume) * k, 0, 1)
  })

  return null
}
