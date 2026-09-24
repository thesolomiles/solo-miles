import { IS_MOBILE } from '../systems/device'
import { Spot } from './HomeLights'

type V3 = [number, number, number]

// Positions are three-space, matched to the fixtures modelled in cafe.blend
// (Blender (bx, by, bz) → three (bx, bz − CAFE.floorDrop, −by)). The glow you
// SEE comes from the fixtures' emissive swatches; these lights are what they
// throw onto the room.

/** Windows, nudged just inside each pane. Kept high and tight to the wall:
 *  the white marble 2-tops sit right under the south panes and blow out if a
 *  light hangs just above them. */
const WINDOWS: V3[] = [
  [-6.8, 2.9, -4.0], // left · north
  [-6.8, 2.9, 1.5], // left · south
  [6.8, 2.9, -4.0], // right · north
  [6.8, 2.9, 1.5], // right · south
]

/** Recessed downlights: [x, z] of each table they pool onto — the two centre
 *  4-tops first (they matter most on phones), then the four wall 2-tops. */
const TABLES: [number, number][] = [
  [-2.8, 1.5],
  [2.8, 1.5],
  [-6.35, -1.5],
  [-6.35, 1.5],
  [6.35, -1.5],
  [6.35, 1.5],
]
const TABLES_MOBILE = TABLES.slice(0, 2)

/** The three black pendants over the service counter (Blender Pendant_6..8),
 *  just under each bulb. */
const PENDANTS: V3[] = [
  [-3.6, 2.45, -4.0],
  [-1.6, 2.45, -4.0],
  [0.4, 2.45, -4.0],
]

/** Wall sconces: two per side wall, two on the back wall. Held ~0.6u off the
 *  plaster, or they burn a hot spot into the white wall. */
const SCONCES: V3[] = [
  [-6.4, 2.3, -2.0],
  [-6.4, 2.3, 4.0],
  [6.4, 2.3, -2.0],
  [6.4, 2.3, 4.0],
  [-6.0, 2.3, -6.3],
  [5.5, 2.3, -6.3],
]

const WARM = '#ffc990'

/**
 * Layered lighting for the café interior — its own rig, independent of the
 * town's sun. Modern-chic: a softly warm base (the old peachy rig turned the
 * white walls yellow; the first neutral pass read too bright and clinical),
 * with the strongest warmth from the fixtures.
 *  1. base — ambient + hemisphere, a broad high main light over the room, and
 *     a soft front key (the only shadow caster);
 *  2. recessed downlights — a soft pool on every table;
 *  3. daylight from the four windows;
 *  4. accents — counter pendants, wall sconces, the lit pastry case.
 */
export function CafeLights() {
  const tables = IS_MOBILE ? TABLES_MOBILE : TABLES
  return (
    <>
      {/* 1 · base */}
      <ambientLight intensity={0.3} color={'#fbeedd'} />
      <hemisphereLight args={[0xfff0dc, 0x6b5a48, 0.3]} />
      <pointLight position={[0, 9, 0]} color={'#ffecd6'} intensity={85} distance={30} decay={2} />
      <directionalLight
        position={[1, 12, 9]}
        intensity={0.4}
        color={0xffead2}
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

      {/* 2 · recessed downlights over the tables — a subtle warm pool on each
          top and the floor around it. `distance` must clear the floor by a
          good margin or its cutoff window quietly kills the pool; much above
          ~30 and the marble tops bloom out. */}
      {tables.map(([x, z], i) => (
        <Spot
          key={i}
          from={[x, 4.2, z]}
          to={[x, 0, z]}
          angle={0.4}
          penumbra={0.55}
          intensity={22}
          distance={12}
          color={'#ffd9ae'}
        />
      ))}

      {/* 3 · window daylight */}
      {WINDOWS.map((p, i) => (
        <pointLight key={i} position={p} color={'#f8eee0'} intensity={9} distance={18} decay={2} />
      ))}

      {/* 4 · accents */}
      {PENDANTS.map((p, i) => (
        <pointLight key={`p${i}`} position={p} color={WARM} intensity={3} distance={5} decay={2} />
      ))}
      {/* Pastry-case glow: the LED strips under its glass lid (Blender
          PF_frame, x 2.6–4.6, y 3.6–4.4) light the pastries inside. */}
      <pointLight position={[3.6, 1.4, -4.0]} color={'#fff0dc'} intensity={4} distance={2.4} decay={2} />
      {!IS_MOBILE &&
        SCONCES.map((p, i) => (
          <pointLight key={`s${i}`} position={p} color={WARM} intensity={1.5} distance={3.5} decay={2} />
        ))}
    </>
  )
}
