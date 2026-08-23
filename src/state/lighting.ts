import { create } from 'zustand'

/**
 * Live-tunable lighting knobs, shared between the r3f scene and the debug panel.
 *
 * The DEFAULTS below are the real shipped values — whatever they are is exactly
 * what production renders. The `<LightingPanel>` (gated behind `?debug`, see
 * App.tsx) only lets you *find* good numbers; once you like them, bake them into
 * DEFAULTS here and they ship. The panel never appears in prod, so this store
 * simply hands its defaults to Scene/PostFX/TownModel when no one is tuning.
 */
export interface LightingState {
  // Light rig (Scene.tsx)
  sunIntensity: number
  hemisphere: number
  ambient: number
  fill: number
  shadowRadius: number
  // Post-processing (PostFX.tsx)
  bloomIntensity: number
  bloomThreshold: number
  saturation: number
  contrast: number
  brightness: number
  vignette: number
  ao: number
  // Materials (TownModel.tsx) — independent multipliers on each building's
  // window emissive glow (café and house are baked at very different strengths,
  // so a single shared knob can't balance both).
  cafeGlow: number
  houseGlow: number
}

/** The shipped look. Edit these to change what production renders. */
export const LIGHTING_DEFAULTS: LightingState = {
  sunIntensity: 4,
  hemisphere: 0.84,
  ambient: 0.06,
  fill: 1.5,
  shadowRadius: 2.4,
  bloomIntensity: 0.9,
  bloomThreshold: 0.53,
  saturation: 0.22,
  contrast: 0.12,
  brightness: -0.01,
  vignette: 0.09,
  ao: 0.75,
  cafeGlow: 1.0,
  houseGlow: 1.0,
}

interface LightingStore extends LightingState {
  set: <K extends keyof LightingState>(key: K, value: LightingState[K]) => void
  reset: () => void
}

export const useLighting = create<LightingStore>((set) => ({
  ...LIGHTING_DEFAULTS,
  set: (key, value) => set({ [key]: value } as Partial<LightingState>),
  reset: () => set({ ...LIGHTING_DEFAULTS }),
}))

/** Slider metadata for the debug panel: [key, label, min, max, step]. */
export const LIGHTING_CONTROLS: [keyof LightingState, string, number, number, number][] = [
  ['sunIntensity', 'Sun', 0, 5, 0.05],
  ['hemisphere', 'Sky fill', 0, 1.5, 0.01],
  ['ambient', 'Ambient', 0, 1, 0.01],
  ['fill', 'Cool fill', 0, 1.5, 0.01],
  ['shadowRadius', 'Shadow soft', 0, 8, 0.1],
  ['bloomIntensity', 'Bloom', 0, 2, 0.01],
  ['bloomThreshold', 'Bloom cutoff', 0, 1, 0.01],
  ['saturation', 'Saturation', -0.5, 0.8, 0.01],
  ['contrast', 'Contrast', -0.3, 0.6, 0.01],
  ['brightness', 'Brightness', -0.3, 0.3, 0.01],
  ['vignette', 'Vignette', 0, 1.5, 0.01],
  ['ao', 'Occlusion', 0, 4, 0.05],
  ['cafeGlow', 'Café glow', 0, 4, 0.05],
  ['houseGlow', 'House glow', 0, 4, 0.05],
]
