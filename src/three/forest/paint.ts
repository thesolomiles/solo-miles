import * as THREE from 'three'
import { FOREST } from '../../config/forest'

/** Perspective scenery keeps the same depth haze as the walking composition. */
export const forestPaintFog = new THREE.Uniform(new THREE.Vector2())
const FOG_SIN = Math.sin(THREE.MathUtils.degToRad(FOREST.pitchDeg)).toFixed(8)
const FOG_COS = Math.cos(THREE.MathUtils.degToRad(FOREST.pitchDeg)).toFixed(8)

/**
 * Hand-painted surfaces for the forest (Leonard's reference: a textured,
 * painterly forest, not flat colour). Each material gets brushy colour
 * variation computed in its shader from world position, so it costs no
 * textures, tiles nowhere, and works on phones (which skip the desktop
 * painterly filter, PaintFX). Kinds:
 *
 * - bark:   long vertical streaks, darker grooves, moss creeping up the base.
 * - ground: big soft blotches of lime / gold / deep green, short grassy
 *           strokes, and a scatter of tiny white flowers.
 * - stone:  mottled, with moss settling on whatever faces up (rocks, boulders,
 *           the skull's crown).
 * - leaf:   gentle light/dark mottling (ferns, boughs).
 * - bone:   muddy rain washes on stained bone, preserving authored foliage colours.
 */
export type PaintKind = 'bark' | 'ground' | 'stone' | 'leaf' | 'bone' | 'earth'

const NOISE = /* glsl */ `
varying vec3 vPaintPos;
varying vec3 vPaintNrm;
float pHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(pHash(i + vec3(0, 0, 0)), pHash(i + vec3(1, 0, 0)), f.x),
                 mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), f.x),
                 mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float pFbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * pNoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
`

const VERT_DECL = /* glsl */ `
uniform vec2 uForestPaintFog;
varying vec3 vPaintPos;
varying vec3 vPaintNrm;
`

// World position + world normal, instancing-aware.
const VERT_BODY = /* glsl */ `
  vec4 paintWp = vec4(transformed, 1.0);
  vec3 paintN = objectNormal;
  #ifdef USE_INSTANCING
    paintWp = instanceMatrix * paintWp;
    paintN = mat3(instanceMatrix) * paintN;
  #endif
  paintWp = modelMatrix * paintWp;
  vPaintPos = paintWp.xyz;
  vPaintNrm = normalize(mat3(modelMatrix) * paintN);
`

