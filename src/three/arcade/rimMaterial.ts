import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Add a fresnel rim to a MeshStandardMaterial: faces turned away from the
 * camera glow `color` (strongest at grazing angles). It's emissive, so it shows
 * in the dark regardless of the lights — Ninja Run uses it to keep hazards
 * readable while the rest of the grove (and the runner) stay silhouettes.
 */
export function withRim<M extends THREE.MeshStandardMaterial>(
  material: M,
  color: THREE.ColorRepresentation,
  strength: number,
  power: number,
): M {
  const rimColor = new THREE.Color(color)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: rimColor }
    shader.uniforms.rimStrength = { value: strength }
    shader.uniforms.rimPower = { value: power }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;\nvoid main() {',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 rimView = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
        float rim = pow(1.0 - saturate(dot(normal, rimView)), rimPower);
        totalEmissiveRadiance += rimColor * rim * rimStrength;`,
      )
  }
  material.customProgramCacheKey = () => `rim:${rimColor.getHexString()}:${strength}:${power}`
  return material
}

const hullCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>()

/**
 * A smooth-normal copy of `geometry` for an outline shell. Flat-shaded parts
 * have split normals, so pushing their vertices out would tear the shell apart
 * at every edge; welding them first gives one continuous normal per corner.
 */
export function hullGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  let hull = hullCache.get(geometry)
  if (!hull) {
    const g = geometry.clone()
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name)
    hull = mergeVertices(g)
    hull.computeVertexNormals()
    hullCache.set(geometry, hull)
  }
  return hull
}

/**
 * Outline material: drawn on the back faces of a `hullGeometry` shell pushed out
 * `width` along its normals, so only a rim of it shows around the object's
 * silhouette — a clean pale edge all the way round, whatever it faces.
 */
export function outlineMaterial(color: THREE.ColorRepresentation, width: number) {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.hullWidth = { value: width }
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'uniform float hullWidth;\nvoid main() {')
      .replace('#include <begin_vertex>', 'vec3 transformed = position + normal * hullWidth;')
  }
  m.customProgramCacheKey = () => `hull:${width}`
  return m
}
