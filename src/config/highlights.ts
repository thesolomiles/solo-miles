/**
 * Interactable PROPS — the 3D object behind an interaction zone, so it can get
 * the same white outline + hover + click-to-walk as the NPCs (three/ZoneHighlights).
 *
 * The props are baked into each world's merged mesh, so each one is a box (in
 * that model's own glTF space, i.e. Blender (x, z, −y), before the model is
 * placed/scaled) and every triangle fully inside it is cut out as the prop. The
 * boxes are the exact bounds of the Blender groups, measured from the .blend
 * files (2026-10-03). Move a prop in Blender → re-measure its box here.
 *
 * `mesh` limits the cut to one named mesh (dots/spaces ignored) where the box
 * would otherwise catch neighbours. `floorY` (per world) drops flat floor
 * triangles that lie under a prop.
 */
export type PropHighlight = {
  /** The interaction zone this prop belongs to (E action, walk-to target). */
  zone: string
  mesh?: string
  min: [number, number, number]
  max: [number, number, number]
}

export type HighlightWorld = 'town' | 'cafe' | 'home'

export const PROP_HIGHLIGHTS: Record<HighlightWorld, { floorY: number; props: PropHighlight[] }> = {
  town: {
    floorY: 0.07, // grass 0, road tarmac 0.05 / lines 0.065
    props: [
      // Vending machine: 8 loose parts of the teahouse's TH_Props mesh.
      { zone: 'zkjs0ff', mesh: 'TH_Props', min: [14.55, -0.05, 0.2], max: [15.5, 2.0, 1.15] },
      // "Forest roads ahead" signpost (Blender object Cube.001).
      { zone: 'zbydnja', mesh: 'Cube.001', min: [-3.0, -0.05, -4.61], max: [-2.03, 1.65, -4.18] },
    ],
  },
  cafe: {
    floorY: 0.16, // café floor top, before CafeModel's floorDrop
    props: [
      // Both arcade cabinets (Arc1_* + Arc2_*) — one "Play game" zone.
      { zone: 'zhu6zu4', min: [-6.93, 0, 3.22], max: [-5.8, 1.79, 5.38] },
    ],
  },
  home: {
    floorY: 0,
    props: [
      { zone: 'jersey-sg', min: [1.89, 1.24, -6.98], max: [2.86, 2.46, -6.89] },
      { zone: 'jersey-ocbc', min: [3.09, 1.24, -6.98], max: [4.06, 2.46, -6.89] },
      { zone: 'bookshelf', min: [4.94, 0, -6.99], max: [6.96, 2.33, -6.57] },
      { zone: 'desk', min: [-1.51, 0, -7.0], max: [1.01, 3.14, -6.18] },
      // Zwift bike + trainer + the TV it faces
      { zone: 'zwift', min: [-4.26, 0, -6.99], max: [-2.14, 2.36, -3.24] },
    ],
  },
}
