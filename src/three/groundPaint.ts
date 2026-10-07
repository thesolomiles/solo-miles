import * as THREE from 'three'
import { GROUND, type GroundPath } from '../config/ground'
import { SOUTH_TRAIL } from '../config/forest'

/**
 * Paints the town ground in code (config/ground.ts). The Blender `Ground` is one
 * grass swatch (plus the river channel, banks and bed); a fragment-shader patch
 * repaints the grass with:
 *  - grass tones from pixel-snapped world noise (big soft blotches, stepped), and
 *  - a path map: one RGBA texel per grid cell, baked here from the path shapes
 *    (alpha = tile present), sampled NEAREST so tiles stay crisp.
 * Lighting, shadows and fog are untouched — only the base colour changes.
 */

const C = GROUND.cell
const N = Math.round((GROUND.extent * 2) / C) // texels per side

function hash(x: number, z: number, salt: number) {
  const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453
  return h - Math.floor(h)
}

/** Smooth value noise (0..1) — clusters tile tones instead of confetti. */
function noise(x: number, z: number, salt: number) {
  const ix = Math.floor(x), iz = Math.floor(z)
  const fx = x - ix, fz = z - iz
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz)
  const a = hash(ix, iz, salt), b = hash(ix + 1, iz, salt)
  const c = hash(ix, iz + 1, salt), d = hash(ix + 1, iz + 1, salt)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

/** Smooth union of two insets (positive = inside): fills the inside corners
 *  where shapes meet with a fillet of radius ~k. */
function smax(a: number, b: number, k: number) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + (h * h * k) / 4
}

/** Distance from (x,z) to a polyline, and how far along it the nearest point is. */
function polyDist(pts: [number, number][], x: number, z: number) {
  let best = Infinity, s = 0, acc = 0
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1]
    const abx = bx - ax, abz = bz - az
    const len = Math.hypot(abx, abz)
    const t = THREE.MathUtils.clamp(((x - ax) * abx + (z - az) * abz) / (len * len), 0, 1)
    const d = Math.hypot(x - (ax + abx * t), z - (az + abz * t))
    if (d < best) { best = d; s = acc + len * t }
    acc += len
  }
  return { d: best, s }
}

/** Densify a polyline into a smooth curve. */
function smooth(line: [number, number][]): [number, number][] {
  const curve = new THREE.CatmullRomCurve3(line.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
  return curve.getSpacedPoints(Math.ceil(curve.getLength() / 0.2)).map((p) => [p.x, p.z])
}

/** How far inside the shape (x,z) is, in u (negative = outside), plus distance along. */
function inset(p: GroundPath, pts: [number, number][] | null, x: number, z: number) {
  if ('rect' in p) {
    // Rounded box: shrink by the radius, then grow back round the corners.
    const [x0, x1, z0, z1] = p.rect
    const r = p.round ?? 0
    const dx = Math.max(x0 + r - x, x - x1 + r), dz = Math.max(z0 + r - z, z - z1 + r)
    const out = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - r
    return { inset: -out, s: 0 }
  }
  const { d, s } = polyDist(pts!, x, z)
  return { inset: p.width / 2 - d, s }
}

function bbox(p: GroundPath): [number, number, number, number] {
  const h = 'rect' in p ? 1.5 : p.width + 0.5 // room for the fade + fillets
  if ('rect' in p) return [p.rect[0] - h, p.rect[1] + h, p.rect[2] - h, p.rect[3] + h]
  const xs = p.line.map((q) => q[0]), zs = p.line.map((q) => q[1])
  return [Math.min(...xs) - h, Math.max(...xs) + h, Math.min(...zs) - h, Math.max(...zs) + h]
}

/** Bake every path into an N×N sRGB texture, one texel per cell. */
export function bakePathMap(): THREE.DataTexture {
  const data = new Uint8Array(N * N * 4)
  const dirtInset = new Float32Array(N * N).fill(-Infinity)
  const trail: { d: number; s: number; w: number }[] = new Array(N * N)

  const toCell = (v: number) => Math.floor((v + GROUND.extent) / C)
  for (const p of GROUND.paths) {
    const pts = 'line' in p ? (p.style === 'overgrown' ? smooth(p.line) : p.line) : null
    const [x0, x1, z0, z1] = bbox(p)
    for (let i = Math.max(0, toCell(x0)); i <= Math.min(N - 1, toCell(x1)); i++) {
      for (let j = Math.max(0, toCell(z0)); j <= Math.min(N - 1, toCell(z1)); j++) {
        const cx = (i + 0.5) * C - GROUND.extent
        const cz = (j + 0.5) * C - GROUND.extent
        const r = inset(p, pts, cx, cz)
        const k = j * N + i
        if (p.style === 'dirt') dirtInset[k] = dirtInset[k] === -Infinity ? r.inset : smax(dirtInset[k], r.inset, GROUND.dirt.round)
        else if ('width' in p && (!trail[k] || r.inset > p.width / 2 - trail[k].d))
          trail[k] = { d: p.width / 2 - r.inset, s: r.s, w: p.width / 2 }
      }
    }
  }

  const D = GROUND.dirt
  const col = (hex: string) => new THREE.Color(hex)
  const dirt = { mid: col(D.mid), light: col(D.light), dark: col(D.dark), pale: col(D.pale) }
  const grass = col(GROUND.grass.base)
  const moss = col(SOUTH_TRAIL.color)
  const bare = col('#7a6a47')
  const put = (k: number, c: THREE.Color, alpha = 1) => {
    // Colours are stored as sRGB bytes; the texture is tagged sRGB, so the GPU
    // hands the shader linear values.
    const s = c.clone().convertLinearToSRGB()
    data[k * 4] = s.r * 255
    data[k * 4 + 1] = s.g * 255
    data[k * 4 + 2] = s.b * 255
    data[k * 4 + 3] = alpha * 255
  }

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i
      // Dirt: a solid core, a worn rim, then a fade out into the grass — tiles
      // thin out and turn grassy (partial alpha over the grass) across the fringe.
      const a = dirtInset[k]
      if (a > -D.fringe) {
        // Edge wobble so the fade line isn't a ruler.
        const aw = a + (noise(i * 0.35, j * 0.35, 7) - 0.5) * 0.35
        const cover = THREE.MathUtils.smoothstep(aw, -D.fringe, D.rim)
        if (hash(i, j, 2) < 0.35 + 0.65 * cover) {
          // Tones cluster (noise), with a little per-tile jitter.
          const n = noise(i * 0.45, j * 0.45, 3) + (hash(i, j, 3) - 0.5) * 0.25
          const tone = n < 0.3 ? dirt.dark : n > 0.72 ? dirt.light : dirt.mid
          if (cover >= 0.999) {
            if (hash(i, j, 4) < D.tufts) put(k, grass)
            else put(k, n > 0.86 ? dirt.pale : tone)
          } else {
            // Quantised steps keep it pixel-y: ⅓, ⅔ or full dirt over grass.
            const step = Math.ceil(cover * 3 - hash(i, j, 5) * 0.6) / 3
            if (step > 0) put(k, cover < 0.5 ? dirt.dark : tone, Math.min(1, step))
          }
          continue
        }
      }
      // Overgrown trail — half grown over, fading in at the meadow end.
      const t = trail[k]
      if (t) {
        const w = t.w * (0.85 + 0.3 * hash(Math.round(t.s * 2), 0, 1))
        if (t.d > w) continue
        const edge = 1 - THREE.MathUtils.smoothstep(t.d, w * 0.5, w)
        const keep = 0.85 * edge * THREE.MathUtils.smoothstep(t.s, 0, SOUTH_TRAIL.fadeIn)
        if (hash(i, j, 2) > keep) continue
        const r = hash(i, j, 3)
        put(k, r < 0.25 + 0.35 * (1 - edge) ? grass : r > 0.88 && edge > 0.8 ? bare : moss)
      }
    }
  }

  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

