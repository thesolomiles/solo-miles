import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { SOUTH_TRAIL } from '../config/forest'

/**
 * The south trail's surface: a dirt footpath down SOUTH_TRAIL.line, from the
 * meadow behind the café into the trees (which systems/southTrail.ts clears off
 * it). Built pixel-style: square tiles on a world-aligned grid, so the edges
 * step like a sprite's. It's a secret path, so it's half grown over: mossy
 * green-brown tiles with grass tiles and gaps through the middle, a dithered
 * fringe at the edges and at the meadow end (fading in), only a little bare dirt.
 */
const Y = 0.035 // just above the ground, under the road's 0.05
const CELL = 0.25 // tile size (u) — the trail's "pixel"
const CORE = 0.5 // fraction of the half-width that's densest; the rest dithers out
const FILL = 0.85 // tile chance even in the core — the gaps are grass showing through
// Tile mix: grown-over grass, mossy dirt (most), bare dirt.
const GRASS = '#55762c'
const DIRT = '#7a6a47'

function hash(x: number, z: number, salt: number) {
  const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453
  return h - Math.floor(h)
}

export function TownTrail() {
  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      SOUTH_TRAIL.line.map(([x, z]) => new THREE.Vector3(x, Y, z)),
      false,
      'centripetal',
    )
    const length = curve.getLength()
    // Dense polyline with distance-along for nearest-point lookups.
    const pts = curve.getSpacedPoints(Math.ceil(length / 0.1))
    const along = pts.map((_, i) => (i / (pts.length - 1)) * length)
    const half = SOUTH_TRAIL.width / 2

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const p of pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
    }
    const i0 = Math.floor((minX - half) / CELL), i1 = Math.ceil((maxX + half) / CELL)
    const j0 = Math.floor((minZ - half) / CELL), j1 = Math.ceil((maxZ + half) / CELL)

    const moss = new THREE.Color(SOUTH_TRAIL.color)
    const grass = new THREE.Color(GRASS)
    const dirt = new THREE.Color(DIRT)
    const pos: number[] = []
    const col: number[] = []
    const idx: number[] = []
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const cx = (i + 0.5) * CELL
        const cz = (j + 0.5) * CELL
        // Nearest point on the polyline (distance + how far along).
        let best = Infinity, s = 0
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k + 1]
          const abx = b.x - a.x, abz = b.z - a.z
          const t = THREE.MathUtils.clamp(((cx - a.x) * abx + (cz - a.z) * abz) / (abx * abx + abz * abz), 0, 1)
          const d = Math.hypot(cx - (a.x + abx * t), cz - (a.z + abz * t))
          if (d < best) { best = d; s = along[k] + (along[k + 1] - along[k]) * t }
        }
        // Edges wander a little along the trail.
        const w = half * (0.85 + 0.3 * hash(Math.round(s * 2), 0, 1))
        if (best > w) continue
        const edge = 1 - THREE.MathUtils.smoothstep(best, w * CORE, w)
        const keep = FILL * edge * THREE.MathUtils.smoothstep(s, 0, SOUTH_TRAIL.fadeIn)
        if (hash(i, j, 2) > keep) continue
        // Grass takes over toward the edges; bare dirt only in the middle.
        const r = hash(i, j, 3)
        const c = r < 0.25 + 0.35 * (1 - edge) ? grass : r > 0.88 && edge > 0.8 ? dirt : moss
        const v = pos.length / 3
        const x0 = i * CELL, x1 = x0 + CELL, z0 = j * CELL, z1 = z0 + CELL
        pos.push(x0, Y, z0, x1, Y, z0, x1, Y, z1, x0, Y, z1)
        for (let q = 0; q < 4; q++) col.push(c.r, c.g, c.b)
        idx.push(v, v + 2, v + 1, v, v + 3, v + 2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(idx)
    // Flat ground: every normal points straight up.
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3))
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    [],
  )
  useEffect(
    () => () => {
      geom.dispose()
      mat.dispose()
    },
    [geom, mat],
  )
  return <mesh geometry={geom} material={mat} receiveShadow />
}
