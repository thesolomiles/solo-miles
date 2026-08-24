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
import { IS_MOBILE } from '../systems/device'

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
 *
 * MOBILE: the whole composer is skipped. On-device bisecting on iPhone proved
 * that iOS WebKit corrupts this scene the moment it's routed through the
 * offscreen composer target — pure-black blobs around the bright emissive spots
 * — no matter what: with Bloom removed, with an LDR (UnsignedByte) buffer, and
 * with multisampling all still black; only *no composer* rendered clean. So
 * mobile renders straight to screen (the renderer's own ACES tone-map + sRGB),
 * and the colour grade is re-applied cheaply as a CSS filter on the canvas
 * (see App.tsx / MOBILE_CANVAS_FILTER). Mobile loses only the bloom halo, AO,
 * and vignette. (A real glow would need dedicated glow geometry, since every
 * lit window is just emissive-masked faces on the one shared Material.004.)
 */

/** CSS-filter stand-in for the mobile colour grade (saturation + a touch of
 *  contrast), matching the HueSaturation/BrightnessContrast pass closely enough
 *  without a WebGL composer. Applied to the <Canvas> style on mobile. */
export const MOBILE_CANVAS_FILTER = 'saturate(1.2) contrast(1.05)'

export function PostFX() {
  const ao = useLighting((s) => s.ao)
  const bloomIntensity = useLighting((s) => s.bloomIntensity)
  const bloomThreshold = useLighting((s) => s.bloomThreshold)
  const saturation = useLighting((s) => s.saturation)
  const contrast = useLighting((s) => s.contrast)
  const brightness = useLighting((s) => s.brightness)
  const vignette = useLighting((s) => s.vignette)
  // Mobile renders straight to screen — the composer is unusable on iOS (see
  // the module comment above).
  if (IS_MOBILE) return null
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
