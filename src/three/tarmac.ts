import * as THREE from 'three'

/** Small deterministic PRNG so the tarmac pattern is stable across reloads. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface TarmacColors {
  /** Base asphalt fill. */
  road: number
  /** Darker mottling (blotches, speckle, cracks). */
  dark: number
  /** Lighter mottling. */
  light: number
}

/**
 * A tileable asphalt texture painted procedurally: broad tonal blotches, fine
 * grain speckle and a few faint cracks. First built for the ride scene's road
 * and shared here so the town road wears the exact same surface. Caller sets
 * `repeat`/`wrap` for the geometry it lands on.
 */
export function makeTarmacTexture(colors: TarmacColors): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
  ctx.fillStyle = hex(colors.road)
  ctx.fillRect(0, 0, S, S)
  const rand = mulberry32(0x7a12ac)
  // Broad soft blotches — larger tonal patches so the asphalt reads as weathered.
  for (let i = 0; i < 26; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 12 + rand() * 34
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rand() < 0.55 ? hex(colors.dark) : hex(colors.light))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.22 + rand() * 0.22
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.globalAlpha = 1
  // Fine grain speckle.
  for (let i = 0; i < 2600; i++) {
    const x = rand() * S
    const y = rand() * S
    const r = 0.6 + rand() * 1.6
    ctx.fillStyle = rand() < 0.5 ? hex(colors.dark) : hex(colors.light)
    ctx.globalAlpha = 0.18 + rand() * 0.3
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Hairline cracks.
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = hex(colors.dark)
  ctx.lineWidth = 1
  for (let i = 0; i < 7; i++) {
    let x = rand() * S
    let y = rand() * S
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let s = 0; s < 6; s++) {
      x += (rand() - 0.5) * 40
      y += (rand() - 0.5) * 40
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}
