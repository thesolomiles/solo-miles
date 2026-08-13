import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { colliders } from '../systems/colliders'

/**
 * Debug overlay: draws every active collider as a translucent slab at knee
 * height, plus a ring at the roam boundary, so you can see exactly what blocks
 * the player against the town it sits on. Off by default; enable with `?debug`
 * in the URL. Cheap to keep around and invaluable for tuning footprints.
 */
export function ColliderDebug({ boundary }: { boundary: number }) {
  // The registry fills in asynchronously once the model loads; poll its length
  // and re-render when boxes arrive so late building/tree colliders show up.
  const [, setCount] = useState(colliders.length)
  useEffect(() => {
    const id = setInterval(() => setCount(colliders.length), 200)
    return () => clearInterval(id)
  }, [])

  // Square roam edge — outline at ±boundary, matching the clamp in collision.ts.
  const edge = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(boundary * 2, 1.6, boundary * 2)), [boundary])

  return (
    <group>
      {/* The roam edge — the world's hard wall. */}
      <lineSegments geometry={edge} position={[0, 0.8, 0]}>
        <lineBasicMaterial color={0x00a3ff} />
      </lineSegments>
      {colliders.map((c, i) => {
        if ('minX' in c) {
          const w = c.maxX - c.minX
          const d = c.maxZ - c.minZ
          return (
            <mesh key={i} position={[(c.minX + c.maxX) / 2, 0.8, (c.minZ + c.maxZ) / 2]}>
              <boxGeometry args={[w, 1.6, d]} />
              <meshBasicMaterial color={0xff3b30} transparent opacity={0.3} depthWrite={false} />
            </mesh>
          )
        }
        return (
          <mesh key={i} position={[c.x, 0.8, c.z]}>
            <cylinderGeometry args={[c.r, c.r, 1.6, 16]} />
            <meshBasicMaterial color={0xffcc00} transparent opacity={0.3} depthWrite={false} />
          </mesh>
        )
      })}
    </group>
  )
}
