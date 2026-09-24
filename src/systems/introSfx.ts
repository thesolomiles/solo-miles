/**
 * Procedural sound for the intro skydive — no audio files. Placeholders until
 * recorded clips replace them.
 *
 * - Wind: a deep, soft HOWL — noise through three low resonant band-passes whose
 *   pitches wander independently (the moaning), over a low rumble, plus fabric
 *   flapping (mid noise with a fast, irregular flutter). Swells on the exit,
 *   carries softly into the town and fades out after the landing.
 * - Land: superhero-style — a rising "incoming" whoosh as they drop in, then on
 *   impact a sharp crack, a deep sub boom, a saturated ground crunch and a
 *   debris rumble, all sent into a long synthetic reverb.
 *
 * Autoplay: browsers keep audio suspended until a click / key / tap. The wind is
 * started (suspended, silent) as the freefall begins, and audio() listens for
 * the first gesture anywhere on the page to resume it — so any click / tap / key
 * brings the howl in, not just the Start button (which also calls startWind as
 * a no-op safety). The landing only plays if audio is running, so it never fires
 * late after a resume.
 */

let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let bus: { out: AudioNode; verb: AudioNode } | null = null

const GESTURES = ['pointerdown', 'keydown', 'touchstart'] as const

function audio(): AudioContext | null {
  if (ctx) return ctx
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  const resume = () => {
    void ctx
      ?.resume()
      .then(() => GESTURES.forEach((g) => window.removeEventListener(g, resume, { capture: true })))
      .catch(() => {})
  }
  GESTURES.forEach((g) => window.addEventListener(g, resume, { capture: true }))
  void ctx.resume().catch(() => {})
  return ctx
}

/** Shared output: a compressor (glues + guards against clipping) and a long
 *  synthetic reverb send for the landing's tail. */
function output(ac: AudioContext) {
  if (bus) return bus
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.ratio.value = 4
  comp.attack.value = 0.003
  comp.release.value = 0.25
  comp.connect(ac.destination)
  // Reverb impulse: 2.6s of stereo noise decaying exponentially.
  const len = Math.floor(ac.sampleRate * 2.6)
  const ir = ac.createBuffer(2, len, ac.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
  }
  const conv = ac.createConvolver()
  conv.buffer = ir
  const wet = ac.createGain()
  wet.gain.value = 0.5
  conv.connect(wet).connect(comp)
  bus = { out: comp, verb: conv }
  return bus
}

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise) return noise
  const len = ac.sampleRate * 2
  noise = ac.createBuffer(1, len, ac.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return noise
}

// ---- wind ----------------------------------------------------------------------

const WIND_VOL = 0.38
// Three howl voices: centre pitch (Hz), how far each wanders, and resonance —
// low + moderately narrow = a deep, soft moan rather than a whistle.
const HOWL = [
  { f: 150, spread: 35, q: 9 },
  { f: 225, spread: 55, q: 10 },
  { f: 340, spread: 80, q: 8 },
]
// Lower-pitched flaps carry less perceived loudness, so a little make-up gain
// keeps the overall level where it was.
const FLAP_VOL = 0.3
let wind: {
  src: AudioBufferSourceNode
  bands: BiquadFilterNode[]
  vgains: GainNode[]
  gain: GainNode
  flap: GainNode
  flutter: OscillatorNode
  timer: number
  rush: number
  level: number
} | null = null

/** Pick fresh gust targets for each voice — the pitch slides that make it moan. */
function gust() {
  if (!ctx || !wind) return
  const t = ctx.currentTime
  wind.bands.forEach((b, i) => {
    const h = HOWL[i]!
    const lift = 1 + wind!.rush * 0.45
    b.frequency.setTargetAtTime((h.f + (Math.random() * 2 - 1) * h.spread) * lift, t, 0.6 + Math.random() * 0.7)
    wind!.vgains[i]!.gain.setTargetAtTime(0.35 + Math.random() * 0.65, t, 0.5 + Math.random() * 0.5)
  })
  // Fabric: the flutter rate + strength wander too, so it flaps in bursts.
  // A few distinct flaps a second (not a buzz), a little quicker on the exit.
  wind.flutter.frequency.setTargetAtTime(3 + Math.random() * 3 + wind.rush * 2.5, t, 0.3)
  wind.flap.gain.setTargetAtTime(FLAP_VOL * (0.4 + Math.random() * 0.8) * (1 + wind.rush), t, 0.25)
}

