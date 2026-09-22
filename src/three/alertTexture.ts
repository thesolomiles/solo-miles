import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * The town's "!" attention bubble — warm paper + clay, same mark Leonard the
 * cyclist wears. Shared so café talkers match him exactly.
 */
export function useAlertTexture() {
  return useMemo(() => {
    const PAPER = '#fbf4e8'
    const CLAY = '#d98a5a'
    const CLAY_DEEP = '#b9663a'
    const c = document.createElement('canvas')
    c.width = 112
    c.height = 140
    const x = c.getContext('2d')!
    const bubble = (inset: number, r: number) => {
      x.beginPath()
      x.roundRect(16 + inset, 12 + inset, 80 - inset * 2, 84 - inset * 2, r)
      x.closePath()
    }
    x.fillStyle = CLAY
    x.beginPath()
    x.moveTo(44, 92)
    x.lineTo(56, 122)
    x.lineTo(68, 92)
    x.closePath()
    x.fill()
    x.save()
    x.shadowColor = 'rgba(43, 38, 32, 0.28)'
    x.shadowBlur = 10
    x.shadowOffsetY = 5
    x.fillStyle = CLAY_DEEP
    bubble(0, 24)
    x.fill()
    x.restore()
    x.fillStyle = PAPER
    bubble(5, 20)
    x.fill()
    x.fillStyle = CLAY_DEEP
    x.font = '800 58px "Space Grotesk", sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText('!', 56, 52)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}
