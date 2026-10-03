import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * "You can talk to me" highlight for NPCs — an inverted-hull outline that fades
 * in with the "!" bubble. Crisp white line by default (Leonard's pick,
 * 2026-10-03); `?outline=glow` shows the soft alternative, `?outline=off` none.
 *
 * Each mesh of the NPC gets a back-face shell pushed out a fixed number of
 * SCREEN pixels along smoothed normals (so the line is the same weight at any
 * zoom and doesn't split at low-poly hard edges). Skinned meshes get a skinned
 * shell bound to the same skeleton, so it bends with the pose. The shell is also
 * nudged back in depth so it doesn't draw lines over the NPC's own body (an arm
 * in front of the torso) — only the outer silhouette shows. No post pass, so it
 * works on mobile too.
 */

export type OutlineStyle = 'crisp' | 'glow'

export function outlineStyleFromUrl(): OutlineStyle | null {
  const v = new URLSearchParams(window.location.search).get('outline')
  return v === 'off' ? null : v === 'glow' ? 'glow' : 'crisp'
}

export const NPC_OUTLINE = outlineStyleFromUrl()

// width = px out from the silhouette, opacity at full strength, hdr = colour
// multiplier (>1 lets the desktop Bloom pass soften it; mobile just sees white).
export const SHELLS: Record<OutlineStyle, { width: number; opacity: number; hdr: number }[]> = {
  crisp: [{ width: 2.5, opacity: 1, hdr: 1 }],
  glow: [
    { width: 11, opacity: 0.14, hdr: 1.6 },
    { width: 6.5, opacity: 0.32, hdr: 1.8 },
    { width: 3, opacity: 0.9, hdr: 2.2 },
  ],
}
const COLOR = '#ffffff'
const DEPTH_PUSH = 0.18 // view-space units the shell sits behind the mesh

export type ShellMat = THREE.MeshBasicMaterial & {
  userData: { base: number; res: { value: THREE.Vector2 }; width: { value: number }; px: number }
}

/**
 * `push` = view-space units the shell sits behind the mesh (negative = toward
 * the camera; props use that, see ZoneHighlights). `opaque` shells draw in the
 * opaque pass and fade by width instead of opacity (props, so the redrawn prop
 * can land on top of them).
 */
export function shellMaterial(
  width: number,
  opacity: number,
  hdr: number,
  { push = DEPTH_PUSH, opaque = false }: { push?: number; opaque?: boolean } = {},
): ShellMat {
  const m = new THREE.MeshBasicMaterial({
    color: new THREE.Color(COLOR).multiplyScalar(hdr),
    side: THREE.BackSide,
    transparent: !opaque,
    opacity: opaque ? 1 : 0,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }) as ShellMat
  const res = { value: new THREE.Vector2(1, 1) }
  const w = { value: opaque ? 0 : width }
  m.userData = { base: opaque ? -1 : opacity, res, width: w, px: width }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWidth = w
    shader.uniforms.uPush = { value: push }
    shader.uniforms.uRes = res
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float uWidth;\nuniform float uPush;\nuniform vec2 uRes;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 hullN = normal;')
      .replace(
        '#include <skinning_vertex>',
        // skinnormal_vertex has already posed objectNormal for skinned meshes
        '#include <skinning_vertex>\n#ifdef USE_SKINNING\nhullN = objectNormal;\n#endif',
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
        mvPosition.z -= uPush;
        gl_Position = projectionMatrix * mvPosition;
        vec2 hullD = ( projectionMatrix * vec4( normalize( normalMatrix * hullN ), 0.0 ) ).xy;
        float hullL = length( hullD );
        if ( hullL > 1e-5 ) gl_Position.xy += ( hullD / hullL ) * uWidth * 2.0 / uRes * gl_Position.w;`,
      )
  }
  m.customProgramCacheKey = () => 'npc-hull'
  return m
}

/** Position (+ skin) only, welded so the normals are smooth across hard edges. */
export function hullGeometry(src: THREE.BufferGeometry) {
  const g = src.clone()
  const keep = new Set(['position', 'skinIndex', 'skinWeight'])
  for (const name of Object.keys(g.attributes)) if (!keep.has(name)) g.deleteAttribute(name)
  g.morphAttributes = {}
  const merged = mergeVertices(g)
  merged.computeVertexNormals()
  g.dispose()
  return merged
}

/**
 * Adds outline shells to every mesh under `model` (null style → nothing).
 * Returns setStrength(0..1) — call it each frame with the talk-range fade.
 */
export function useNpcOutline(model: THREE.Object3D, style: OutlineStyle | null) {
  const mats = useMemo(() => (style ? SHELLS[style].map((s) => shellMaterial(s.width, s.opacity, s.hdr)) : []), [style])

  useEffect(() => {
    if (!mats.length) return
    const added: THREE.Mesh[] = []
    const sources: THREE.Mesh[] = []
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData.npcHull) sources.push(o as THREE.Mesh)
    })
    for (const src of sources) {
      const geo = hullGeometry(src.geometry)
      mats.forEach((mat, i) => {
        let hull: THREE.Mesh
        if ((src as THREE.SkinnedMesh).isSkinnedMesh) {
          const s = src as THREE.SkinnedMesh
          const sk = new THREE.SkinnedMesh(geo, mat)
          sk.bind(s.skeleton, s.bindMatrix)
          hull = sk
        } else {
          hull = new THREE.Mesh(geo, mat)
        }
        hull.userData.npcHull = true
        hull.raycast = () => {} // hover picks the NPC itself; skip the shells
        hull.renderOrder = 3 + i // widest first, so the bright core lands on top
        hull.frustumCulled = false
        src.add(hull)
        added.push(hull)
      })
    }
    return () => {
      const geos = new Set(added.map((h) => h.geometry))
      added.forEach((h) => h.removeFromParent())
      geos.forEach((g) => g.dispose())
    }
  }, [model, mats])

  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])

  useShellResolution(mats)

  return useMemo(() => (k: number) => setShellStrength(mats, k), [mats])
}

/** Fade a set of shell materials (0 hides them). */
export function setShellStrength(mats: ShellMat[], k: number) {
  for (const m of mats) {
    if (m.userData.base < 0) m.userData.width.value = m.userData.px * k // opaque: fade by width
    else m.opacity = m.userData.base * k
    m.visible = k > 0.001
  }
}

/** Keep the shells' screen-pixel width right as the canvas resizes. */
export function useShellResolution(mats: ShellMat[]) {
  const size = useMemo(() => new THREE.Vector2(), [])
  useFrame(({ gl }) => {
    if (!mats.length) return
    gl.getDrawingBufferSize(size)
    for (const m of mats) m.userData.res.value.copy(size)
  })
}
