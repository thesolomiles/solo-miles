import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PROP_HIGHLIGHTS, type HighlightWorld, type PropHighlight } from '../config/highlights'
import { useGame } from '../state/store'
import { canTalk } from '../systems/interactables'
import { propHover, propPicks } from '../systems/propPick'
import {
  NPC_OUTLINE,
  SHELLS,
  hullGeometry,
  setShellStrength,
  shellMaterial,
  type ShellMat,
} from './npcOutline'

/**
 * The NPC outline, for interactable props (vending machine, signpost, arcade,
 * jerseys, desk, …). Lit while the player stands in the prop's zone or the mouse
 * is over it (systems/propPick), fading like the NPCs' outline.
 *
 * Props are baked into each world's merged mesh, so each is cut out by a box
 * (config/highlights.ts) into a "cover" mesh: a copy of those triangles sharing
 * the source mesh's own material, parented to it. While lit:
 *   1. the outline shell (all the prop's parts welded) draws, pulled toward the
 *      camera so walls/floor right behind a prop don't hide it;
 *   2. the cover redraws the prop over it, so only the outer rim of the shell is
 *      left — one clean silhouette, no lines between the prop's own parts.
 * Both are opaque, ordered after the world by renderOrder; the shell writes no
 * depth and fades by width. Always the crisp line (the glow look is NPC-only).
 * Built on the first frame, after the world models' own setup effects ran.
 */

const PULL = -1 // view units toward the camera (see shellMaterial's push)
const EDGE = 0.03 // box slack, so parts flush with the measured bounds still count

type Built = { zone: string; mats: ShellMat[]; pieces: THREE.Mesh[] }

function cropGeometry(
  src: THREE.BufferGeometry,
  rel: THREE.Matrix4,
  prop: PropHighlight,
  floorY: number,
): THREE.BufferGeometry | null {
  const pos = src.getAttribute('position')
  const index = src.getIndex()
  const triCount = (index ? index.count : pos.count) / 3
  const lo = new THREE.Vector3(...prop.min).subScalar(EDGE)
  const hi = new THREE.Vector3(...prop.max).addScalar(EDGE)
  const v = new THREE.Vector3()
  const keep: number[] = []
  for (let t = 0; t < triCount; t++) {
    let inside = true
    let topY = -Infinity
    for (let k = 0; k < 3; k++) {
      const i = index ? index.getX(t * 3 + k) : t * 3 + k
      v.fromBufferAttribute(pos, i).applyMatrix4(rel)
      if (v.x < lo.x || v.y < lo.y || v.z < lo.z || v.x > hi.x || v.y > hi.y || v.z > hi.z) {
        inside = false
        break
      }
      topY = Math.max(topY, v.y)
    }
    // Flat floor under the prop isn't part of it.
    if (inside && topY > floorY + 0.01) for (let k = 0; k < 3; k++) keep.push(index ? index.getX(t * 3 + k) : t * 3 + k)
  }
  if (!keep.length) return null
  const out = new THREE.BufferGeometry()
  for (const [name, attr] of Object.entries(src.attributes)) {
    const a = attr as THREE.BufferAttribute
    const n = a.itemSize
    const arr = new Float32Array(keep.length * n)
    keep.forEach((i, j) => {
      arr[j * n] = a.getX(i)
      if (n > 1) arr[j * n + 1] = a.getY(i)
      if (n > 2) arr[j * n + 2] = a.getZ(i)
      if (n > 3) arr[j * n + 3] = a.getW(i)
    })
    out.setAttribute(name, new THREE.BufferAttribute(arr, n))
  }
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}

const norm = (s: string) => s.replace(/[\s.:/[\]]/g, '')

function build(world: HighlightWorld, root: THREE.Object3D): Built[] {
  const cfg = PROP_HIGHLIGHTS[world]
  const crisp = SHELLS.crisp[0]
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const sources: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (
      m.isMesh &&
      !(m as THREE.InstancedMesh).isInstancedMesh &&
      !(m as THREE.SkinnedMesh).isSkinnedMesh &&
      !m.userData.npcHull
    )
      sources.push(m)
  })
  const box = new THREE.Box3()
  const propBox = new THREE.Box3()
  return cfg.props.map((prop) => {
    const mats = [shellMaterial(crisp.width, 1, crisp.hdr, { push: PULL, opaque: true })]
    const pieces: THREE.Mesh[] = []
    propBox.set(new THREE.Vector3(...prop.min), new THREE.Vector3(...prop.max)).expandByScalar(EDGE)
    for (const src of sources) {
      if (prop.mesh && norm(src.name) !== norm(prop.mesh)) continue
      const rel = inv.clone().multiply(src.matrixWorld)
      if (!src.geometry.boundingBox) src.geometry.computeBoundingBox()
      if (!box.copy(src.geometry.boundingBox!).applyMatrix4(rel).intersectsBox(propBox)) continue
      const geo = cropGeometry(src.geometry, rel, prop, cfg.floorY)
      if (!geo) continue
      const hull = hullGeometry(geo)
      mats.forEach((mat, i) => {
        const shell = new THREE.Mesh(hull, mat)
        shell.renderOrder = 5 + i
        shell.userData.npcHull = true
        shell.raycast = () => {}
        pieces.push(shell)
      })
      const cover = new THREE.Mesh(geo, src.material) // the prop's own material
      cover.renderOrder = 5 + mats.length
      cover.receiveShadow = src.receiveShadow
      cover.castShadow = false // the source already casts it
      cover.visible = false
      cover.userData.npcHull = true
      cover.userData.cover = true
      pieces.push(cover)
      src.add(...pieces.slice(pieces.length - mats.length - 1))
    }
    if (!pieces.length && import.meta.env.DEV) console.warn(`[highlights] nothing cut out for ${world}/${prop.zone}`)
    propPicks.set(
      prop.zone,
      pieces.filter((p) => p.userData.cover),
    )
    return { zone: prop.zone, mats, pieces }
  })
}

function dispose(built: Built[]) {
  for (const b of built) {
    propPicks.delete(b.zone)
    if (propHover.zone === b.zone) propHover.zone = null
    const geos = new Set<THREE.BufferGeometry>()
    for (const p of b.pieces) {
      p.removeFromParent()
      geos.add(p.geometry)
    }
    geos.forEach((g) => g.dispose())
    b.mats.forEach((m) => m.dispose())
  }
}

export function ZoneHighlights({ world, root }: { world: HighlightWorld; root: THREE.Object3D }) {
  const built = useRef<Built[] | null>(null)
  const strength = useMemo(() => new Map<string, number>(), [])

  useEffect(
    () => () => {
      if (built.current) dispose(built.current)
      built.current = null
    },
    [world, root],
  )

  useFrame(({ gl }, dt) => {
    if (!NPC_OUTLINE) return
    if (!built.current) {
      built.current = build(world, root)
    }
    const size = gl.getDrawingBufferSize(_size)
    const st = useGame.getState()
    const free = canTalk()
    for (const b of built.current) {
      const lit = free && (st.nearZone?.id === b.zone || propHover.zone === b.zone)
      const k = THREE.MathUtils.damp(strength.get(b.zone) ?? 0, lit ? 1 : 0, 14, dt)
      strength.set(b.zone, k)
      for (const m of b.mats) m.userData.res.value.copy(size)
      setShellStrength(b.mats, k)
      for (const p of b.pieces) if (p.userData.cover) p.visible = k > 0.001
    }
  })

  return null
}

const _size = new THREE.Vector2()
