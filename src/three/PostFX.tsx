import {
  EffectComposer,
  N8AO,
  Bloom,
  HueSaturation,
  BrightnessContrast,
  Vignette,
  SMAA,
} from '@react-three/postprocessing'

/**
 * The cozy-mood postprocessing stack (Phase 2). Order matters:
 *  1. N8AO      — contact ambient occlusion grounds everything, adds depth
 *  2. Bloom     — a gentle glow on the brightest bits (windows, sky), mipmap-blurred
 *  3. Hue/Sat + Brightness/Contrast — the warm colour grade
 *  4. Vignette  — soft framing for the diorama feel
 *  5. SMAA      — antialiasing (composer runs with MSAA off)
 *
 * Tone mapping is left to the renderer's default ACES filmic pass, so we don't
 * double-tone-map here.
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO
        aoRadius={2.2}
        distanceFalloff={1}
        intensity={1.5}
        quality="medium"
        halfRes
        color="#2b2018"
      />
      <Bloom intensity={0.35} luminanceThreshold={0.85} luminanceSmoothing={0.25} mipmapBlur />
      <HueSaturation saturation={0.08} hue={0} />
      <BrightnessContrast brightness={0.015} contrast={0.07} />
      <Vignette offset={0.3} darkness={0.5} />
      <SMAA />
    </EffectComposer>
  )
}
