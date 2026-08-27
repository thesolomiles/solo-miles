import * as THREE from 'three'
import { PACMAN } from '../../config/arcade'

/**
 * Pac-Man maze materials. Lambert walls/floor/pellets read as flat unlit
 * cardboard; these swap them for PBR (standard + physical) so the same blocks
 * catch the maze sun, pick up a cheap baked env sheen, and the pellets bloom as
 * self-lit dots. Grid generation is untouched — one shared material per kind.
 *
 * Built once per session (PacmanWorld unmounts on café return, same trap as the
 * river env-map). Meshes that bind these must pass `dispose={null}` so R3F
 * doesn't dispose the shared GPU objects on unmount.
 */

export interface MazeMaterials {
  floor: THREE.MeshStandardMaterial
  wall: THREE.MeshPhysicalMaterial
  pellet: THREE.MeshStandardMaterial
  power: THREE.MeshStandardMaterial
}

let cache: MazeMaterials | null = null

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    cache = null
  })
}

/** Extra world units the floor extends past the board so the follow-cam never
 *  shows the dark void. Must match the plane size in PacmanWorld. */
export const MAZE_FLOOR_PAD = 40
const floorW = PACMAN.cols * PACMAN.tile + MAZE_FLOOR_PAD
const floorD = PACMAN.rows * PACMAN.tile + MAZE_FLOOR_PAD

function makeBevelNormalMap(size = 128, bevel = 18): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  const d = img.data
  const inv = 1 / bevel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x)
      const dy = Math.min(y, size - 1 - y)
      let nx = 0
      let ny = 0
      if (dx < bevel) {
        const t = (1 - dx * inv) ** 2
        nx = x < size / 2 ? -t : t
      }
      if (dy < bevel) {
        const t = (1 - dy * inv) ** 2
        // Canvas y grows down; CanvasTexture.flipY maps that to +V, so a
        // downward canvas tilt is a +Y tangent tilt after the flip.
        ny = y < size / 2 ? t : -t
      }
      const len = Math.hypot(nx, ny, 1) || 1
      const i = (y * size + x) * 4
      d[i] = ((nx / len) * 0.5 + 0.5) * 255
      d[i + 1] = ((ny / len) * 0.5 + 0.5) * 255
      d[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 4
  return tex
}

/** One tile cell: a slightly lighter fill with a darker grout rim. */
function makeFloorAlbedo(): THREE.CanvasTexture {
  const size = 64
  const grout = 5
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#2a2f36'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#4a5260'
  g.fillRect(grout, grout, size - grout * 2, size - grout * 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 8
  tex.repeat.set(floorW / PACMAN.tile, floorD / PACMAN.tile)
  // Align grout lines to maze tile corners (plane UV 0 is the floor's -X/-Z
  // edge, which sits FLOOR_PAD/2 beyond the board).
  const shift = -MAZE_FLOOR_PAD / 2 / PACMAN.tile
  tex.offset.set(shift, shift)
  return tex
}

/** Grout is rougher than the tile face, so the faces catch a bit more sheen. */
function makeFloorRoughness(): THREE.CanvasTexture {
  const size = 64
  const grout = 5
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.fillStyle = '#e0e0e0'
  g.fillRect(0, 0, size, size)
  g.fillStyle = '#8a8a8a'
  g.fillRect(grout, grout, size - grout * 2, size - grout * 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/**
 * Dark-surround studio env so metalness / clearcoat have something to reflect.
 * The maze isn't under the town sky (it's a black interior), so we bake a warm
 * gradient + a soft blob at the maze sun rather than reusing the water cubemap.
 * Same trick as TownModel.makeSkyEnv: one small PMREM, no reflection pass.
 */
function makeMazeEnv(gl: THREE.WebGLRenderer): THREE.Texture {
  const w = 256
  const h = 128
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const grd = g.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, '#c8c2b6')
  grd.addColorStop(0.48, '#6a6560')
  grd.addColorStop(1, '#1c1814')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)
  // Maze key light sits at [8, 16, 10] — a warm blob in the upper-right sky.
  const sun = g.createRadialGradient(w * 0.62, h * 0.2, 0, w * 0.62, h * 0.2, h * 0.38)
  sun.addColorStop(0, 'rgba(255,241,214,0.95)')
  sun.addColorStop(0.45, 'rgba(255,225,180,0.35)')
  sun.addColorStop(1, 'rgba(255,225,180,0)')
  g.fillStyle = sun
  g.fillRect(0, 0, w, h)

  const eq = new THREE.CanvasTexture(c)
  eq.colorSpace = THREE.SRGBColorSpace
  eq.mapping = THREE.EquirectangularReflectionMapping
  const pmrem = new THREE.PMREMGenerator(gl)
  const env = pmrem.fromEquirectangular(eq).texture
  eq.dispose()
  pmrem.dispose()
  return env
}

export function getMazeMaterials(gl: THREE.WebGLRenderer): MazeMaterials {
  if (cache) return cache

  const env = makeMazeEnv(gl)
  const albedo = makeFloorAlbedo()
  const roughnessMap = makeFloorRoughness()
  roughnessMap.repeat.copy(albedo.repeat)
  roughnessMap.offset.copy(albedo.offset)
  roughnessMap.anisotropy = albedo.anisotropy

  const floor = new THREE.MeshStandardMaterial({
    // White tint: `color` multiplies the map, and a grey tint on a grey atlas
    // crushed the floor to near-black (grid + wall shadows vanished).
    color: '#ffffff',
    map: albedo,
    roughness: 0.6,
    roughnessMap,
    metalness: 0.1,
    envMap: env,
    envMapIntensity: 0.85,
  })

  const wall = new THREE.MeshPhysicalMaterial({
    color: '#9aa3b2',
    roughness: 0.35,
    metalness: 0.2,
    clearcoat: 0.4,
    clearcoatRoughness: 0.1,
    envMap: env,
    envMapIntensity: 1.15,
    normalMap: makeBevelNormalMap(),
    normalScale: new THREE.Vector2(0.9, 0.9),
  })

  const pellet = new THREE.MeshStandardMaterial({
    color: '#ffd54a',
    emissive: '#e6b800',
    emissiveIntensity: 1.4,
    roughness: 0.35,
    metalness: 0.15,
    envMap: env,
    envMapIntensity: 0.5,
  })

  const power = new THREE.MeshStandardMaterial({
    color: '#ffe066',
    emissive: '#ffcc33',
    emissiveIntensity: 1.85,
    roughness: 0.22,
    metalness: 0.25,
    envMap: env,
    envMapIntensity: 0.65,
  })

  cache = { floor, wall, pellet, power }
  return cache
}
