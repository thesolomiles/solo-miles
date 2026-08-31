import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { makeTarmacTexture } from './tarmac'

// The town road is UV-painted into the Blender Ground as a plain light-grey
// concrete strip, and the river crossing (the `Bridge` mesh) has a bare dark
// deck. To give the whole thing the ride scene's weathered-asphalt surface we lay
// a single continuous plane over the road's exact footprint — a straight strip
// running north–south — plus painted lane markings. The bridge deck sits on the
// same y≈0 plane as the approaches (measured off the geometry), so one flat strip
// covers the plaza approach, the bridge and the forest road in one piece.
const ROAD = {
  colors: { road: 0x45444a, dark: 0x33323a, light: 0x55545c }, // ride asphalt palette
  line: 0xe9dcbd, // painted edge lines
  dash: 0xf1e7cf, // centre-line dashes
  // Full road footprint: edge-to-edge (a touch wider than the 3.4-wide concrete so
  // no sliver shows), inside the bridge railings (x ∈ [-1.6, 2.4]).
  xMin: -1.5,
  xMax: 2.3,
  zSouth: 1.3, // plaza end
  zNorth: -28, // forest edge / map edge
  y: 0.05, // a hair above the ground/deck so it never z-fights
  tile: 2.6, // world-units per texture tile (grain scale)
} as const

const WIDTH = ROAD.xMax - ROAD.xMin
const LENGTH = ROAD.zSouth - ROAD.zNorth
const CX = (ROAD.xMin + ROAD.xMax) / 2
const CZ = (ROAD.zSouth + ROAD.zNorth) / 2

/** The asphalt surface — one continuous lit plane across the whole road. */
function Surface() {
  const tex = useMemo(() => {
    const t = makeTarmacTexture(ROAD.colors)
    t.repeat.set(WIDTH / ROAD.tile, LENGTH / ROAD.tile)
    return t
  }, [])
  const geom = useMemo(() => new THREE.PlaneGeometry(WIDTH, LENGTH), [])
  useEffect(() => () => {
    tex.dispose()
    geom.dispose()
  }, [tex, geom])
  return (
    <mesh geometry={geom} position={[CX, ROAD.y, CZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.95} />
    </mesh>
  )
}

/** A solid painted line running the length of the road at world-x `x`. */
function EdgeLine({ x }: { x: number }) {
  const geom = useMemo(() => new THREE.PlaneGeometry(0.14, LENGTH), [])
  useEffect(() => () => geom.dispose(), [geom])
  return (
    <mesh geometry={geom} position={[x, ROAD.y + 0.015, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color={ROAD.line} roughness={0.6} />
    </mesh>
  )
}

/** Centre-line dashes down the middle of the road, evenly spaced. */
function CentreDashes() {
  const DASH = 1.3
  const GAP = 1.9
  const period = DASH + GAP
  const zs = useMemo(() => {
    const out: number[] = []
    for (let z = ROAD.zSouth - GAP; z > ROAD.zNorth + DASH; z -= period) out.push(z)
    return out
  }, [])
  const geom = useMemo(() => new THREE.PlaneGeometry(0.18, DASH), [])
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: ROAD.dash, roughness: 0.6 }),
    [],
  )
  useEffect(() => () => {
    geom.dispose()
    mat.dispose()
  }, [geom, mat])
  return (
    <>
      {zs.map((z, i) => (
        <mesh
          key={i}
          geometry={geom}
          material={mat}
          position={[CX, ROAD.y + 0.015, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}
    </>
  )
}

/** The town road resurfaced with the ride scene's asphalt, lane markings and all,
 *  spanning the plaza approach, the bridge deck and the forest road as one piece. */
export function TownRoad() {
  return (
    <group>
      <Surface />
      <EdgeLine x={ROAD.xMin + 0.28} />
      <EdgeLine x={ROAD.xMax - 0.28} />
      <CentreDashes />
    </group>
  )
}
