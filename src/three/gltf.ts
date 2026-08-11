import { useGLTF } from '@react-three/drei'
import { DRACO_PATH } from '../config/constants'

/**
 * Draco-configured glTF loading, centralised so every model in the town loads
 * the same way. Phase 0 has no real models yet — this exists now so that when
 * the art pass (Phase 3) drops in .glb files, wiring is already done:
 *
 *   const { scene } = useTownGLTF('/models/cafe.glb')
 *   useTownGLTF.preload('/models/cafe.glb')
 *
 * The decoder binaries live in /public/draco (see constants.DRACO_PATH), so the
 * whole thing works on static hosting with no CDN dependency.
 */
export function useTownGLTF(url: string) {
  return useGLTF(url, DRACO_PATH)
}

useTownGLTF.preload = (url: string) => useGLTF.preload(url, DRACO_PATH)
useTownGLTF.clear = (url: string) => useGLTF.clear(url)
