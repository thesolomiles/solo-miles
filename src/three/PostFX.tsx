import {
  EffectComposer,
  N8AO,
  Bloom,
  HueSaturation,
  BrightnessContrast,
  Vignette,
  SMAA,
} from '@react-three/postprocessing'
import type { ReactElement } from 'react'
import { useLighting } from '../state/lighting'
import { IS_MOBILE } from '../systems/device'
import { DIAG_NOPOST } from '../systems/diag'

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
  // `?d=nopost` (and `?d=unlit`) strip the whole composer for on-device bisecting.
  if (DIAG_NOPOST) return null
  // N8AO's half-res depth pass renders enclosed geometry as black blobs on iOS
  // Safari GPUs, so it's skipped on mobile — shadows still ground the scene.
  // Desktop keeps the full occlusion grade. See systems/device.ts. Built as a
  // filtered array because EffectComposer's children type rejects `false`.
  const effects = [
    IS_MOBILE ? null : (
      <N8AO
        key="ao"
        aoRadius={2.2}
        distanceFalloff={1}
        intensity={ao}
        quality="medium"
        halfRes
        color="#221812"
      />
    ),
    <Bloom key="bloom" intensity={bloomIntensity} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.22} mipmapBlur />,
    <HueSaturation key="hue" saturation={saturation} hue={0} />,
    <BrightnessContrast key="bc" brightness={brightness} contrast={contrast} />,
    <Vignette key="vig" offset={0.28} darkness={vignette} />,
    <SMAA key="smaa" />,
  ].filter(Boolean) as ReactElement[]
  return <EffectComposer multisampling={0}>{effects}</EffectComposer>
}
