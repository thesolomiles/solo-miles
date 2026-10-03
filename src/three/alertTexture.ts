import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * The town's "!" attention bubble — a mini dialogue box: white, hairline border,
 * red JetBrains Mono "!". Shared so café talkers match Leonard the cyclist.
 */
export function useAlertTexture() {
  return useMemo(() => {
    const WHITE = '#ffffff'
    const LINE = '#e4e4e4'
    const RED = '#e0322b'
    const FONT = '700 54px "JetBrains Mono", ui-monospace, monospace'
    const c = document.createElement('canvas')
    c.width = 224 // 2× the 112×140 layout, for crisp edges
    c.height = 280
    const x = c.getContext('2d')!
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace

    const draw = () => {
      x.setTransform(2, 0, 0, 2, 0, 0)
      x.clearRect(0, 0, 112, 140)
      // body + tail share one soft drop shadow
      x.save()
      x.shadowColor = 'rgba(43, 38, 32, 0.22)'
      x.shadowBlur = 10
      x.shadowOffsetY = 4
      x.fillStyle = LINE
      x.beginPath()
      x.roundRect(15, 11, 82, 82, 26)
      x.moveTo(43, 88)
      x.lineTo(56, 106)
      x.lineTo(69, 88)
      x.fill()
      x.restore()
      // white fill inset by the 1px hairline
      x.fillStyle = WHITE
      x.beginPath()
      x.roundRect(16, 12, 80, 80, 25)
      x.moveTo(44.5, 90)
      x.lineTo(56, 104.5)
      x.lineTo(67.5, 90)
      x.fill()
      x.fillStyle = RED
      x.font = FONT
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      x.fillText('!', 56, 54)
      t.needsUpdate = true
    }
    draw()
    // The webfont may not be ready on first mount — redraw once it is.
    document.fonts?.load(FONT).then(draw, () => {})
    return t
  }, [])
}
