/**
 * Temporary on-device diagnostics for the iOS "black blobs" bug. Gated behind a
 * `?d=` URL param so we can bisect which render layer is failing on a real
 * iPhone (the in-app browser can't reproduce an iOS-GPU-specific fault).
 *
 *   ?d=unlit    every mesh → MeshBasicMaterial (albedo/texture only, no lights,
 *               no shadows, no post). If the car reads RED and the buildings
 *               render clean → geometry/texture/material are fine and the fault
 *               is in the LIGHTING / SHADOW / POST pipeline.
 *   ?d=noshadow shadows disabled, everything else normal. Clean → it's shadows.
 *   ?d=nopost   post-processing disabled, everything else normal. Clean → post.
 *
 * Remove this module (and its call sites) once the bug is pinned down.
 */
const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined

export const DIAG = params?.get('d') ?? ''
export const DIAG_UNLIT = DIAG === 'unlit'
export const DIAG_NOSHADOW = DIAG === 'noshadow' || DIAG_UNLIT
export const DIAG_NOPOST = DIAG === 'nopost' || DIAG_UNLIT
