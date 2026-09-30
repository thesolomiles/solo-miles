import type { NinjaSfx } from '../../arcade/ninjarun'

/**
 * Procedural SFX for Ninja Run — no audio files, same Web Audio approach as
 * ui/siteSfx.ts. Everything is short and soft (it's a quiet forest at night):
 * filtered noise for feet, cloth and air; a few inharmonic sine partials for
 * steel on stone / steel on steel; low sine thumps for weight.
 *
 * Under them, a night-forest bed (startNinjaAmbience): a low drone, slow wind,
 * and now and then a lone breathy flute note that echoes off into the trees.
 *
 * The game opens from a click / key, so the context is created with the page
 * already activated; a suspended context (Safari) resumes on the next gesture.
 */

/** Sim events, plus the two the world adds itself: footfalls and landings. */
export type NinjaSound = NinjaSfx | 'step' | 'land'

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
  out.gain.value = 0.7
  // a little glue so stacked hits never clip
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  out.connect(comp).connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const resume = () => void ctx?.resume().catch(() => {})
  window.addEventListener('pointerdown', resume, { capture: true })
  window.addEventListener('keydown', resume, { capture: true })
  return ctx
}

/** ±`amt` random detune, so repeats never sound stamped out. */
const vary = (f: number, amt = 0.06) => f * (1 + (Math.random() * 2 - 1) * amt)

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

/**
 * Filtered noise, its filter sweeping f0 → f1: a band-pass for air and cloth, a
 * low-pass for a dull thud, a high-pass for a bright tick. `attack` is the
 * share of `dur` spent swelling (near 0 = a hit, higher = a whoosh).
 */
function air(
  c: AudioContext,
  t: number,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  attack = 0.3,
  q = 1.5,
) {
  const s = c.createBufferSource()
  s.buffer = noise
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.003, dur * attack))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(out!)
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur + 0.02)
}

/** Struck steel: a handful of inharmonic partials ringing out from a bright tick. */
function steel(c: AudioContext, t: number, partials: number[], ring: number, vol: number) {
  const k = vary(1, 0.05)
  partials.forEach((f, i) => tone(c, t, f * k, f * k * 0.995, ring * (1 - i * 0.12), 'sine', vol / (1 + i * 0.35)))
  air(c, t, 'highpass', 5000, 5000, 0.03, vol * 1.2, 0.05)
}

let leftFoot = false

function play(c: AudioContext, name: NinjaSound) {
  const t = c.currentTime + 0.005
  switch (name) {
    case 'step': {
      // A soft sole on stone: a dull pat, the two feet a shade apart in pitch.
      leftFoot = !leftFoot
      const f = vary(leftFoot ? 900 : 1150, 0.12)
      air(c, t, 'lowpass', f, f * 0.6, 0.06, 0.17, 0.08)
      tone(c, t, vary(115), 70, 0.05, 'sine', 0.11)
      break
    }
    case 'jump':
      // Push-off + a rush of cloth.
      tone(c, t, 150, 90, 0.06, 'sine', 0.1)
      air(c, t, 'bandpass', 500, 1900, 0.17, 0.13, 0.25)
      break
    case 'doubleJump':
      // He steps on the air: a breathy puff, higher and lighter than the jump.
      air(c, t, 'bandpass', 1100, 3200, 0.2, 0.12, 0.15, 1)
      air(c, t, 'lowpass', 700, 300, 0.09, 0.07, 0.05)
      break
    case 'land':
      tone(c, t, 120, 55, 0.1, 'sine', 0.17)
      air(c, t, 'lowpass', 1300, 500, 0.08, 0.12, 0.05)
      break
    case 'throw':
      // A quick flick of the wrist, then the star's thin whistle.
      air(c, t, 'bandpass', 2600, 7000, 0.085, 0.16, 0.2, 3)
      tone(c, t + 0.01, vary(3400), 2300, 0.12, 'sine', 0.018)
      break
    case 'empty':
      // Nothing in hand: a dry little pat.
      air(c, t, 'bandpass', 700, 500, 0.04, 0.07, 0.05, 4)
      break
    case 'clink':
      // Star on rock / wood: a short, dead ting.
      steel(c, t, [3100, 4730, 6210], 0.13, 0.055)
      air(c, t, 'lowpass', 1200, 600, 0.05, 0.08, 0.05)
      break
    case 'parry':
      // Star on star: a bright clash that rings.
      steel(c, t, [2250, 3380, 5120, 7300], 0.42, 0.085)
      steel(c, t + 0.012, [2900, 4400], 0.3, 0.05)
      break
    case 'hit':
      // A star finds a ninja: a thock, and him going down.
      air(c, t, 'bandpass', 1800, 900, 0.05, 0.16, 0.05, 2)
      tone(c, t, 170, 60, 0.13, 'sine', 0.22)
      air(c, t + 0.09, 'lowpass', 900, 300, 0.16, 0.07, 0.2)
      break
    case 'windup':
      // A rival draws: a thin rising edge, just enough to warn.
      tone(c, t, 900, 1700, 0.3, 'triangle', 0.028)
      air(c, t, 'bandpass', 3000, 6000, 0.3, 0.035, 0.8, 5)
      break
    case 'foeThrow':
      air(c, t, 'bandpass', 1700, 4200, 0.11, 0.12, 0.2, 3)
      break
    case 'die':
      // Struck: a heavy hit, the air going out of him.
      tone(c, t, 210, 38, 0.5, 'sine', 0.3)
      air(c, t, 'lowpass', 2200, 300, 0.22, 0.2, 0.03)
      air(c, t + 0.12, 'bandpass', 900, 250, 0.5, 0.06, 0.2)
      break
  }
}