export function startWind() {
  const ac = audio()
  if (!ac || wind) return
  const { out } = output(ac)
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac)
  src.loop = true
  const gain = ac.createGain()
  gain.gain.value = 0
  gain.gain.setTargetAtTime(WIND_VOL, ac.currentTime, 0.4) // fade in
  // Round off the top so the whole bed stays soft.
  const soft = ac.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 1600
  soft.connect(gain).connect(out)

  // The howl: narrow resonances (high Q) ring at a pitch instead of hissing.
  // Narrow bands pass little energy, so each voice gets make-up gain.
  const bands: BiquadFilterNode[] = []
  const vgains: GainNode[] = []
  for (const h of HOWL) {
    const b = ac.createBiquadFilter()
    b.type = 'bandpass'
    b.frequency.value = h.f
    b.Q.value = h.q
    const g = ac.createGain()
    g.gain.value = 0.6
    const makeup = ac.createGain()
    makeup.gain.value = 4
    src.connect(b).connect(makeup).connect(g).connect(soft)
    bands.push(b)
    vgains.push(g)
  }
  // Body: a low rumble under the howl.
  const low = ac.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 140
  const lg = ac.createGain()
  lg.gain.value = 0.6
  src.connect(low).connect(lg).connect(soft)

  // Fabric flapping: low noise whose level is chopped by a slow flutter LFO
  // (a sawtooth → steep half-wave, so each cycle is one short, bassy "whump"
  // with a gap after it, rather than a continuous flutter).
  const fb = ac.createBiquadFilter()
  fb.type = 'bandpass'
  fb.frequency.value = 320
  fb.Q.value = 0.9
  const fl = ac.createBiquadFilter()
  fl.type = 'lowpass'
  fl.frequency.value = 700
  const chop = ac.createGain()
  chop.gain.value = 0
  const flutter = ac.createOscillator()
  flutter.type = 'sawtooth'
  flutter.frequency.value = 4
  const halfWave = ac.createWaveShaper()
  // The saw is inverted first (it then JUMPS to +1 and ramps down), and ^4 turns
  // that into a sharp attack with a quick fall to silence — separate flaps that
  // hit, then fade, instead of swelling and cutting off.
  const invert = ac.createGain()
  invert.gain.value = -1
  halfWave.curve = new Float32Array(Array.from({ length: 256 }, (_, i) => Math.max(0, (i / 255) * 2 - 1) ** 4))
  flutter.connect(invert).connect(halfWave).connect(chop.gain)
  const flap = ac.createGain()
  flap.gain.value = FLAP_VOL
  src.connect(fb).connect(fl).connect(chop).connect(flap).connect(gain)

  src.start()
  flutter.start()
  wind = { src, bands, vgains, gain, flap, flutter, timer: 0, rush: 0, level: 1 }
  gust()
  wind.timer = window.setInterval(gust, 900)
}

/** 0 = cruising, 1 = full rush (the exit drop): louder, pitch climbing. */
export function setWindRush(k: number) {
  if (!ctx || !wind) return
  const t = ctx.currentTime
  wind.rush = k
  wind.gain.gain.setTargetAtTime(WIND_VOL * wind.level * (1 + k * 1.0), t, 0.1)
  wind.bands.forEach((b, i) => b.frequency.setTargetAtTime(HOWL[i]!.f * (1 + k * 0.45), t, 0.2))
}

/** Settle the wind to a fraction of its level (the cut into town: it carries on,
 *  softer) over `sec` seconds. Also drops the rush. */
export function setWindLevel(level: number, sec = 0.8) {
  if (!ctx || !wind) return
  const t = ctx.currentTime
  wind.level = level
  wind.rush = 0
  wind.gain.gain.cancelScheduledValues(t)
  wind.gain.gain.setTargetAtTime(WIND_VOL * level, t, sec / 3)
  wind.bands.forEach((b, i) => b.frequency.setTargetAtTime(HOWL[i]!.f, t, sec / 2))
}

export function stopWind(fade = 0.15) {
  if (!ctx || !wind) return
  const w = wind
  wind = null
  clearInterval(w.timer)
  const t = ctx.currentTime
  w.gain.gain.cancelScheduledValues(t)
  w.gain.gain.setTargetAtTime(0, t, fade / 3)
  w.src.stop(t + fade * 2)
  w.flutter.stop(t + fade * 2)
}

// ---- landing ---------------------------------------------------------------------

/** A gain envelope: fast attack to `peak`, exponential decay over `decay` s. */
function env(ac: AudioContext, t: number, peak: number, attack: number, decay: number) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  return g
}

