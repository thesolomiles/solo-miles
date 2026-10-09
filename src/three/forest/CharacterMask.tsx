import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Leonard is the one real thing in a painted world (Leonard's ask): the forest
 * goes through the painterly filter (PaintFX), he doesn't. Each frame, before
 * the composer renders, we draw ONLY his meshes (CHARACTER_LAYER) into a depth
 * mask with the same camera. PaintFX compares that against the scene depth: a
 * pixel where his depth matches is him, visible, and is left crisp; a trunk or
 * fern in front of him still has its own (nearer) depth, so it stays painted.
 * The dark foreground strip rides this layer too: it's cut-paper, not paint.
 * A cut-out mesh brings its own mask material (`userData.maskMaterial`, a depth
 * material with the same alphaTest), or its see-through parts would count as
 * solid and stop the paint everywhere behind them.
 * Desktop only, like PaintFX.
 */
export const CHARACTER_LAYER = 2

/** Shared with PaintFX (read in its update()). */
export const charMask: { target: THREE.WebGLRenderTarget | null } = { target: null }

export function CharacterMask() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const assets = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true })
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
    return { target, depth, size: new THREE.Vector2(), white: new THREE.Color(1, 1, 1) }
  }, [])
  useEffect(() => {
    charMask.target = assets.target
    return () => {
      charMask.target = null
      assets.target.dispose()
      assets.depth.dispose()
    }
  }, [assets])

  useFrame(({ camera }) => {
    const { target, depth, size, white } = assets
    gl.getDrawingBufferSize(size)
    if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y)

    // Swap each masked mesh to its depth material (not scene.overrideMaterial,
    // which would ignore a cut-out's alpha).
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = []
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh || !m.layers.isEnabled(CHARACTER_LAYER)) return
      swapped.push([m, m.material])
      m.material = (m.userData.maskMaterial as THREE.Material | undefined) ?? depth
    })
    const prev = {
      layers: camera.layers.mask,
      background: scene.background,
      target: gl.getRenderTarget(),
      shadows: gl.shadowMap.autoUpdate,
      clear: gl.getClearColor(new THREE.Color()),
      alpha: gl.getClearAlpha(),
    }
    camera.layers.set(CHARACTER_LAYER)
    scene.background = null
    gl.shadowMap.autoUpdate = false // the main render keeps the shadows current
    gl.setRenderTarget(target)
    gl.setClearColor(white, 1) // packed depth 1.0 = "nothing of him here"
    gl.clear(true, true, false)
    gl.render(scene, camera)

    gl.setRenderTarget(prev.target)
    gl.setClearColor(prev.clear, prev.alpha)
    gl.shadowMap.autoUpdate = prev.shadows
    scene.background = prev.background
    for (const [m, mat] of swapped) m.material = mat
    camera.layers.mask = prev.layers
  })
  return null
}
