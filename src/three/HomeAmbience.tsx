import { useEffect } from 'react'
import { HOME } from '../config/home'
import { useGame } from '../state/store'

/** A quiet AC motor and filtered airflow, synthesized on the first home visit.
 * No file downloads. The approved audition averages -44 dBFS; the normalized
 * air and motor here use the same proportions and approximately the same level.
 */
function fanAir(ctx: AudioContext): AudioBuffer {
  const n = ctx.sampleRate * 4
  const raw = new Float32Array(n)
  for (let i = 0; i < n; i++) raw[i] = Math.random() * 2 - 1
  // Filter a repeating noise cycle in place, warming the filter for two cycles
  // first so its state is continuous when the buffer loops.
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  const low = 1 - Math.exp(-2 * Math.PI * 620 / ctx.sampleRate)
  const high = 1 - Math.exp(-2 * Math.PI * 70 / ctx.sampleRate)
  let lp1 = 0, lp2 = 0, dc = 0, energy = 0
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let i = 0; i < n; i++) {
      lp1 += low * (raw[i]! - lp1)
      lp2 += low * (lp1 - lp2)
      dc += high * (lp2 - dc)
      if (cycle === 2) {
        const v = lp2 - dc
        data[i] = v
        energy += v * v
      }
    }
  }
  const rms = Math.sqrt(energy / n)
  for (let i = 0; i < n; i++) data[i] = data[i]! / rms
  return buffer
}

export function HomeAmbience() {
  useEffect(() => {
    let ctx: AudioContext | null = null
    let gain: GainNode | null = null
    let suspendTimer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    const sources: AudioScheduledSourceNode[] = []

    const inside = () => {
      const s = useGame.getState()
      return s.started && s.interior === 'home' && !s.minigame && !s.ride && !s.forest
        && !document.hidden
    }

    const create = () => {
      const AC = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      ctx = new AC()
      gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(ctx.destination)
      const air = ctx.createBufferSource()
      air.buffer = fanAir(ctx)
      air.loop = true
      const airGain = ctx.createGain()
      airGain.gain.value = 0.68
      air.connect(airGain).connect(gain)
      air.start()
      sources.push(air)
      for (const [frequency, level] of [[100, 0.72], [200, 0.144], [300, 0.0576]]) {
        const motor = ctx.createOscillator()
        motor.frequency.value = frequency!
        const motorGain = ctx.createGain()
        motorGain.gain.value = level!
        motor.connect(motorGain).connect(gain)
        motor.start()
        sources.push(motor)
      }
    }

    const sync = () => {
      if (disposed) return
      clearTimeout(suspendTimer)
      const active = inside()
      if (active && !ctx) create()
      if (!ctx || !gain) return
      const current = ctx
      if (active && current.state === 'suspended') {
        // Entering follows the door fade, so Safari may need the next gesture.
        void current.resume().catch(() => {})
      }
      gain.gain.setTargetAtTime(active ? HOME.ambience.gain : 0, current.currentTime, HOME.ambience.fade)
      if (!active) {
        suspendTimer = setTimeout(() => {
          if (!disposed && !inside()) void current.suspend().catch(() => {})
        }, HOME.ambience.fade * 6000)
      }
    }

    // State changes handle the doorway; gestures retry audio unlock without
    // starting any home sound before the first visit. Hidden tabs fade out too.
    const unsub = useGame.subscribe((s, prev) => {
      if (s.started !== prev.started || s.interior !== prev.interior ||
          s.minigame !== prev.minigame || s.ride !== prev.ride || s.forest !== prev.forest) sync()
    })
    const onGesture = () => { if (inside()) sync() }
    window.addEventListener('pointerdown', onGesture, { capture: true })
    window.addEventListener('keydown', onGesture, { capture: true })
    document.addEventListener('visibilitychange', sync)
    sync()

    return () => {
      disposed = true
      unsub()
      clearTimeout(suspendTimer)
      window.removeEventListener('pointerdown', onGesture, { capture: true })
      window.removeEventListener('keydown', onGesture, { capture: true })
      document.removeEventListener('visibilitychange', sync)
      for (const source of sources) source.stop()
      gain?.disconnect()
      void ctx?.close()
    }
  }, [])
  return null
}