const BODY: Record<PaintKind, string> = {
  earth: /* glsl */ `
  {
    vec3 p = vPaintPos;
    float broad = pFbm(p * 0.9);
    float grain = pNoise(p * vec3(7.0, 4.0, 7.0));
    float rain = pNoise(p * vec3(9.0, 0.45, 9.0));
    float layers = sin(p.y * 11.0 + pFbm(p * 1.2) * 3.0);
    diffuseColor.rgb *= 0.78 + 0.22 * broad + 0.12 * grain + 0.08 * rain + 0.04 * layers;
  }
  `,
  bark: /* glsl */ `
  {
    vec3 p = vPaintPos;
    // Long vertical strokes: stretched noise, plus darker grooves.
    float streak = pFbm(vec3(p.x * 7.0, p.y * 0.35, p.z * 7.0));
    float groove = smoothstep(0.55, 0.75, pNoise(vec3(p.x * 16.0, p.y * 0.8, p.z * 16.0)));
    diffuseColor.rgb *= 0.7 + 0.6 * streak - 0.25 * groove;
    // Moss creeping up from the roots, patchy.
    float moss = (1.0 - smoothstep(0.2, 3.5, p.y)) * smoothstep(0.42, 0.62, pFbm(p * 0.9 + 3.1));
    diffuseColor.rgb = mix(diffuseColor.rgb, uPaintMoss, moss * 0.85);
  }
  `,
  ground: /* glsl */ `
  {
    vec3 p = vPaintPos;
    // Big soft blotches between deep green and bright lime / gold.
    float big = pFbm(vec3(p.x * 0.22, 0.0, p.z * 0.35));
    vec3 c = mix(diffuseColor.rgb * 0.62, diffuseColor.rgb * 1.18, smoothstep(0.3, 0.7, big));
    c = mix(c, uPaintWarm, smoothstep(0.62, 0.8, big) * 0.45);
    // Short grassy strokes, lying along the path.
    float blade = pNoise(vec3(p.x * 2.5, 0.0, p.z * 11.0));
    c *= 0.86 + 0.28 * blade;
    // A scatter of tiny white flowers.
    vec2 cell = floor(p.xz * 3.2);
    vec2 f = fract(p.xz * 3.2) - 0.5;
    float h = pHash(vec3(cell, 7.0));
    float flower = step(0.93, h) * (1.0 - smoothstep(0.06, 0.13, length(f - (vec2(pHash(vec3(cell, 1.0)), pHash(vec3(cell, 2.0))) - 0.5) * 0.6)));
    c = mix(c, vec3(0.93, 0.95, 0.88), flower * 0.9);
    diffuseColor.rgb = c;
  }
  `,
  stone: /* glsl */ `
  {
    vec3 p = vPaintPos;
    float mott = pFbm(p * 1.6);
    diffuseColor.rgb *= 0.78 + 0.45 * mott;
    // Moss settles on whatever faces the sky.
    float up = smoothstep(0.25, 0.75, vPaintNrm.y);
    float moss = up * smoothstep(0.35, 0.6, pFbm(p * 1.1 + 7.3));
    diffuseColor.rgb = mix(diffuseColor.rgb, uPaintMoss * (0.85 + 0.3 * mott), moss);
  }
  `,
  leaf: /* glsl */ `
  {
    float m = pFbm(vPaintPos * 1.3);
    diffuseColor.rgb *= 0.78 + 0.45 * m;
  }
  `,
  bone: /* glsl */ `
  {
    // Earth washes and rain streaks on exposed bone; foliage keeps its palette.
    float broad = pNoise(vPaintPos * 0.85);
    float grain = pNoise(vPaintPos * vec3(3.2, 1.4, 3.2));
    diffuseColor.rgb *= 0.88 + 0.18 * broad + 0.06 * grain;
    float bone = (1.0 - smoothstep(-0.01, 0.08, diffuseColor.g - diffuseColor.r))
      * smoothstep(0.12, 0.24, diffuseColor.g);
    float streak = pNoise(vPaintPos * vec3(2.1, 0.28, 2.4));
    float dirt = smoothstep(0.20, 0.67, streak) * 0.75
      + (1.0 - smoothstep(0.25, 2.8, vPaintPos.y)) * 0.25;
    diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.46, 0.32), dirt * bone);
  }
  `,
}

const MOSS = new THREE.Color('#6f9a36')
const WARM = new THREE.Color('#c9c24a')

/** Give a standard material the painted look of `kind` (mutates + returns it). */
export function paint<M extends THREE.MeshStandardMaterial>(mat: M, kind: PaintKind): M {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uForestPaintFog = forestPaintFog
    shader.uniforms.uPaintMoss = { value: MOSS }
    shader.uniforms.uPaintWarm = { value: WARM }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY)
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        #ifdef USE_FOG
          float walkingDepth = uForestPaintFog.y - vPaintPos.y * ${FOG_SIN} - vPaintPos.z * ${FOG_COS};
          vFogDepth = mix(vFogDepth, walkingDepth, uForestPaintFog.x);
        #endif`)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uPaintMoss;\nuniform vec3 uPaintWarm;\n' + NOISE,
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + BODY[kind])
  }
  // Distinct program per kind (three caches by onBeforeCompile source otherwise).
  mat.customProgramCacheKey = () => 'paint-depth-haze-' + kind
  return mat
}
