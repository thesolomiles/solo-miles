/**
 * Procedural sound for the forest walk — no audio files, the same Web Audio
 * approach as Ninja Run (three/arcade/ninjaSfx.ts). Two parts:
 *
 * - Footfalls on the forest floor: a soft dull thud with a faint crunch of
 *   needles, the two feet a shade apart; a push-off, an air-step puff and a
 *   landing for jumps.
 * - A quiet bed under Leonard's music (startForestAmbience): wind moving
 *   through the canopy high above, the odd rustle of leaves, and every so often
 *   a distant bird — a cuckoo's two notes or a bush warbler's long whistle and
 *   flourish, the sounds of a Japanese mountain forest — echoing off the trees.
 *
 * Everything is kept low: the music is the main voice, this is the room it's in.
 */

export type ForestSound = 'step' | 'runStep' | 'jump' | 'doubleJump' | 'land'

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
  out.gain.value = 0.8
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.ratio.value = 4
  out.connect(comp).connect(ctx.destination)
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const resume = () => void ctx?.resume().catch(() => {})
  window.addEventListener('pointerdown', resume, { capture: true })
  window.addEventListener('keydown', resume, { capture: true })
  return ctx
}

const vary = (f: number, amt = 0.08) => f * (1 + (Math.random() * 2 - 1) * amt)

function tone(
  c: AudioContext,
  to: AudioNode,
  t: number,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  attack = 0.004,
) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(to)
  o.start(t)
  o.stop(t + dur + 0.02)
}

function air(
  c: AudioContext,
  to: AudioNode,
  t: number,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  attack = 0.1,
  q = 1,
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
  s.connect(f).connect(g).connect(to)
  s.start(t, Math.random() * 1.5)
  s.stop(t + dur + 0.02)
}

// --- Feet --------------------------------------------------------------------------

let leftFoot = false

/** A footfall on soft ground: dull thud + a little crunch of needles and twigs. */
function footfall(c: AudioContext, t: number, vol: number) {
  leftFoot = !leftFoot
  const k = leftFoot ? 1 : 1.12
  air(c, out!, t, 'lowpass', vary(520 * k), 220, 0.09, 0.2 * vol, 0.12)
  tone(c, out!, t, vary(95 * k), 60, 0.07, 0.07 * vol)
  // Crunch: a few tiny bright grains just after the heel lands.
  const grains = 2 + Math.floor(Math.random() * 3)
  for (let i = 0; i < grains; i++) {
    const g = t + 0.008 + Math.random() * 0.05
    air(c, out!, g, 'bandpass', vary(2600, 0.3), vary(2000, 0.3), 0.018 + Math.random() * 0.015, 0.05 * vol, 0.1, 2.5)
  }
}

export function playForestSfx(names: ForestSound[]) {
  if (!names.length) return
  const c = audio()
  if (!c || !out || c.state !== 'running') return
  const t = c.currentTime + 0.005
  for (const n of names) {
    switch (n) {
      case 'step':
        footfall(c, t, 1)
        break
      case 'runStep':
        footfall(c, t, 1.35)
        break
      case 'jump':
        // Push off the ground: a scuff and a short rush of cloth.
        air(c, out, t, 'lowpass', 700, 300, 0.07, 0.16, 0.1)
        air(c, out, t + 0.02, 'bandpass', 600, 1600, 0.16, 0.06, 0.3)
        break
      case 'doubleJump':
        // He steps on the air: a breathy puff, lighter than the jump.
        air(c, out, t, 'bandpass', 1100, 3200, 0.2, 0.1, 0.15, 1)
        air(c, out, t, 'lowpass', 700, 300, 0.09, 0.06, 0.05)
        break
      case 'land':
        tone(c, out, t, 110, 55, 0.12, 0.14)
        air(c, out, t, 'lowpass', 900, 280, 0.12, 0.22, 0.06)
        for (let i = 0; i < 4; i++) {
          air(c, out, t + 0.01 + Math.random() * 0.06, 'bandpass', vary(2400, 0.3), 1800, 0.02, 0.05, 0.1, 2.5)
        }
        break
    }
  }
}

// --- Ambience ----------------------------------------------------------------------

const BED_VOL = 0.55
const BED_FADE = 3
const BIRD_GAP: [number, number] = [7, 16]
const RUSTLE_GAP: [number, number] = [5, 12]

let bed: { stop: () => void } | null = null

/** A slow sine wobble on a param: value ± depth at `rate` Hz. */
function lfo(c: AudioContext, param: AudioParam, rate: number, depth: number, stops: AudioScheduledSourceNode[]) {
  const o = c.createOscillator()
  o.frequency.value = rate
  const g = c.createGain()
  g.gain.value = depth
  o.connect(g).connect(param)
  o.start()
  stops.push(o)
}

