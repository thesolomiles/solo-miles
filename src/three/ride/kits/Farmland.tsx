import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { MOTION, SPAN, mulberry32, roadX, curveSlope, inGrove } from '../motion'
import { RIDE } from '../../../config/ride'
import { makeRicePaddy, makeTeaPlantation, makeCrops } from '../assets'

/**
 * Farmland kit — a patchwork of tiled field plots (rice paddies, tea rows, crop
 * ridges) filling one side of the road, the way Jeju's coastal flats read far
 * truer than a solid forest. Unlike the roadside forest's random scatter, the
 * plots are laid on an ALIGNED grid: columns march out from the road edge along
 * the road normal and rows run down the road, so the fields tile edge-to-edge and
 * FOLLOW the bends (same road-tracking trick as the Beach kit). The grid scrolls
 * with MOTION.speed and recycles, and each plot yaws to the road tangent so the
 * furrows stay square to the road.
 *
 * `side` is the screen-space x sign the farmland sits on (+1 = right, −1 = left).
 */

const HW = RIDE.roadHalfWidth
const TILE = 3.7 // grid spacing (plots are ~3.2–3.4, so slim grassy bunds show between)
const COLS = 4 // columns of fields marching out from the road edge
const O_INNER = HW + 0.7 // lateral start, just past the road edge
const PLOT_Y = 0

interface Cell {
  o: number // lateral magnitude from road centre (along the road normal)
  z: number // live along-road position (scrolls, wraps)
  type: number // which plot geometry (0..2)
}

const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(1, 1, 1)
const _up = new THREE.Vector3(0, 1, 0)

export function Farmland({ side }: { side: 1 | -1 }) {
  const geoms = useMemo(() => [makeRicePaddy(), makeTeaPlantation(), makeCrops()], [])
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }),
    [],
  )
  // Lay out the grid: COLS columns × enough rows to fill the recycle band, each
  // cell assigned a stable plot type so the patchwork reads consistent as it wraps.
  const cells = useMemo(() => {
    const r = mulberry32(0xfa27 + (side > 0 ? 1 : 0))
    const rows = Math.ceil(SPAN / TILE) + 1
    const out: Cell[] = []
    for (let c = 0; c < COLS; c++) {
      const o = O_INNER + (c + 0.5) * TILE
      for (let i = 0; i < rows; i++) {
        const z0 = RIDE.spawnZ + (i / rows) * SPAN
        // Leave the tree-grove stretches open — no crops where the trees cluster.
        const type = Math.floor(r() * 3)
        if (inGrove(z0)) continue
        out.push({ o, z: z0, type })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side])
  // Group cell indices by plot type — one InstancedMesh per geometry.
  const byType = useMemo(() => {
    const g: number[][] = [[], [], []]
    cells.forEach((cell, i) => g[cell.type].push(i))
    return g
  }, [cells])
  const refs = [useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!), useRef<THREE.InstancedMesh>(null!)]

  useEffect(() => () => {
    geoms.forEach((g) => g.dispose())
    material.dispose()
  }, [geoms, material])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    // advance every cell along the road, wrapping once past the spawn line
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      cell.z -= MOTION.speed * dt
      if (cell.z < RIDE.spawnZ) cell.z += SPAN
    }
    for (let t = 0; t < 3; t++) {
      const mesh = refs[t].current
      if (!mesh) continue
      const idxs = byType[t]
      for (let k = 0; k < idxs.length; k++) {
        const cell = cells[idxs[k]]
        const z = cell.z
        const cx = roadX(z)
        const sl = curveSlope(z)
        const invL = 1 / Math.hypot(1, sl)
        const o = side * cell.o
        _p.set(cx + o * invL, PLOT_Y, z - o * sl * invL)
        _q.setFromAxisAngle(_up, Math.atan(sl)) // square the plot to the road
        _m.compose(_p, _q, _s)
        mesh.setMatrixAt(k, _m)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      {geoms.map((geo, t) => (
        <instancedMesh
          key={t}
          ref={refs[t]}
          args={[geo, material, byType[t].length]}
          receiveShadow
          castShadow
          frustumCulled={false}
        />
      ))}
    </>
  )
}
