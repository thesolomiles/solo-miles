/**
 * Procedural sci-fi UI sounds for the personal-site hologram — no audio files.
 *
 * - hover: a soft two-tick HUD blip plus a faint burst of "decrypt" chatter
 *   that runs as long as the link's text scramble (~14 × 28 ms).
 * - click: a rising confirm chirp over a filtered-noise sweep and a low thump,
 *   with louder chatter under it.
 * - open / shut: a short rising / falling pair, for expanding a career row
 *   and picking a philosophy callout (open) or collapsing a row (shut).
 *
 * The site only opens from a click / key, so the context is created with the
 * page already activated; a suspended context (Safari) resumes on the next
 * gesture. Hovers are throttled so a fast sweep stays a tick, not a smear.
 */

export type SiteSfxName = 'hover' | 'click' | 'open' | 'shut'

let ctx: AudioContext | null = null
let out: GainNode | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  if (ctx) return ctx
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  out = ctx.createGain()
  out.gain.value = 0.6
  // a little glue so stacked hits never clip
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  out.connect(comp).connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const resume = () => void ctx?.resume().catch(() => {})
  window.addEventListener('pointerdown', resume, { capture: true })
  window.addEventListener('keydown', resume, { capture: true })
  return ctx
}

/** One oscillator note: f0 → f1 over `dur`, fast attack, exponential tail. */
function tone(c: AudioContext, t: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out!)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** Band-passed noise whose centre sweeps f0 → f1 — the "air" in a swoosh. */
function sweep(c: AudioContext, t: number, f0: number, f1: number, dur: number, vol: number) {
  const s = c.createBufferSource()
  s.buffer = noise
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 6
  bp.frequency.setValueAtTime(f0, t)
  bp.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(bp).connect(g).connect(out!)
  s.start(t)
  s.stop(t + dur + 0.02)
}

/** Rapid random-pitch square blips — the sound of the text scramble. */
function chatter(c: AudioContext, t: number, n: number, vol: number) {
  for (let i = 0; i < n; i++) {
    const f = 1400 + Math.random() * 2600
    tone(c, t + i * 0.028, f, f, 0.018, 'square', vol * (1 - (i / n) * 0.6))
  }
}

let lastHover = 0

export function playSiteSfx(name: SiteSfxName) {
  const c = audio()
  if (!c || !out) return
  if (c.state === 'suspended') void c.resume().catch(() => {})
  const t = c.currentTime + 0.005
  switch (name) {
    case 'hover': {
      if (t - lastHover < 0.07) return
      lastHover = t
      tone(c, t, 2400, 3400, 0.045, 'sine', 0.16)
      tone(c, t + 0.05, 3400, 3400, 0.03, 'sine', 0.08)
      chatter(c, t + 0.02, 8, 0.018)
      break
    }
    case 'click': {
      tone(c, t, 90, 45, 0.18, 'sine', 0.35) // thump
      tone(c, t, 660, 1320, 0.09, 'triangle', 0.2)
      tone(c, t + 0.07, 1320, 2640, 0.14, 'triangle', 0.16)
      sweep(c, t, 600, 5000, 0.3, 0.14)
      chatter(c, t + 0.03, 14, 0.03)
      break
    }
    case 'open':
      tone(c, t, 880, 1760, 0.06, 'triangle', 0.16)
      tone(c, t + 0.06, 1760, 2200, 0.08, 'sine', 0.12)
      sweep(c, t, 1200, 4000, 0.16, 0.06)
      break
    case 'shut':
      tone(c, t, 1760, 880, 0.06, 'triangle', 0.14)
      tone(c, t + 0.06, 880, 660, 0.08, 'sine', 0.1)
      sweep(c, t, 4000, 1200, 0.16, 0.05)
      break
  }
}
