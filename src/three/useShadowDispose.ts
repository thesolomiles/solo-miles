import { useEffect, type RefObject } from 'react'
import type * as THREE from 'three'

/**
 * Free a shadow-casting light's shadow map when the light unmounts.
 *
 * Neither three nor r3f does this for us: removing a light drops it from the
 * scene graph, but its `shadow.map` (and, under VSM, the blur pass target) are
 * renderer-owned textures that stay allocated. Our worlds swap constantly —
 * town ↔ café ↔ Pac-Man — and each swap mounts a fresh shadow-casting sun, so
 * without this every round trip stranded another 2048² (town) or 1024²
 * (arcade) shadow target on the GPU and the session got heavier the longer you
 * played.
 */
export function useShadowDispose(ref: RefObject<THREE.Light & { shadow?: THREE.LightShadow }>) {
  useEffect(() => {
    const light = ref.current
    return () => {
      light?.shadow?.dispose()
    }
  }, [ref])
}
