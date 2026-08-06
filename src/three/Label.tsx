import { useMemo, useEffect } from 'react'
import * as THREE from 'three'

/**
 * A floating name tag rendered as a canvas-texture sprite (always faces the
 * camera, drawn on top). Greybox navigation aid, carried over from the
 * prototype; likely retired or restyled in the art pass.
 */
export function Label({
  text,
  position,
  width = 3.4,
}: {
  text: string
  position: [number, number, number]
  width?: number
}) {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 72
    const x = c.getContext('2d')!
    x.font = '600 32px "Space Grotesk", sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillStyle = 'rgba(43,38,32,.30)'
    x.fillText(text, 128, 41)
    x.fillStyle = '#fbf4e8'
    x.fillText(text, 128, 38)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [text])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <sprite position={position} scale={[width, width * 0.28, 1]} renderOrder={3}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  )
}