/** A whistled bird note: a sine sliding f0 → f1, soft attack. */
function whistle(c: AudioContext, to: AudioNode, t: number, f0: number, f1: number, dur: number, vol: number) {
  tone(c, to, t, f0, f1, dur, vol, 'sine', Math.min(0.05, dur * 0.3))
}

/** Kakkō: the cuckoo's falling two notes, sometimes twice. */
function cuckoo(c: AudioContext, to: AudioNode, t: number) {
  const k = vary(1, 0.04)
  const calls = Math.random() < 0.5 ? 1 : 2
  for (let i = 0; i < calls; i++) {
    const s = t + i * 0.9
    whistle(c, to, s, 700 * k, 690 * k, 0.24, 0.05)
    whistle(c, to, s + 0.32, 575 * k, 560 * k, 0.36, 0.045)
  }
}

/** Uguisu (bush warbler): a long held whistle that lifts, then a quick flourish. */
function warbler(c: AudioContext, to: AudioNode, t: number) {
  const k = vary(1, 0.05)
  whistle(c, to, t, 1150 * k, 1250 * k, 1.1, 0.03)
  const s = t + 1.25
  whistle(c, to, s, 2900 * k, 2300 * k, 0.12, 0.028)
  whistle(c, to, s + 0.16, 2200 * k, 2600 * k, 0.14, 0.025)
  whistle(c, to, s + 0.34, 2700 * k, 2000 * k, 0.32, 0.03)
}

/** A small bird somewhere above: a few quick chips. */
function chips(c: AudioContext, to: AudioNode, t: number) {
  const n = 2 + Math.floor(Math.random() * 4)
  const f = vary(4200, 0.15)
  for (let i = 0; i < n; i++) whistle(c, to, t + i * vary(0.11, 0.2), f, f * 0.82, 0.05, 0.016)
}

const pick = (gap: [number, number]) => (gap[0] + Math.random() * (gap[1] - gap[0])) * 1000

/** Start the forest bed; returns a stop that fades it out. */
export function startForestAmbience(): () => void {
  const c = audio()
  if (!c || !out) return () => {}
  if (c.state === 'suspended') void c.resume().catch(() => {})
  bed?.stop()

  const stops: AudioScheduledSourceNode[] = []
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(BED_VOL, c.currentTime + BED_FADE)
  gain.connect(out)

  // Wind in the canopy, high above: two slow, out-of-step layers of soft noise.
  for (const [freq, q, vol, rate] of [
    [380, 0.7, 0.09, 0.037],
    [900, 0.9, 0.035, 0.053],
  ] as const) {
    const s = c.createBufferSource()
    s.buffer = noise
    s.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const g = c.createGain()
    g.gain.value = vol
    s.connect(bp).connect(g).connect(gain)
    s.start(0, Math.random() * 1.5)
    stops.push(s)
    lfo(c, g.gain, rate, vol * 0.7, stops)
    lfo(c, bp.frequency, rate * 0.7, freq * 0.35, stops)
  }

  // Birds sit somewhere off in the trees: through a darkening echo, a touch muffled.
  const birdIn = c.createGain()
  const birdLp = c.createBiquadFilter()
  birdLp.type = 'lowpass'
  birdLp.frequency.value = 3800
  const delay = c.createDelay(1.5)
  delay.delayTime.value = 0.38
  const fb = c.createGain()
  fb.gain.value = 0.32
  const echoLp = c.createBiquadFilter()
  echoLp.type = 'lowpass'
  echoLp.frequency.value = 1800
  birdIn.connect(birdLp).connect(gain)
  birdLp.connect(delay)
  delay.connect(echoLp).connect(fb).connect(delay)
  echoLp.connect(gain)

  let birdTimer = 0
  const bird = () => {
    birdTimer = window.setTimeout(bird, pick(BIRD_GAP))
    if (c.state !== 'running') return
    const t = c.currentTime + 0.05
    const r = Math.random()
    if (r < 0.35) cuckoo(c, birdIn, t)
    else if (r < 0.65) warbler(c, birdIn, t)
    else chips(c, birdIn, t)
  }
  birdTimer = window.setTimeout(bird, 2500 + Math.random() * 3000)

  // Now and then a breath of wind stirs the leaves nearby.
  let rustleTimer = 0
  const rustle = () => {
    rustleTimer = window.setTimeout(rustle, pick(RUSTLE_GAP))
    if (c.state !== 'running') return
    const t = c.currentTime + 0.05
    air(c, gain, t, 'highpass', vary(2500, 0.2), vary(3500, 0.2), 1.4 + Math.random() * 1.2, 0.035, 0.45, 0.6)
  }
  rustleTimer = window.setTimeout(rustle, pick(RUSTLE_GAP))

  const me = {
    stop: () => {
      if (bed === me) bed = null
      window.clearTimeout(birdTimer)
      window.clearTimeout(rustleTimer)
      const t = c.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
      for (const n of stops) n.stop(t + 1.3)
      window.setTimeout(() => gain.disconnect(), 1600)
    },
  }
  bed = me
  return me.stop
}
