import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Code-built low-poly forest pieces (same approach as Ninja Run's scenery):
 * tall slim pine trunks with a few dead lower twigs, tiered pine crowns, ferns
 * and rocks. All flat-shaded, position + normal only, merged per piece so each
 * is one instanced draw.
 *
 * Trunks are modelled at a reference size (TRUNK_R base radius, TRUNK_H tall)
 * and scaled per instance, so the twigs stay in proportion.
 */
export const TRUNK_R = 0.35
export const TRUNK_H = 26

/** Deterministic 0..1 for (a, b, salt): the same tree always grows in the same place. */
export function hash3(a: number, b: number, salt: number): number {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

/** Non-indexed, normals only — mergeGeometries needs matching attributes. */
export function prep(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g
  n.deleteAttribute('uv')
  n.computeVertexNormals()
  return n
}

/** A trunk: tapering 6-sided column with a small root flare and dead twigs. */
export function trunkGeometry(variant: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(TRUNK_R * 0.32, TRUNK_R, TRUNK_H, 6, 5)
  trunk.translate(0, TRUNK_H / 2, 0)
  // A gentle lean / kink so the columns aren't ruler-straight.
  const pos = trunk.getAttribute('position')
  const lean = (hash3(variant, 7, 1) - 0.5) * 0.5
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / TRUNK_H
    pos.setX(i, pos.getX(i) + lean * y * y + Math.sin(y * 9 + variant) * 0.03)
  }
  parts.push(prep(trunk))
  const flare = new THREE.CylinderGeometry(TRUNK_R * 0.95, TRUNK_R * 1.55, 0.7, 6)
  flare.translate(0, 0.35, 0)
  parts.push(prep(flare))
  // Dead twigs low on the trunk (a dense pine stand self-prunes its lower limbs).
  const twigs = 4 + Math.floor(hash3(variant, 3, 2) * 4)
  for (let k = 0; k < twigs; k++) {
    const y = 2.2 + hash3(variant, k, 3) * 9
    const len = 0.45 + hash3(variant, k, 4) * 0.9
    const twig = new THREE.CylinderGeometry(0.015, 0.045, len, 4)
    twig.translate(0, len / 2, 0)
    twig.rotateZ(-(1.1 + hash3(variant, k, 5) * 0.5)) // out and a little down
    twig.rotateY(hash3(variant, k, 6) * Math.PI * 2)
    twig.translate(0, y, 0) // rooted on the trunk's axis, so it grows out of the bark
    parts.push(prep(twig))
  }
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

/** Like prep, but keeps uvs (for textured pieces: the fir fronds). */
function prepUV(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g
  n.computeVertexNormals()
  return n
}

/**
 * A painted fir frond: a stem with needles brushed out either side, dark at
 * the stem and lit at the tips, tapering to the end. Transparent around it, so
 * the bough reads as feathery (alphaTest), not as a card.
 */
export function frondTexture(): THREE.CanvasTexture {
  const W = 256
  const H = 112
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.lineCap = 'round'
  const mid = H / 2
  // Needles: short strokes angled toward the tip, longest mid-frond.
  for (let pass = 0; pass < 3; pass++) {
    for (let k = 0; k < 140; k++) {
      const t = hash3(k, pass, 30)
      const x = 6 + t * (W - 14)
      const reach = Math.sin(Math.min(1, t * 1.15) * Math.PI) * (H * 0.46) * (0.55 + hash3(k, pass, 31) * 0.5)
      const side = hash3(k, pass, 32) < 0.5 ? -1 : 1
      const droop = t * 6
      const ex = x + reach * (0.55 + hash3(k, pass, 33) * 0.3)
      const ey = mid + droop + side * reach * (0.75 + hash3(k, pass, 34) * 0.2)
      const grd = g.createLinearGradient(x, mid, ex, ey)
      const dark = ['#14281d', '#1c3826', '#24452b'][pass]
      const lit = ['#2f5634', '#456f3e', '#6b9448'][pass]
      grd.addColorStop(0, dark)
      grd.addColorStop(1, lit)
      g.strokeStyle = grd
      g.lineWidth = 3.2 - pass * 0.8
      g.beginPath()
      g.moveTo(x, mid + droop * 0.5)
      g.quadraticCurveTo((x + ex) / 2, (mid + ey) / 2 + 4, ex, ey)
      g.stroke()
    }
  }
  // The stem.
  g.strokeStyle = '#2b2a1c'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(0, mid)
  g.quadraticCurveTo(W * 0.5, mid + 2, W - 4, mid + 7)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** One frond: a card from the trunk out to `len`, drooping toward its tip. */
function frond(len: number, width: number, droop: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(len, width, 6, 1).translate(len / 2, 0, 0)
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / len
    pos.setY(i, pos.getY(i) - droop * u * u + 0.15 * u)
  }
  // Lie it (mostly) flat, tipped a little so the camera sees its face.
  g.rotateX(-Math.PI / 2 + 0.35)
  return g
}

/**
 * A fir crown: tiers of feathery fronds sprawling out from the trunk, long
 * and drooping low down, short near the top — like the boughs in Leonard's
 * painted reference. Starts low enough that the lower boughs hang into view.
 */
export function crownGeometry(variant: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const base = 0.3 + hash3(variant, 1, 9) * 0.06
  const tiers = 13
  for (let k = 0; k < tiers; k++) {
    const f = k / (tiers - 1)
    const y = TRUNK_H * (base + (0.99 - base) * f)
    const n = 6 + Math.floor(hash3(variant, k, 14) * 3)
    for (let j = 0; j < n; j++) {
      const len = (3.2 - 2.4 * f) * (0.75 + hash3(variant * 31 + k, j, 10) * 0.5)
      const g = frond(len, len * 0.5, len * 0.42)
      g.rotateY((j / n) * Math.PI * 2 + hash3(variant, k, 11) * 2 + hash3(k, j, 12) * 0.5)
      g.translate(0, y, 0)
      parts.push(prepUV(g))
    }
  }
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

/** A painted tuft of grass: blades fanning up from the root, dark at the
 *  base and lit lime at the tips. */
export function grassTexture(): THREE.CanvasTexture {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.lineCap = 'round'
  for (let k = 0; k < 26; k++) {
    const x0 = S / 2 + (hash3(k, 1, 40) - 0.5) * S * 0.35
    const lean = (hash3(k, 2, 40) - 0.5) * S * 0.9
    const h = S * (0.45 + hash3(k, 3, 40) * 0.5)
    const grd = g.createLinearGradient(0, S, 0, S - h)
    grd.addColorStop(0, '#1f3a1c')
    grd.addColorStop(0.6, '#4f7f2c')
    grd.addColorStop(1, hash3(k, 4, 40) < 0.3 ? '#c8d36a' : '#8fbf3e')
    g.strokeStyle = grd
    g.lineWidth = 2.2 + hash3(k, 5, 40) * 2
    g.beginPath()
    g.moveTo(x0, S)
    g.quadraticCurveTo(x0 + lean * 0.2, S - h * 0.6, x0 + lean * 0.55, S - h)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Two crossed cards for a grass tuft, rooted at y = 0. */
export function grassGeometry(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(1, 0.8).translate(0, 0.4, 0)
  const b = a.clone().rotateY(Math.PI / 2)
  const g = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()])!
  a.dispose()
  b.dispose()
  return g
}

/** A fern: blades arcing out from the centre. */
export function fernGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const blades = 8
  for (let k = 0; k < blades; k++) {
    const len = 0.7 + hash3(k, 2, 20) * 0.35
    const g = new THREE.BufferGeometry()
    // A blade: two triangles, wide at the middle, folded slightly along its spine.
    const v = new Float32Array([
      0, 0, 0, 0.09, 0.04, len * 0.45, 0, 0.06, len,
      0, 0, 0, 0, 0.06, len, -0.09, 0.04, len * 0.45,
    ])
    g.setAttribute('position', new THREE.BufferAttribute(v, 3))
    g.rotateX(-(0.55 + hash3(k, 3, 21) * 0.35)) // arc up
    g.rotateY((k / blades) * Math.PI * 2 + hash3(k, 4, 22) * 0.4)
    parts.push(prep(g))
  }
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

export function rockGeometry(): THREE.BufferGeometry {
  const g = new THREE.DodecahedronGeometry(0.45, 0)
  g.scale(1.2, 0.6, 1)
  g.translate(0, 0.12, 0)
  return prep(g)
}

/** Soft radial glow (motes, pools). */
export function glowTexture(): THREE.CanvasTexture {
  const S = 64
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.18, 'rgba(255,255,255,0.65)')
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A light shaft: soft across its width, brightest up in the canopy, gone by
 *  the ground. */
export function shaftTexture(): THREE.CanvasTexture {
  const W = 64
  const H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const img = g.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1) // 0 top … 1 bottom
    const down = Math.pow(1 - v, 0.7) * THREE.MathUtils.smoothstep(v, 0, 0.12) + 0.15 * Math.exp(-((v - 0.96) ** 2) / 0.002)
    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1)) * 2 - 1
      const across = Math.exp(-u * u * 3.2) * (1 - u * u)
      const a = Math.max(0, Math.min(1, down * across))
      const i = (y * W + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(a * 255)
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** What the foreground strip is drawn from (FOREST.foreground). */
interface ForegroundSpec {
  tile: number
  base: number
  peak: number
  color: string
  back: string
  speck: string
  specks: number
  brush: readonly [string, string, string]
  strokes: number
}

/**
 * The foreground strip as one seamless tile: solid dark below `base`, a lumpy
 * top of mounds with broad leaves, mushrooms, grass blades and fern fronds
 * rising out of it, a slightly lighter row of the same behind, and a few warm
 * specks down in the dark. Units are screen u (the path at 0); the canvas spans
 * [bottom, top], returned so the plane can line up with it.
 */
export function foregroundTexture(F: ForegroundSpec): { tex: THREE.CanvasTexture; top: number; bottom: number } {
  const PX = 96
  const top = F.peak + 0.15
  const bottom = F.base - 0.8
  const c = document.createElement('canvas')
  c.width = Math.round(F.tile * PX)
  c.height = Math.round((top - bottom) * PX)
  const g = c.getContext('2d')!
  const X = (u: number) => u * PX
  const Y = (v: number) => (top - v) * PX
  const r = (k: number, salt: number) => hash3(k, 17, salt)
  const lerp = THREE.MathUtils.lerp
  // Every shape is drawn a tile to either side too, so the pattern wraps.
  const tiled = (x: number, draw: (x: number) => void) => {
    for (const o of [-F.tile, 0, F.tile]) draw(x + o)
  }

  const mound = (x: number, v: number, rad: number) => {
    g.beginPath()
    g.ellipse(X(x), Y(v), rad * PX * 1.5, rad * PX, 0, 0, Math.PI * 2)
    g.fill()
  }
  /** A broad leaf on a short stalk, leaning `lean` rad, tip curling `curl`. */
  const leaf = (x: number, v: number, h: number, lean: number, w: number, curl: number) => {
    g.save()
    g.translate(X(x), Y(v))
    g.rotate(lean)
    const H = h * PX
    const Wd = w * PX
    g.lineWidth = Math.max(0.03, w * 0.12) * PX
    g.beginPath()
    g.moveTo(0, 0)
    g.quadraticCurveTo(curl * 0.2 * PX, -H * 0.2, curl * 0.1 * PX, -H * 0.32)
    g.stroke()
    g.beginPath()
    g.moveTo(curl * 0.1 * PX, -H * 0.3)
    g.bezierCurveTo(Wd, -H * 0.45, Wd * 0.7, -H * 0.85, curl * PX, -H)
    g.bezierCurveTo(-Wd * 0.6, -H * 0.8, -Wd, -H * 0.45, curl * 0.1 * PX, -H * 0.3)
    g.fill()
    g.restore()
  }
  /** A thin-stemmed mushroom with a domed cap. */
  const mushroom = (x: number, v: number, h: number, cap: number, lean: number) => {
    const tx = X(x + lean)
    const ty = Y(v + h)
    g.lineWidth = Math.max(0.035, cap * 0.3) * PX
    g.beginPath()
    g.moveTo(X(x), Y(v))
    g.quadraticCurveTo(X(x - lean * 0.3), Y(v + h * 0.5), tx, ty)
    g.stroke()
    g.beginPath()
    g.ellipse(tx, ty + cap * PX * 0.08, cap * PX, cap * PX * 0.6, lean * 0.4, Math.PI, Math.PI * 2)
    g.fill()
  }
  /** A clump of tapering grass blades. */
  const blades = (x: number, v: number, h: number, n: number, k: number) => {
    for (let b = 0; b < n; b++) {
      const bx = x + (r(k, 60 + b) - 0.5) * 0.3
      const bh = h * (0.55 + r(k, 70 + b) * 0.45)
      const lean = (r(k, 80 + b) - 0.5) * 0.9 * bh
      const w = 0.035 + r(k, 90 + b) * 0.03
      g.beginPath()
      g.moveTo(X(bx - w), Y(v))
      g.quadraticCurveTo(X(bx + lean * 0.2), Y(v + bh * 0.6), X(bx + lean), Y(v + bh))
      g.quadraticCurveTo(X(bx + lean * 0.2 + w), Y(v + bh * 0.5), X(bx + w), Y(v))
      g.fill()
    }
  }
  /** A fern frond arcing over to one side, leaflets shrinking to the tip. */
  const frond = (x: number, v: number, len: number, side: number) => {
    const tipX = x + side * len * 0.75
    const tipV = v + len * 0.45
    const cx = x + side * len * 0.15
    const cv = v + len * 0.95
    const at = (t: number) => {
      const a = (1 - t) * (1 - t)
      const b = 2 * (1 - t) * t
      const d = t * t
      return [a * x + b * cx + d * tipX, a * v + b * cv + d * tipV]
    }
    const k = len / 1.5
    g.lineWidth = 0.04 * k * PX
    g.beginPath()
    for (let t = 0; t <= 1.001; t += 0.05) {
      const [px, pv] = at(t)
      if (t === 0) g.moveTo(X(px), Y(pv))
      else g.lineTo(X(px), Y(pv))
    }
    g.stroke()
    for (let t = 0.15; t < 0.97; t += 0.07) {
      const [px, pv] = at(t)
      const [nx, nv] = at(t + 0.01)
      const ang = Math.atan2(-(nv - pv), nx - px)
      const s = (0.2 * (1 - t) + 0.04) * k
      for (const sgn of [-1, 1]) {
        g.beginPath()
        g.ellipse(X(px), Y(pv), s * PX, s * PX * 0.32, ang + sgn * 1.1, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  /** A size multiplier with a wide spread: mostly small, some medium, the odd
   *  huge one (Leonard: the strip should vary in size a lot more). */
  const size = (k: number, salt: number) => {
    const p = r(k, salt)
    const t = r(k, salt + 500)
    if (p < 0.5) return lerp(0.3, 0.65, t)
    if (p < 0.82) return lerp(0.8, 1.25, t)
    return lerp(1.7, 2.8, t)
  }
  /** Where something `h` tall is rooted: on the row normally, sunk deeper into
   *  the dark when it's big, so huge pieces stay huge without towering over
   *  the path. */
  const root = (v0: number, h: number) => Math.min(v0 - 0.1, F.peak - h * 0.92)

  /** One row of the strip at `lift` above base: mounds, then things rising out. */
  const row = (seed: number, lift: number, scale: number) => {
    const k0 = seed * 1000
    const v0 = F.base + lift
    // Lumpy top of the dark: little bumps to great rounded hummocks.
    for (let k = 0; k < 22; k++) {
      const x = (k + r(k0 + k, 1)) * (F.tile / 22)
      const rad = 0.38 * size(k0 + k, 2) * scale
      tiled(x, (x) => mound(x, Math.min(v0 - rad * 0.35, F.peak - rad * 1.6), rad))
    }
    for (let k = 0; k < 12; k++) {
      const x = r(k0 + k, 10) * F.tile
      const h = 1.05 * size(k0 + k, 11) * scale
      const lean = (r(k0 + k, 13) - 0.5) * 1.1
      const w = h * (0.34 + r(k0 + k, 14) * 0.18)
      const curl = (r(k0 + k, 15) - 0.5) * 0.5 * Math.min(h, 1.5)
      const v = root(v0, h)
      tiled(x, (x) => leaf(x, v, h, lean, w, curl))
      // Often a second, smaller leaf from the same root.
      if (r(k0 + k, 16) < 0.6)
        tiled(x, (x) => leaf(x + 0.08 * h, v, h * 0.6, lean + (lean > 0 ? -0.7 : 0.7), w * 0.8, -curl))
    }
    for (let k = 0; k < 18; k++) {
      const x = r(k0 + k, 20) * F.tile
      const h = 0.75 * size(k0 + k, 21) * scale
      tiled(x, (x) => blades(x, root(v0 + 0.05, h), h, 3 + Math.floor(r(k0 + k, 22) * 4), k0 + k))
    }
    for (let k = 0; k < 7; k++) {
      const x = r(k0 + k, 30) * F.tile
      const len = 1.35 * size(k0 + k, 31) * scale
      tiled(x, (x) => frond(x, root(v0, len * 0.95), len, r(k0 + k, 32) < 0.5 ? -1 : 1))
    }
    // Mushrooms in little clusters of one to three: buttons to tall parasols.
    for (let k = 0; k < 7; k++) {
      const x = r(k0 + k, 40) * F.tile
      const n = 1 + Math.floor(r(k0 + k, 41) * 3)
      const sz = size(k0 + k, 39) * scale
      for (let m = 0; m < n; m++) {
        const h = (0.45 + r(k0 + k, 42 + m) * 0.4) * sz * (m === 0 ? 1 : 0.6)
        const cap = (0.2 + r(k0 + k, 46 + m) * 0.12) * sz * (m === 0 ? 1 : 0.7)
        const lean = (r(k0 + k, 50 + m) - 0.5) * 0.3
        tiled(x, (x) => mushroom(x + m * 0.3 * sz, root(v0, h + cap * 0.6), h, cap, lean))
      }
    }
  }

  g.lineCap = 'round'
  // The lighter row behind first, a little higher, so it peeks over the front.
  g.fillStyle = g.strokeStyle = F.back
  row(2, 0.35, 0.9)
  g.fillStyle = g.strokeStyle = F.color
  row(1, 0, 1)
  g.fillRect(0, Y(F.base), c.width, c.height)

  // Brushwork, painted only over what's already there (source-atop) so the
  // silhouette edge stays put: short, slightly bent, mostly lying-down strokes,
  // the lifted green more often and stronger toward the top, where the light
  // from the path reaches.
  g.globalCompositeOperation = 'source-atop'
  for (let k = 0; k < F.strokes; k++) {
    const x = r(k, 200) * F.tile
    const up = r(k, 201)
    const v = lerp(bottom, top, up)
    const len = (0.25 + r(k, 202) * 0.7) * PX
    const ang = (r(k, 203) - 0.5) * 1.4
    const bend = (r(k, 204) - 0.5) * 0.35 * len
    const t = r(k, 205)
    const light = t < 0.25 + 0.35 * up
    g.strokeStyle = light ? F.brush[0] : t < 0.85 ? F.brush[1] : F.brush[2]
    g.globalAlpha = (0.15 + r(k, 206) * 0.3) * (light ? 0.6 + 0.8 * up : 1)
    g.lineWidth = (0.05 + r(k, 207) * 0.13) * PX
    const dx = (Math.cos(ang) * len) / 2
    const dy = (Math.sin(ang) * len) / 2
    tiled(x, (x) => {
      const cx = X(x)
      const cy = Y(v)
      g.beginPath()
      g.moveTo(cx - dx, cy - dy)
      g.quadraticCurveTo(cx - dy * 0.2 + bend, cy + dx * 0.2 - bend, cx + dx, cy + dy)
      g.stroke()
    })
  }
  g.globalAlpha = 1
  g.globalCompositeOperation = 'source-over'

  // A few warm specks down in the dark.
  g.fillStyle = F.speck
  for (let k = 0; k < F.specks; k++) {
    const x = r(k, 100) * F.tile
    const v = lerp(bottom + 0.15, F.base - 0.1, r(k, 101))
    const s = 0.04 + r(k, 102) * 0.06
    const ang = r(k, 103) * Math.PI
    g.globalAlpha = 0.55 + r(k, 104) * 0.45
    tiled(x, (x) => {
      g.beginPath()
      g.ellipse(X(x), Y(v), s * PX, s * PX * 0.45, ang, 0, Math.PI * 2)
      g.fill()
    })
  }
  g.globalAlpha = 1

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, top, bottom }
}

// --- The path: sometimes dirt, sometimes grass -------------------------------------

/** The path pattern repeats every this many u (long enough not to notice). */
export const PATH_TILE = 72

/** Smooth value noise along x that wraps every PATH_TILE (`cell` must divide it). */
function wrapNoise(x: number, cell: number, salt: number): number {
  const n = PATH_TILE / cell
  const t = x / cell
  const i = Math.floor(t)
  const f = t - i
  const s = f * f * (3 - 2 * f)
  const a = hash3((((i % n) + n) % n), 23, salt)
  const b = hash3(((((i + 1) % n) + n) % n), 23, salt)
  return a + (b - a) * s
}

/**
 * How worn the path is at x: 1 = bare dirt edge to edge, 0 = grown over with
 * grass. Long stretches of dirt, broken now and then by patchy bits and
 * grassy ones. Shared by the path texture and the grass growing on the path.
 */
export function pathDirt(x: number): number {
  const v = 0.7 * wrapNoise(x, 8, 1) + 0.3 * wrapNoise(x, 3, 2)
  return THREE.MathUtils.smoothstep(v, 0.25, 0.5)
}

/**
 * The path as one tile (PATH_TILE long, `half + edge` either side of the
 * centre line): bare dirt whose width follows pathDirt, a darker worn rim
 * round it, ragged at the edges, transparent (the grass floor) elsewhere.
 * Canvas row 0 is the far side of the path.
 */
export function pathTexture(half: number, edge: number, dirt: string, rim: string): THREE.CanvasTexture {
  const PX = 24
  const H = half + edge
  const w = PATH_TILE * PX
  const h = Math.round(2 * H * PX)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  // Raw sRGB bytes, as the canvas wants them.
  const rgb = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16))
  const d = rgb(dirt)
  const r = rgb(rim)
  // Ragged edges + the odd tuft of grass breaking up the dirt: 2D value noise
  // (wrapped along x).
  const noise2 = (x: number, z: number, cell: number, salt: number) => {
    const zi = Math.floor(z / cell)
    const zf = z / cell - zi
    const s = zf * zf * (3 - 2 * zf)
    const a = wrapNoise(x, cell, salt + zi * 7)
    const b = wrapNoise(x, cell, salt + (zi + 1) * 7)
    return a + (b - a) * s
  }
  for (let py = 0; py < h; py++) {
    const z = (py + 0.5) / PX - H
    for (let px = 0; px < w; px++) {
      const x = (px + 0.5) / PX
      const worn = pathDirt(x)
      const rag = (noise2(x, z + 9, 0.5, 40) - 0.5) * 0.5 + (noise2(x, z + 9, 0.2, 60) - 0.5) * 0.2
      const width = half * worn + rag
      const az = Math.abs(z)
      const o = (py * w + px) * 4
      let c: number[] | null = null
      if (az < width) c = d
      else if (az < width + edge * Math.min(1, worn * 3) + rag * 0.5) c = r
      if (!c) continue
      img.data[o] = c[0]
      img.data[o + 1] = c[1]
      img.data[o + 2] = c[2]
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  return t
}
