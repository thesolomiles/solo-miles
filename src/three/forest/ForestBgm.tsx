import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FOREST } from '../../config/forest'
import { useGame } from '../../state/store'
import { forestView } from '../../systems/forestView'
import forestBgmUrl from '../../../assets/audio/southern-forest-bgm.m4a'

/**
 * The forest walk's music (Leonard's track). It waits, silent, until he takes
 * his first step in (Leonard: the music starts when he starts walking), then
 * plays from the top and loops; leaving fades it out and stops it, and the
 * next visit waits for his first step again. If the browser can't decode it,
 * it's silently skipped.
 */
const FADE_K = 0.9 // slow: the music should drift in under the trees
/** How far he has to move before it counts as walking (u), counting only
 *  steps of under STEP a frame: being placed at the trailhead is one bigger
 *  jump, never a walk. */
const STEP = 0.3

export function ForestBgm() {
  const audio = useRef<HTMLAudioElement | null>(null)
  const gate = useRef({ lastX: NaN, moved: 0, walked: false })

  useEffect(
    () => () => {
      const a = audio.current
      if (a) {
        a.pause()
        a.src = ''
      }
      audio.current = null
    },
    [],
  )

  const start = () => {
    let a = audio.current
    if (!a) {
      const el = new Audio(forestBgmUrl)
      el.loop = true
      el.preload = 'auto'
      el.addEventListener('error', () => {
        audio.current = null // can't play this format here
      })
      if (import.meta.env?.DEV) (window as unknown as { __forestBgm?: HTMLAudioElement }).__forestBgm = el
      a = audio.current = el
    }
    a.volume = 0
    a.currentTime = 0
    a.play().catch(() => {
      const onTap = () => a?.play().catch(() => {})
      window.addEventListener('pointerdown', onTap, { once: true })
    })
  }

  useFrame((_, delta) => {
    const inForest = useGame.getState().forest
    const g = gate.current
    if (!inForest) {
      g.lastX = NaN
      g.moved = 0
      g.walked = false
    } else if (!g.walked) {
      // His first steps.
      const x = forestView.walkerX
      const dx = Number.isNaN(g.lastX) ? 0 : Math.abs(x - g.lastX)
      g.lastX = x
      if (dx < STEP) g.moved += dx
      if (g.moved > STEP) {
        g.walked = true
        start()
      }
    }

    const a = audio.current
    if (!a || a.paused) return
    const target = inForest && g.walked ? FOREST.bgmVolume : 0
    const k = Math.min(1, delta * FADE_K)
    a.volume = THREE.MathUtils.clamp(a.volume + (target - a.volume) * k, 0, 1)
    if (!inForest && a.volume < 0.002) a.pause()
  })

  return null
}
