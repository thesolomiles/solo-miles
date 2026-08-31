import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Beach kit — a reusable roadside component for the ride scene: a wide sandy
 * shoulder and, beyond it, a rippling sea running to the horizon down one side of
 * the road. A "continuous" component (unlike the scrolling prop fields): the sand
 * and sea are long fixed strips spanning the visible band, and the motion comes
 * from the sea's vertex-shader ripples (the same trick as the town river) rather
 * than from Z-scrolling — a large body of water doesn't need to scroll to read as
 * alive, and a scrolling flat plane would look like a detached 2D layer.
 *
 * `side` is the screen-space x sign the beach sits on (+1 = screen-right, −1 =
 * screen-left). The caller maps the rider-relative side ("beach on the rider's
 * right") to a screen side.
 */

// Layout, as magnitudes from the road centre (sign applied by `side`).
const Z_CENTER = -12 // matches the ride Ground plane's centre
const DEPTH = 120 // z-span — covers the visible band and fades into the fog
// The ride's ortho frustum is tight — visible x is only ~±6 and the road fills
// most of it, so the roadside margin is narrow. Keep the sand a thin shoulder and
// start the sea right at the road's edge so the water actually shows on-screen.
const SAND_INNER = 3.4 // just past the road edge
const SAND_WIDTH = 1.2 // thin sandy shoulder
const SEA_INNER = 4.4 // sea right at the shoulder so it fills the roadside margin
const SEA_WIDTH = 48 // out to the frame edge / horizon
const FOAM_WIDTH = 0.8 // the wet shoreline seam

const SEA_COLOR = 0x35a8d2 // bright calm blue — kept vivid (fog off) so the warm haze doesn't gild it olive
const SAND_COLOR = 0xdcc790
const FOAM_COLOR = 0xf3eede

interface SeaShader {
  uniforms: { uTime: { value: number } }
}

/** Calm sea: a flat-shaded plane whose vertices roll on layered sines, so the
 *  little facets tilt and catch the sun as the swell passes (no reflection pass —
 *  cheap and mobile-safe, like the town water). */
function makeSeaMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: SEA_COLOR,
    roughness: 0.42,
    metalness: 0.06,
    flatShading: true,
    // Ignore the scene's warm haze so the sea stays blue to the horizon instead of
    // fading to olive; the ripples + sun still give it life.
    fog: false,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    ;(mat.userData as { shader?: SeaShader }).shader = shader as unknown as SeaShader
    // The plane is authored in XY (normal +Z); the mesh is tilted −90° about X so
    // its normal points up. Displace along the plane normal (local z), driven by
    // the in-plane coords (local x, y → world x, z).
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
           float sw = sin(transformed.x * 0.35 + uTime * 0.7) * 0.055
                    + sin(transformed.y * 0.6 - uTime * 0.55) * 0.032
                    + sin((transformed.x + transformed.y) * 0.9 + uTime * 1.0) * 0.02;
           transformed.z += sw;`,
      )
  }
  return mat
}

export function Beach({ side }: { side: 1 | -1 }) {
  const seaMat = useMemo(makeSeaMaterial, [])
  const timeRef = useRef(0)
  useEffect(() => () => seaMat.dispose(), [seaMat])
  useFrame((_, delta) => {
    timeRef.current += Math.min(delta, 0.05)
    const sh = (seaMat.userData as { shader?: SeaShader }).shader
    if (sh) sh.uniforms.uTime.value = timeRef.current
  })

  const sandX = side * (SAND_INNER + SAND_WIDTH / 2)
  const seaX = side * (SEA_INNER + SEA_WIDTH / 2)
  const foamX = side * (SEA_INNER + FOAM_WIDTH / 2 - 0.2)

  return (
    <group>
      {/* Sea (rippling). Sits just above the grass ground plane (both were at y=0
          and z-fought, hiding the water) — reduced ripple keeps troughs above it. */}
      <mesh material={seaMat} rotation={[-Math.PI / 2, 0, 0]} position={[seaX, 0.08, Z_CENTER]} receiveShadow>
        <planeGeometry args={[SEA_WIDTH, DEPTH, 44, 110]} />
      </mesh>
      {/* Sandy beach, over the water's inner edge so it reads as the dry shore. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sandX, 0.12, Z_CENTER]} receiveShadow>
        <planeGeometry args={[SAND_WIDTH, DEPTH]} />
        <meshStandardMaterial color={SAND_COLOR} roughness={1} />
      </mesh>
      {/* Foam seam at the waterline. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[foamX, 0.14, Z_CENTER]}>
        <planeGeometry args={[FOAM_WIDTH, DEPTH]} />
        <meshStandardMaterial color={FOAM_COLOR} roughness={0.8} />
      </mesh>
    </group>
  )
}
