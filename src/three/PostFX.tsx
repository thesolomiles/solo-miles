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
import * as THREE from 'three'
import { useLighting } from '../state/lighting'
import { IS_MOBILE } from '../systems/device'
import { DIAG_NOPOST, DIAG_NOBLOOM, DIAG_LDR } from '../systems/diag'

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
 * MOBILE: the whole composer is skipped. On-device bisecting (?d=nopost) proved
 * that iOS WebKit corrupts this scene the moment it's routed through the
 * offscreen composer target — pure-black blobs around the bright emissive spots
 * — regardless of the effects run or the buffer format (LDR didn't help, and it
 * happened with Bloom removed too). No composer = clean. The colour grade is
 * re-applied cheaply as a CSS filter on the canvas instead (see App.tsx /
 * MOBILE_CANVAS_FILTER); mobile loses only the bloom halo, AO, and vignette.
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
  // Mobile renders straight to screen — see the module comment above. `?d=nopost`
  // (and `?d=unlit`) also strip the composer, for on-device bisecting.
  if (IS_MOBILE || DIAG_NOPOST) return null
  const effects = [
    <N8AO
      key="ao"
      aoRadius={2.2}
      distanceFalloff={1}
      intensity={ao}
      quality="medium"
      halfRes
      color="#221812"
    />,
    DIAG_NOBLOOM ? null : (
      <Bloom key="bloom" intensity={bloomIntensity} luminanceThreshold={bloomThreshold} luminanceSmoothing={0.22} mipmapBlur />
    ),
    <HueSaturation key="hue" saturation={saturation} hue={0} />,
    <BrightnessContrast key="bc" brightness={brightness} contrast={contrast} />,
    <Vignette key="vig" offset={0.28} darkness={vignette} />,
    <SMAA key="smaa" />,
  ].filter(Boolean) as ReactElement[]
  return (
    <EffectComposer
      multisampling={0}
      frameBufferType={DIAG_LDR ? THREE.UnsignedByteType : THREE.HalfFloatType}
    >
      {effects}
    </EffectComposer>
  )
}
