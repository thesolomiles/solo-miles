import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FOREST_STONES as S } from '../../config/forestStones'
import { forestSceneryHalf, inForestClearing } from '../../config/forestEncounter'
import { forestFrame, forestView } from '../../systems/forestView'
import { useTownGLTF } from '../gltf'
import { hash3 } from './forestAssets'
import { paint } from './paint'

const CAPACITY = Math.ceil(2 * (S.maxHalf + S.margin) / S.every) + 4

/** Reuse meshes at bounded cost; slot hashes keep each stone fixed on return. */
export function ForestStones() {
  const { scene } = useTownGLTF('/models/forest-stones.glb')
  const size = useThree((state) => state.size)
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const range = useRef('')
  const transform = useMemo(() => new THREE.Object3D(), [])
  const assets = useMemo(() => {
    const materials = new Map<THREE.MeshStandardMaterial, THREE.MeshStandardMaterial>()
    const variants = S.variants.map((name) => {
      const mesh = scene.getObjectByName(name)
      if (!(mesh instanceof THREE.Mesh) || Array.isArray(mesh.material)) {
        throw new Error(`Missing single-material forest stone: ${name}`)
      }
      const source = mesh.material as THREE.MeshStandardMaterial
      let material = materials.get(source)
      if (!material) {
        material = paint(source.clone(), 'stone')
        material.flatShading = true
        material.roughness = 0.96
        materials.set(source, material)
      }
      return { geometry: mesh.geometry, material }
    })
    return { variants, materials }
  }, [scene])

  useEffect(() => {
    // Own the instance buffers and painted material; retain cached GLB geometry.
    const instances = refs.current.slice()
    return () => {
      for (const mesh of instances) mesh?.dispose()
      for (const material of assets.materials.values()) material.dispose()
    }
  }, [assets])

  useFrame(() => {
    const camX = forestView.camX
    const walkingHalf = forestFrame(size.width / Math.max(size.height, 1)).halfX
    const half = Math.min(S.maxHalf, forestSceneryHalf(camX, walkingHalf)) + S.margin
    const lo = Math.floor((camX - half) / S.every) - 1
    const hi = Math.ceil((camX + half) / S.every) + 1
    const key = `${lo}|${hi}`
    if (range.current === key) return
    range.current = key
    const counts = S.variants.map(() => 0)
    for (let i = lo; i <= hi; i++) {
      const r = (salt: number) => hash3(i, 739, salt)
      if (r(0) > S.fill) continue
      const x = (i + 0.18 + r(1) * 0.64) * S.every
      const z = THREE.MathUtils.lerp(S.depth[0], S.depth[1], r(2))
      const scale = THREE.MathUtils.lerp(S.scale[0], S.scale[1], r(3))
      // Include the footprint, keeping loose fragments out of the clearing.
      if ([-2, 0, 2].some((dx) => [-1.2, 0, 1.2].some((dz) =>
        inForestClearing(x + dx * scale, z + dz * scale)))) continue
      const variant = Math.floor(r(4) * S.variants.length)
      const mesh = refs.current[variant]
      if (!mesh || counts[variant] >= CAPACITY) continue
      transform.position.set(x, -0.035, z)
      // Face the walk with an irregular turn; every aperture remains real geometry.
      transform.rotation.set(0, (r(5) - 0.5) * 0.9, 0)
      transform.scale.set(scale * (0.9 + r(6) * 0.2), scale * (0.9 + r(7) * 0.2), scale)
      transform.updateMatrix()
      mesh.setMatrixAt(counts[variant]++, transform.matrix)
    }
    refs.current.forEach((mesh, v) => {
      if (!mesh) return
      mesh.count = counts[v]
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    })
  })

  return (
    <group dispose={null}>
      {assets.variants.map((asset, v) => (
        <instancedMesh
          key={S.variants[v]}
          ref={(mesh) => { refs.current[v] = mesh }}
          args={[asset.geometry, asset.material, CAPACITY]}
          count={0}
          castShadow
          receiveShadow
          frustumCulled={false}
        />
      ))}
    </group>
  )
}
