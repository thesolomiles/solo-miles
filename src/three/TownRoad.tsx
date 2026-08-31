import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { makeTarmacTexture } from './tarmac'

// The town's road is UV-painted into the Blender Ground mesh as a plain light-grey
// concrete strip. To give it the ride scene's weathered-asphalt surface, we lay a
// thin textured plane over the exact road footprint (measured off the Ground
// geometry): a straight strip at x∈[-1.3, 2.1] running north–south, split by the
// river — the bridge carries it across the gap. Two flat segments, lit so the
// building/tree shadows fall across them just like the concrete underneath.
const ROAD = {
  colors: { road: 0x45444a, dark: 0x33323a, light: 0x55545c }, // ride asphalt palette
  xMin: -1.3,
  xMax: 2.1,
  y: 0.05, // a hair above the ground so it never z-fights the concrete
  tile: 2.6, // world-units per texture tile (grain scale)
  // North bank → forest edge, and south bank → plaza. The river/bridge sits in
  // the [-15, -5] gap and is left untouched.
  segments: [
    { z0: -28, z1: -15 },
    { z0: -5, z1: 1 },
  ],
} as const

/** One flat asphalt slab over a stretch of the town road. */
function RoadSlab({ z0, z1 }: { z0: number; z1: number }) {
  const width = ROAD.xMax - ROAD.xMin
  const length = z1 - z0
  const cx = (ROAD.xMin + ROAD.xMax) / 2
  const cz = (z0 + z1) / 2

  const tex = useMemo(() => {
    const t = makeTarmacTexture(ROAD.colors)
    t.repeat.set(width / ROAD.tile, length / ROAD.tile)
    return t
  }, [width, length])
  const geom = useMemo(() => new THREE.PlaneGeometry(width, length), [width, length])
  useEffect(() => () => {
    tex.dispose()
    geom.dispose()
  }, [tex, geom])

  return (
    <mesh
      geometry={geom}
      position={[cx, ROAD.y, cz]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  )
}

/** The town road resurfaced with the ride scene's asphalt texture. */
export function TownRoad() {
  return (
    <group>
      {ROAD.segments.map((s, i) => (
        <RoadSlab key={i} z0={s.z0} z1={s.z1} />
      ))}
    </group>
  )
}