export function playNinjaSfx(names: NinjaSound[]) {
  if (!names.length) return
  const c = audio()
  if (!c || !out) return
  if (c.state === 'suspended') void c.resume().catch(() => {})
  for (const n of names) play(c, n)
}

// --- Ambience ------------------------------------------------------------------------

/** Bed level, and the seconds it takes to fade in / out (and duck on pause). */
const BED_VOL = 0.5
const BED_FADE = 2.5
/** The flute's notes: D in-sen (D E♭ G A C), a Japanese scale with a dark half-step. */
const FLUTE = [293.66, 311.13, 392.0, 440.0, 523.25, 587.33]
/** Seconds between phrases. */
const PHRASE_GAP = [5, 11] as const

let bed: { gain: GainNode; stop: () => void } | null = null

/** A slow sine LFO wobbling `param` by ±`depth`. */
function lfo(c: AudioContext, param: AudioParam, hz: number, depth: number, stops: AudioScheduledSourceNode[]) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.frequency.value = hz
  g.gain.value = depth
  o.connect(g).connect(param)
  o.start()
  stops.push(o)
}

/** One flute note into `dest`: a soft sine with a little breath round it. */
function flute(c: AudioContext, dest: AudioNode, t: number, f: number, dur: number, vol: number) {
  const o = c.createOscillator()
  o.type = 'sine'
  // Scoops up into the note, and wavers a touch as it's held.
  o.frequency.setValueAtTime(f * 0.97, t)
  o.frequency.exponentialRampToValueAtTime(f, t + 0.18)
  const vib = c.createOscillator()
  const vibG = c.createGain()
  vib.frequency.value = 4.6
  vibG.gain.setValueAtTime(0, t)
  vibG.gain.linearRampToValueAtTime(f * 0.006, t + dur * 0.7)
  vib.connect(vibG).connect(o.frequency)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.22)
  g.gain.setValueAtTime(vol, t + dur * 0.55)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(dest)
  const breath = c.createBufferSource()
  breath.buffer = noise
  breath.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = f * 2
  bp.Q.value = 3
  const bg = c.createGain()
  bg.gain.setValueAtTime(0.0001, t)
  bg.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.1)
  bg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8)
  breath.connect(bp).connect(bg).connect(dest)
  for (const n of [o, vib, breath]) {
    n.start(t)
    n.stop(t + dur + 0.05)
  }
}

