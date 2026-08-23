/**
 * Coarse device/GPU capability flags, resolved once at load.
 *
 * `IS_MOBILE` gates a more conservative render path for phones/tablets. Two of
 * the desktop effects render as large **pure-black blobs** on iOS Safari GPUs:
 *  - `THREE.VSMShadowMap` — its shadow map is a half-float target that iOS
 *    filters unreliably; the VSM blur then smears the failure into soft black
 *    clouds over anything in shadow (the garage interior, the parked car, …).
 *  - `N8AO` with `halfRes` — the half-resolution depth reconstruction misfires
 *    on mobile GPUs and paints enclosed geometry black.
 * On mobile we fall back to `PCFSoftShadowMap` and skip the SSAO pass. The
 * desktop look (tuned in the ?debug panel) is unchanged.
 *
 * Coarse pointer is the reliable signal for "phone/tablet browser" — it's what
 * iOS Safari and Android Chrome match, and what the touch HUD already keys off.
 */
export const IS_MOBILE =
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
