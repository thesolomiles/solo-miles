/**
 * Temporary on-device diagnostics for the iOS "black blobs" bug. Gated behind a
 * `?d=` URL param so we can bisect which render layer is failing on a real
 * iPhone (the in-app browser can't reproduce an iOS-GPU-specific fault).
 *
 *   ?d=unlit    every mesh → MeshBasicMaterial (albedo only, no lights/shadow/post).
 *   ?d=noshadow shadows disabled, everything else normal.
 *   ?d=nopost   the whole post composer disabled.
 *   ?d=nobloom  post kept, but the Bloom pass removed (isolates Bloom).
 *   ?d=ldr      force the LDR (UnsignedByte) composer buffer regardless of device.
 *   ?d=info     overlay the live device/flag readout (IS_MOBILE, pointer, UA…).
 *
 * Remove this module (and its call sites) once the bug is pinned down.
 */
const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined

export const DIAG = params?.get('d') ?? ''
export const DIAG_UNLIT = DIAG === 'unlit'
export const DIAG_NOSHADOW = DIAG === 'noshadow' || DIAG_UNLIT
export const DIAG_NOPOST = DIAG === 'nopost' || DIAG_UNLIT
export const DIAG_NOBLOOM = DIAG === 'nobloom'
export const DIAG_LDR = DIAG === 'ldr'
export const DIAG_INFO = DIAG === 'info'