/** Start the night-forest bed (fades in). Returns a stop that fades it out. */
export function startNinjaAmbience(): () => void {
  const c = audio()
  if (!c || !out) return () => {}
  if (c.state === 'suspended') void c.resume().catch(() => {})
  bed?.stop()

  const stops: AudioScheduledSourceNode[] = []
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(BED_VOL, c.currentTime + BED_FADE)
  gain.connect(out)

  // Drone: a low D with its fifth, a slightly detuned pair above for a slow beat.
  const droneLp = c.createBiquadFilter()
  droneLp.type = 'lowpass'
  droneLp.frequency.value = 420
  const droneG = c.createGain()
  droneG.gain.value = 0.16
  droneLp.connect(droneG).connect(gain)
  for (const [f, type, v] of [
    [73.42, 'sine', 1],
    [110, 'sine', 0.45],
    [146.5, 'triangle', 0.3],
    [147.3, 'triangle', 0.3],
  ] as const) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.value = v
    o.connect(g).connect(droneLp)
    o.start()
    stops.push(o)
  }
  lfo(c, droneG.gain, 0.05, 0.05, stops)
  lfo(c, droneLp.frequency, 0.031, 140, stops)

  // Wind through the bamboo: band-passed noise, swelling and shifting slowly.
  const wind = c.createBufferSource()
  wind.buffer = noise
  wind.loop = true
  const windBp = c.createBiquadFilter()
  windBp.type = 'bandpass'
  windBp.frequency.value = 520
  windBp.Q.value = 0.8
  const windG = c.createGain()
  windG.gain.value = 0.07
  wind.connect(windBp).connect(windG).connect(gain)
  wind.start()
  stops.push(wind)
  lfo(c, windBp.frequency, 0.043, 260, stops)
  lfo(c, windG.gain, 0.071, 0.04, stops)

  // The flute goes through a long dark echo, so each note trails off into the grove.
  const send = c.createGain()
  const delay = c.createDelay(1)
  delay.delayTime.value = 0.52
  const fb = c.createGain()
  fb.gain.value = 0.48
  const echoLp = c.createBiquadFilter()
  echoLp.type = 'lowpass'
  echoLp.frequency.value = 1500
  send.connect(gain)
  send.connect(delay)
  delay.connect(echoLp).connect(fb).connect(delay)
  echoLp.connect(gain)

  let note = Math.floor(Math.random() * FLUTE.length)
  let timer = 0
  const phrase = () => {
    timer = window.setTimeout(phrase, (PHRASE_GAP[0] + Math.random() * (PHRASE_GAP[1] - PHRASE_GAP[0])) * 1000)
    if (c.state !== 'running' || bedPaused) return
    // One to three notes, stepping to a neighbour in the scale each time.
    let t = c.currentTime + 0.05
    const n = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      note = Math.max(0, Math.min(FLUTE.length - 1, note + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2))))
      const dur = i === n - 1 ? 2.2 + Math.random() * 1.4 : 0.7 + Math.random() * 0.6
      flute(c, send, t, FLUTE[note], dur, 0.05)
      t += dur * 0.8
    }
  }
  timer = window.setTimeout(phrase, 3000)

  const me = {
    gain,
    stop: () => {
      if (bed === me) bed = null
      window.clearTimeout(timer)
      const t = c.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
      for (const n of stops) n.stop(t + 0.9)
      window.setTimeout(() => gain.disconnect(), 1200)
    },
  }
  bed = me
  bedPaused = false
  return me.stop
}

let bedPaused = false

/** Duck the bed while the game is paused (and hold the flute). */
export function setNinjaAmbiencePaused(paused: boolean) {
  if (!ctx || !bed || paused === bedPaused) return
  bedPaused = paused
  const t = ctx.currentTime
  bed.gain.gain.cancelScheduledValues(t)
  bed.gain.gain.setValueAtTime(Math.max(bed.gain.gain.value, 0.0001), t)
  bed.gain.gain.exponentialRampToValueAtTime(paused ? BED_VOL * 0.35 : BED_VOL, t + 0.6)
}
