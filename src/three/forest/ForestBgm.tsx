import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FOREST } from '../../config/forest'
import { useGame } from '../../state/store'
import forestBgmUrl from '../../../assets/audio/southern-forest-bgm.m4a'

/**
 * The forest walk's music (Leonard's track). Fetched on the first walk, loops
 * while you're in the forest, fades out on leaving — the same pattern as
 * CafeBgm. If the browser can't decode it, it's silently skipped.
 */
const FADE_K = 0.9 // slow: the music should drift in under the trees

export function ForestBgm() {
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let a: HTMLAudioElement | null = null
    const arm = () => {
      if (a) return
      a = new Audio(forestBgmUrl)
      a.loop = true
      a.preload = 'auto'
      a.volume = 0
      audio.current = a
      a.addEventListener('error', () => {
        audio.current = null // can't play this format here
      })
      if (import.meta.env?.DEV) (window as unknown as { __forestBgm?: HTMLAudioElement }).__forestBgm = a
      a.play().catch(() => {
        const onTap = () => a?.play().catch(() => {})
        window.addEventListener('pointerdown', onTap, { once: true })
      })
    }
    const unsub = useGame.subscribe((s, prev) => {
      if (s.forest && !prev.forest) arm()
    })
    if (useGame.getState().forest) arm()
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
    const target = useGame.getState().forest ? FOREST.bgmVolume : 0
    const k = Math.min(1, delta * FADE_K)
    a.volume = THREE.MathUtils.clamp(a.volume + (target - a.volume) * k, 0, 1)
  })

  return null
}
