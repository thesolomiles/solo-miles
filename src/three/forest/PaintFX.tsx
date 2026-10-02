import { forwardRef, useMemo } from 'react'
import { Effect, EffectAttribute } from 'postprocessing'
import * as THREE from 'three'
import { charMask } from './CharacterMask'

/**
 * The forest's painterly filter (desktop only — the composer is skipped on
 * phones, which keep the painted materials). A Kuwahara filter: for each pixel
 * it looks at four overlapping square brushes around it and takes the mean of
 * the calmest one, which flattens detail into soft strokes with crisp edges —
 * the "painted, not rendered" look of Leonard's reference. Sample positions are
 * nudged by a little noise so the strokes wobble like a hand-drawn line, and a
 * faint paper grain sits over the result.
 *
 * Leonard himself is left out (CharacterMask): his pixels pass through crisp,
 * and the brushes around him don't pick up his colours, so he reads as the one
 * real thing in a painted world.
 */
const FRAG = /* glsl */ `
uniform float uRadius;
uniform float uGrain;
uniform float uWobble;
uniform float uStep;
uniform sampler2D uCharMask;
uniform float uCharOn;

// His depth, RGBA-packed by MeshDepthMaterial (three's own unpacker).
float charDepthAt(vec2 uv) {
  return unpackRGBAToDepth(texture2D(uCharMask, uv));
}
// Is there any of him drawn at uv (ignoring what's in front)?
bool charThere(vec2 uv) {
  return uCharOn > 0.5 && charDepthAt(uv) < 0.995;
}

float fxHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float fxNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1, 0)), f.x), mix(fxHash(i + vec2(0, 1)), fxHash(i + vec2(1, 1)), f.x), f.y);
}

void sector(vec2 uv, vec2 dir, mat2 rot, inout vec3 bestMean, inout float bestVar) {
  vec3 sum = vec3(0.0);
  vec3 sum2 = vec3(0.0);
  float n = 0.0;
  for (int y = 0; y <= 4; y++) {
    for (int x = 0; x <= 4; x++) {
      if (float(x) > uRadius || float(y) > uRadius) continue;
      vec2 o = (rot * (vec2(float(x), float(y)) * dir)) * texelSize * uStep;
      if (charThere(uv + o)) continue; // paint around him, not with him
      vec3 c = texture2D(inputBuffer, uv + o).rgb;
      sum += c;
      sum2 += c * c;
      n += 1.0;
    }
  }
  if (n < 1.0) return;
  vec3 mean = sum / n;
  vec3 v = abs(sum2 / n - mean * mean);
  float var = v.r + v.g + v.b;
  if (var < bestVar) {
    bestVar = var;
    bestMean = mean;
  }
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  // Leonard, where he's the nearest thing: untouched.
  if (uCharOn > 0.5) {
    float cd = charDepthAt(uv);
    if (cd < 0.995 && cd <= depth + 0.0015) {
      outputColor = inputColor;
      return;
    }
  }
  // Wobble: drift the brush a pixel or two along a slow noise field.
  vec2 px = uv / texelSize;
  vec2 w = vec2(fxNoise(px * 0.035 / uStep), fxNoise(px * 0.035 / uStep + 17.0)) - 0.5;
  vec2 suv = uv + w * uWobble * uStep * texelSize;
  // Each pixel's brush is turned along a slow noise field, so the strokes run
  // at varying angles like hand-painted ones instead of stacking into
  // axis-aligned blocks (the plain square Kuwahara's tell).
  float ang = fxNoise(px * 0.012 / uStep) * 3.14159;
  mat2 rot = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  vec3 best = inputColor.rgb;
  float bestVar = 1e9;
  sector(suv, vec2(-1.0, -1.0), rot, best, bestVar);
  sector(suv, vec2(1.0, -1.0), rot, best, bestVar);
  sector(suv, vec2(-1.0, 1.0), rot, best, bestVar);
  sector(suv, vec2(1.0, 1.0), rot, best, bestVar);
  // Paper: a fine tooth plus a soft larger mottle.
  float g = (fxHash(floor(px / uStep)) - 0.5) * 0.6 + (fxNoise(px * 0.08 / uStep) - 0.5) * 0.8;
  best *= 1.0 + g * uGrain;
  outputColor = vec4(best, inputColor.a);
}
`

class PaintEffectImpl extends Effect {
  constructor({ radius = 4, grain = 0.06, wobble = 2.5 } = {}) {
    super('PaintEffect', FRAG, {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      uniforms: new Map<string, THREE.Uniform>([
        ['uRadius', new THREE.Uniform(radius)],
        ['uGrain', new THREE.Uniform(grain)],
        ['uWobble', new THREE.Uniform(wobble)],
        // Brush size is in CSS pixels: on a 2× screen each sample steps 2 texels,
        // or the strokes shrink to nothing and just blur.
        ['uStep', new THREE.Uniform(Math.min(2, window.devicePixelRatio || 1))],
        ['uCharMask', new THREE.Uniform(null)],
        ['uCharOn', new THREE.Uniform(0)],
      ]),
    })
  }

  update() {
    const t = charMask.target
    this.uniforms.get('uCharMask')!.value = t ? t.texture : null
    this.uniforms.get('uCharOn')!.value = t ? 1 : 0
  }
}

export const PaintFX = forwardRef<PaintEffectImpl, { radius?: number; grain?: number; wobble?: number }>(
  function PaintFX({ radius = 4, grain = 0.06, wobble = 2.5 }, ref) {
    const effect = useMemo(() => new PaintEffectImpl({ radius, grain, wobble }), [radius, grain, wobble])
    return <primitive ref={ref} object={effect} dispose={null} />
  },
)