/** Soft-clip curve for the ground crunch (grit + weight). */
function drive(ac: AudioContext, amount: number) {
  const ws = ac.createWaveShaper()
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(x * amount)
  }
  ws.curve = curve
  return ws
}

/** The drop-in: a rising whoosh over `dur` seconds, peaking at the impact. */
export function playIncoming(dur = 0.45) {
  const ac = audio()
  if (!ac || ac.state !== 'running') return
  const { out } = output(ac)
  const t = ac.currentTime
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac)
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 3
  bp.frequency.setValueAtTime(260, t)
  bp.frequency.exponentialRampToValueAtTime(1800, t + dur)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9, t + dur)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05)
  src.connect(bp).connect(g).connect(out)
  src.start(t, Math.random())
  src.stop(t + dur + 0.1)
}

export function playLand() {
  const ac = audio()
  if (!ac || ac.state !== 'running') return
  const { out, verb } = output(ac)
  const t = ac.currentTime
  const n = noiseBuffer(ac)
  const send = (node: AudioNode, wet = true) => {
    node.connect(out)
    if (wet) node.connect(verb)
  }

  // 1. Crack: a bright, very short transient — the "hit".
  const crack = ac.createBufferSource()
  crack.buffer = n
  const hp = ac.createBiquadFilter()
  hp.type = 'bandpass'
  hp.frequency.value = 900
  hp.Q.value = 0.7
  const cg = env(ac, t, 0.45, 0.002, 0.06)
  crack.connect(hp).connect(cg)
  send(cg)
  crack.start(t, Math.random())
  crack.stop(t + 0.1)

  // 2. Sub boom: sine pitching 70 → 20 Hz, long tail — the weight. Driven a
  //    touch so its harmonics make the bass audible on small speakers too.
  const sub = ac.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(70, t)
  sub.frequency.exponentialRampToValueAtTime(20, t + 1.2)
  const sg = env(ac, t, 1.0, 0.008, 1.8)
  sub.connect(drive(ac, 1.8)).connect(sg)
  send(sg, false)
  sub.start(t)
  sub.stop(t + 2)

  // 2b. Body: a steady low sine under the sweep so the boom has a floor.
  const body = ac.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(48, t)
  body.frequency.exponentialRampToValueAtTime(32, t + 0.8)
  const bg = env(ac, t, 0.7, 0.01, 1.1)
  body.connect(bg)
  send(bg, false)
  body.start(t)
  body.stop(t + 1.3)

  // 3. Crunch: driven noise in the low-mids — the ground cracking.
  const crunch = ac.createBufferSource()
  crunch.buffer = n
  const cb = ac.createBiquadFilter()
  cb.type = 'bandpass'
  cb.Q.value = 0.9
  cb.frequency.setValueAtTime(420, t)
  cb.frequency.exponentialRampToValueAtTime(90, t + 0.4)
  const cr = env(ac, t, 0.6, 0.004, 0.45)
  crunch.connect(cb).connect(drive(ac, 4)).connect(cr)
  send(cr)
  crunch.start(t, Math.random())
  crunch.stop(t + 0.5)

  // 4. Punch: a mid "thump" square-ish body under the crack.
  const punch = ac.createOscillator()
  punch.type = 'triangle'
  punch.frequency.setValueAtTime(120, t)
  punch.frequency.exponentialRampToValueAtTime(38, t + 0.18)
  const pg = env(ac, t, 0.7, 0.003, 0.25)
  punch.connect(pg)
  send(pg)
  punch.start(t)
  punch.stop(t + 0.3)

  // 5. Debris rumble: low noise settling over ~1.6s.
  const rub = ac.createBufferSource()
  rub.buffer = n
  rub.loop = true
  const rl = ac.createBiquadFilter()
  rl.type = 'lowpass'
  rl.frequency.setValueAtTime(380, t)
  rl.frequency.exponentialRampToValueAtTime(70, t + 1.8)
  const rg = env(ac, t + 0.02, 0.5, 0.03, 1.8)
  rub.connect(rl).connect(rg)
  send(rg)
  rub.start(t, Math.random())
  rub.stop(t + 1.8)
}

// Dev: audition from the console — __sfx.incoming(), __sfx.land(), __sfx.wind(), __sfx.rush(1), __sfx.stop()
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__sfx = {
    land: playLand,
    incoming: playIncoming,
    wind: startWind,
    rush: setWindRush,
    stop: stopWind,
    level: setWindLevel,
    state: () => ctx?.state ?? 'none',
  }
}
