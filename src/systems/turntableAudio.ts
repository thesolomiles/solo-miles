/**
 * The home record player's audio graph. Built on the first play (a click or
 * key in the record crate, so it's inside a user gesture), never on boot.
 *
 *   <audio> ─┬─ gain (distance) ─ pan ─ destination
 *            └─ analyser (speaker pulse, distance-independent)
 *
 * Volume goes through a GainNode, not element.volume: iOS ignores the latter.
 * Three/Turntable.tsx sets the mix every frame from the player's position.
 */

let ctx: AudioContext | null = null
let el: HTMLAudioElement | null = null
let gain: GainNode | null = null
let pan: StereoPannerNode | null = null
let analyser: AnalyserNode | null = null
let bins: Uint8Array<ArrayBuffer> | null = null
let crackle: AudioBuffer | null = null
let pauseTimer: ReturnType<typeof setTimeout> | undefined
let onEnded: (() => void) | null = null
let trackGain = 1

function ensure(): boolean {
  if (ctx) return true
  const AC = window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return false
  ctx = new AC()
  el = new Audio()
  el.preload = 'none'
  el.addEventListener('ended', () => onEnded?.())
  const src = ctx.createMediaElementSource(el)
  gain = ctx.createGain()
  gain.gain.value = 0
  analyser = ctx.createAnalyser()
  analyser.fftSize = 64
  analyser.smoothingTimeConstant = 0.7
  bins = new Uint8Array(analyser.frequencyBinCount)
  pan = ctx.createStereoPanner?.() ?? null
  src.connect(analyser)
  if (pan) src.connect(gain).connect(pan).connect(ctx.destination)
  else src.connect(gain).connect(ctx.destination)
  if (import.meta.env?.DEV) (window as unknown as { __turntable?: unknown }).__turntable = { ctx, el, gain }
  return true
}

/** A short needle-drop: a soft thump and a few crackles, synthesized once. */
function needleDrop() {
  if (!ctx || !gain) return
  if (!crackle) {
    const n = Math.floor(ctx.sampleRate * 0.7)
    crackle = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = crackle.getChannelData(0)
    for (let i = 0; i < n; i++) {
      const t = i / ctx.sampleRate
      const thump = t < 0.06 ? Math.sin(2 * Math.PI * 70 * t) * (1 - t / 0.06) * 0.5 : 0
      const pop = Math.random() < 0.0016 ? (Math.random() * 2 - 1) * 0.7 : 0
      const hiss = (Math.random() * 2 - 1) * 0.025
      d[i] = (thump + pop + hiss) * Math.min(1, (0.7 - t) / 0.25)
    }
  }
  const s = ctx.createBufferSource()
  s.buffer = crackle
  s.connect(gain)
  s.start()
}

/** Drop the needle on `src` (`gain` evens out loudness between records).
 *  `ended` fires when the track finishes. */
export function playRecord(src: string, gain: number, ended: () => void) {
  if (!ensure() || !ctx || !el) return
  trackGain = gain
  clearTimeout(pauseTimer)
  void ctx.resume().catch(() => {})
  onEnded = ended
  needleDrop()
  if (el.src !== new URL(src, location.href).href) el.src = src
  el.currentTime = 0
  // Start just after the needle-drop thump.
  setTimeout(() => { el?.play().catch(() => {}) }, 250)
}

/** Lift the needle: a quick fade, then pause and release the stream. */
export function stopRecord() {
  if (!ctx || !el || !gain) return
  onEnded = null
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
  clearTimeout(pauseTimer)
  pauseTimer = setTimeout(() => {
    if (!el) return
    el.pause()
    el.removeAttribute('src')
    el.load()
    void ctx?.suspend().catch(() => {})
  }, 600)
}

/** Per-frame mix from the player's position (0…1 gain, −1…1 pan). */
export function setRecordMix(level: number, panValue: number) {
  if (!ctx || !gain) return
  gain.gain.setTargetAtTime(level * trackGain, ctx.currentTime, 0.12)
  pan?.pan.setTargetAtTime(panValue, ctx.currentTime, 0.2)
}

/** Low-end energy 0…1 for the speaker cones. */
export function recordLevel(): number {
  if (!analyser || !bins || !el || el.paused) return 0
  analyser.getByteFrequencyData(bins)
  return (bins[1]! + bins[2]! + bins[3]!) / (3 * 255)
}
