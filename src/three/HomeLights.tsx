import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { IS_MOBILE } from '../systems/device'

type V3 = [number, number, number]

// Positions are three-space, matched to the fixtures modelled in home.blend
// (Blender (bx, by, bz) → three (bx, bz, −by)). The glow you SEE comes from the
// fixtures' emissive swatches; these lights are what they throw onto the room.

/** Wall sconces (up/down wash) — two flanking the sofa, two by the dining table. */
const SCONCES: V3[] = [
  [-6.6, 1.9, 1.3],
  [-6.6, 1.9, 4.7],
  [6.6, 1.9, -2.8],
  [6.6, 1.9, 0.4],
]

/** Recessed downlights: [x, z] floor spots each pool of light lands on. */
const DOWNLIGHTS: [number, number][] = [
  [-4.6, 4.2], // lounge (L-sofa + coffee table)
  [-3.2, -4.3], // Zwift corner
  [-0.25, -5.0], // work desk
  [0.8, 2.2], // entry / middle of the room
]
/** On phones only the two that matter most (each light costs every pixel). */
const DOWNLIGHTS_MOBILE = DOWNLIGHTS.slice(0, 2)

/** Picture lights over the two framed jerseys (x). */
const PICTURE_X = [2.375, 3.575]

/** Daylight through the south glass wall (three x −7.2…0.4, z 7.1): cool sky
 *  spots from just outside, aimed in and down across the lounge. */
const DAYLIGHT: [number, number][] = [
  [-5.2, 3.8],
  [-1.6, 3.6],
]
const DAYLIGHT_MOBILE = DAYLIGHT.slice(0, 1)
const SKY = '#e4f1ff'

const WARM = '#ffc07a'

/** A spot aimed at a fixed point (r3f spot targets need a real Object3D).
 *  Shared with CafeLights. */
export function Spot({
  from,
  to,
  angle,
  intensity,
  distance,
  color = WARM,
  penumbra = 1,
}: {
  from: V3
  to: V3
  angle: number
  intensity: number
  distance: number
  color?: string
  penumbra?: number
}) {
  const light = useRef<THREE.SpotLight>(null!)
  useLayoutEffect(() => {
    light.current.target.position.set(...to)
    light.current.target.updateMatrixWorld()
  }, [to])
  return (
    <spotLight
      ref={light}
      position={from}
      angle={angle}
      penumbra={penumbra}
      intensity={intensity}
      distance={distance}
      decay={2}
      color={color}
    />
  )
}

/**
 * Layered lighting for the home interior, so it reads as a lived-in room at
 * dusk rather than a flatly-lit box:
 *  1. base — a low ambient/hemisphere, a broad overhead main light, and a soft
 *     low sun from the south, in through the glass wall (the only shadow
 *     caster), plus cool sky spots spilling through the glass;
 *  2. recessed downlights — soft pools on the floor (lounge, Zwift corner,
 *     under the jerseys, the entry);
 *  3. wall sconces — warm up/down washes on the side walls;
 *  4. accents — picture lights on the jerseys, the dining pendant, the floor
 *     lamp, the TV's cool glow, the stair step LEDs and the shelf strips.
 */
export function HomeLights() {
  const downlights = IS_MOBILE ? DOWNLIGHTS_MOBILE : DOWNLIGHTS
  const daylight = IS_MOBILE ? DAYLIGHT_MOBILE : DAYLIGHT
  return (
    <>
      {/* 1 · base */}
      <ambientLight intensity={0.3} color={'#ffe4c8'} />
      <hemisphereLight args={[0xffeacc, 0x5a4330, 0.35]} />
      {/* The main light: a broad, high ceiling source over the middle of the
          room that lifts everything evenly, so the downlight pools read as
          accents on a lit floor instead of isolated spots in the dark. */}
      <pointLight position={[0, 9, 0]} color={'#ffe8d0'} intensity={110} distance={30} decay={2} />
      {/* The sun: low from the south-west, in through the glass wall, so the
          window's black frame throws long bars across the lounge floor. */}
      <directionalLight
        position={[-6, 9, 14]}
        intensity={0.85}
        color={0xfff1dc}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={11}
        shadow-camera-bottom={-11}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      {/* Sky light spilling in through the south glass. */}
      {daylight.map(([x, z], i) => (
        <Spot key={i} from={[x, 2.8, 8.4]} to={[x, 0, z]} angle={0.9} intensity={11} distance={11} color={SKY} />
      ))}

      {/* 2 · recessed downlights */}
      {downlights.map(([x, z], i) => (
        <Spot key={i} from={[x, 3.6, z]} to={[x, 0, z]} angle={0.75} intensity={16} distance={7} />
      ))}

      {/* 3 · wall sconces */}
      {SCONCES.map((p, i) => (
        <pointLight key={i} position={p} color={WARM} intensity={6} distance={5} decay={2} />
      ))}

      {/* 4 · accents */}
      <pointLight position={[3.8, 1.35, -1.2]} color={'#ffc27a'} intensity={3.5} distance={5} decay={2} />
      <pointLight position={[-6.55, 1.45, 2.95]} color={WARM} intensity={3} distance={4} decay={2} />
      {/* Work desk: the warm LED strips under its shelves. */}
      <pointLight position={[-0.25, 2.0, -6.5]} color={'#ffb36a'} intensity={3} distance={3.5} decay={2} />
      {!IS_MOBILE && (
        <>
          {PICTURE_X.map((x, i) => (
            <Spot
              key={i}
              from={[x, 2.6, -6.75]}
              to={[x, 1.7, -7]}
              angle={0.7}
              intensity={6}
              distance={3}
              color={'#fff0d8'}
            />
          ))}
          <pointLight position={[-3.2, 1.7, -6.5]} color={'#9fd0ff'} intensity={3} distance={4} decay={2} />
          <pointLight position={[-6.1, 1.2, -4.3]} color={WARM} intensity={2} distance={4} decay={2} />
          <pointLight position={[5.95, 1.3, -6.0]} color={WARM} intensity={1} distance={2.5} decay={2} />
          {/* Desk monitors' cool spill + the speaker's orange glow. */}
          <pointLight position={[-0.25, 1.2, -6.3]} color={'#bfe6c8'} intensity={1.5} distance={2.5} decay={2} />
          <pointLight position={[0.82, 0.95, -6.4]} color={'#ff7a1a'} intensity={1.2} distance={1.8} decay={2} />
        </>
      )}
    </>
  )
}