const G = GROUND.grass
export const GROUND_UNIFORMS = {
  uPathMap: { value: null as THREE.Texture | null },
  uCell: { value: C },
  uExtent: { value: GROUND.extent },
  uRiver: { value: new THREE.Vector2(...GROUND.riverBand) },
  uGrass: { value: new THREE.Color(G.base) },
  uGrassDark: { value: new THREE.Color(G.dark) },
  uGrassLight: { value: new THREE.Color(G.light) },
  uGrassDry: { value: new THREE.Color(G.dry) },
  uScale: { value: G.scale },
  uSteps: { value: new THREE.Vector3(G.darkAt, G.lightAt, G.dryAt) },
  uJitter: { value: G.jitter },
}

/** A clone of the Ground's palette material with the grass/path repaint patched in. */
export function makeGroundMaterial(src: THREE.Material): THREE.Material {
  const mat = src.clone()
  mat.name = 'GroundPainted'
  if (!GROUND_UNIFORMS.uPathMap.value) GROUND_UNIFORMS.uPathMap.value = bakePathMap()
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, GROUND_UNIFORMS)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGroundPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec3 vGroundPos;
uniform sampler2D uPathMap;
uniform float uCell, uExtent, uScale, uJitter;
uniform vec2 uRiver;
uniform vec3 uGrass, uGrassDark, uGrassLight, uGrassDry, uSteps;
float gHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float gNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y);
}
float gFbm(vec2 p) { return 0.6 * gNoise(p) + 0.3 * gNoise(p * 2.1 + 7.3) + 0.1 * gNoise(p * 4.3 - 3.1); }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
{
  vec3 tex = diffuseColor.rgb;
  float sat = max(tex.r, max(tex.g, tex.b)) - min(tex.r, min(tex.g, tex.b));
  bool green = tex.g > tex.r && tex.g > tex.b;
  bool brown = !green && sat > 0.02 && tex.r >= tex.g && tex.g >= tex.b;
  bool river = vGroundPos.z > uRiver.x && vGroundPos.z < uRiver.y;
  // Repaint grass anywhere, and the old painted dirt on the flat town floor.
  if (vGroundPos.y > -0.15 && (green || (brown && !river && abs(vGroundPos.y) < 0.12))) {
    vec2 cell = floor(vGroundPos.xz / uCell);
    vec2 q = (cell + 0.5) * uCell;
    float n = gFbm(q * uScale);
    vec3 c = n < uSteps.x ? uGrassDark : n > uSteps.z ? uGrassDry : n > uSteps.y ? uGrassLight : uGrass;
    c *= 1.0 + (gHash(cell) - 0.5) * 2.0 * uJitter;
    vec4 p = texture2D(uPathMap, (q + uExtent) / (2.0 * uExtent));
    diffuseColor.rgb = mix(c, p.rgb, p.a);
  }
}`,
      )
  }
  mat.customProgramCacheKey = () => 'ground-painted'
  if (import.meta.env.DEV) (window as unknown as { __ground: unknown }).__ground = GROUND_UNIFORMS
  return mat
}
