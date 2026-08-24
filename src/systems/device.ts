/**
 * Coarse device/GPU capability flags, resolved once at load.
 *
 * `IS_MOBILE` gates a conservative render path for phones/tablets, where iOS
 * WebKit mishandles the desktop post pipeline (Bloom's mipmapBlur reading a
 * half-float HDR buffer → NaN → black blobs). We detect "mobile" from several
 * signals so it fires on iPhone Chrome/Safari and Android alike — coarse
 * pointer alone proved unreliable, so touch-point count and the UA back it up.
 */
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = !!window.matchMedia?.('(pointer: coarse)').matches
  const touch = (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window
  const ua = /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent || '')
  return coarse || touch || ua
}

export const IS_MOBILE = detectMobile()
