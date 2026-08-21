import {
  EffectComposer,
  N8AO,
  Bloom,
  HueSaturation,
  BrightnessContrast,
  Vignette,
  SMAA,
} from '@react-three/postprocessing'
import { useLighting } from '../state/lighting'

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
  const ao = useLighting((s) => s.ao)
  const bloomIntensity = useLighting((s) => s.bloomIntensity)
  const bloomThreshold = useLighting((s) => s.bloomThreshold)
  const saturation = useLighting((s) => s.saturation)
  const contrast = useLighting((s) => s.contrast)
  const brightness = useLighting((s) => s.brightness)
  const vignette = useLighting((s) => s.vignette)
  return (
    <EffectComposer multisampling={0}>
      <N8AO
        aoRadius={2.2}
        distanceFalloff={1}
        intensity={ao}
        quality="medium"
        halfRes
        color="#221812"
      />
      <Bloom intensity={bloomIntensity} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.22} mipmapBlur />
      <HueSaturation saturation={saturation} hue={0} />
      <BrightnessContrast brightness={brightness} contrast={contrast} />
      <Vignette offset={0.28} darkness={vignette} />
      <SMAA />
    </EffectComposer>
  )
}
