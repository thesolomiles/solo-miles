#!/usr/bin/env node
// One-time build script: fetches real elevation data for a grid of points around
// each mountain and generates static SVG contour-line art from it via d3-contour.
// Not run at request time — outputs land in public/topo/*.svg and are committed.
//
// Elevation source: OpenTopoData (https://www.opentopodata.org), aster30m dataset
// (ASTER GDEM, ~30m resolution, free public API, no key required).

import { contours } from 'd3-contour'
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const GRID_SIZE = 50 // ASSUMPTION: 50x50 grid as suggested by the task; override via --grid=N
const RADIUS_KM = 15 // ASSUMPTION: ~15km radius around each summit; override via --radius=N
const THRESHOLD_COUNT = 16 // number of contour lines per map
const VIEWBOX_SIZE = 720 // output SVG is square VIEWBOX_SIZE x VIEWBOX_SIZE
const API_URL = 'https://api.opentopodata.org/v1/aster30m'
const BATCH_SIZE = 100 // OpenTopoData public API max locations per request
const REQUEST_DELAY_MS = 1100 // stay under the public API's 1 req/sec limit

const MOUNTAINS = [
  { slug: 'utsukushigahara', name: 'Utsukushigahara, Nagano, Japan', lat: 36.15, lon: 138.18 },
  { slug: 'taebaeksan', name: 'Taebaeksan, South Korea', lat: 37.10, lon: 128.92 },
  { slug: 'aso', name: 'Mount Aso, Kumamoto, Japan', lat: 32.88, lon: 131.10 },
  { slug: 'shibu-pass', name: 'Shibu Pass (Shibu Tōge), Nagano, Japan', lat: 36.72, lon: 138.52 },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildGrid(centerLat, centerLon, radiusKm, gridSize) {
  const kmPerDegLat = 111.32
  const kmPerDegLon = 111.32 * Math.cos((centerLat * Math.PI) / 180)
  const latSpan = (radiusKm * 2) / kmPerDegLat
  const lonSpan = (radiusKm * 2) / kmPerDegLon
  const latStep = latSpan / (gridSize - 1)
  const lonStep = lonSpan / (gridSize - 1)
  const southLat = centerLat - latSpan / 2
  const westLon = centerLon - lonSpan / 2

  const points = []
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      points.push({ lat: southLat + row * latStep, lon: westLon + col * lonStep })
    }
  }
  return points
}

async function fetchElevations(points) {
  const elevations = new Array(points.length).fill(null)
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE)
    const locations = batch.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join('|')
    const res = await fetch(`${API_URL}?locations=${locations}`)
    if (!res.ok) throw new Error(`OpenTopoData request failed: ${res.status} ${await res.text()}`)
    const json = await res.json()
    if (json.status !== 'OK') throw new Error(`OpenTopoData error: ${JSON.stringify(json)}`)
    json.results.forEach((r, j) => {
      elevations[i + j] = r.elevation
    })
    process.stdout.write(`.`)
    if (i + BATCH_SIZE < points.length) await sleep(REQUEST_DELAY_MS)
  }
  return elevations
}

function fillNulls(values) {
  const known = values.filter((v) => v !== null && v !== undefined)
  const mean = known.reduce((a, b) => a + b, 0) / (known.length || 1)
  return values.map((v) => (v === null || v === undefined ? mean : v))
}

// Raw 30m ASTER DEM data is noisy at this scale (sensor artifacts produce small
// spurious islands/zigzags once contoured). A couple of 3x3 box-blur passes
// removes that noise while keeping the real terrain shape — standard practice
// for DEM-derived contours, same idea as smoothing on a printed topo map.
function smoothGrid(values, width, height, passes = 2) {
  let src = values
  for (let p = 0; p < passes; p++) {
    const dst = new Array(src.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += src[ny * width + nx]
              count++
            }
          }
        }
        dst[y * width + x] = sum / count
      }
    }
    src = dst
  }
  return src
}

// Chaikin corner-cutting: softens the polyline the marching-squares algorithm
// produces on a discrete grid into a smoother curve, without changing what
// terrain feature it traces.
function chaikinSmooth(ring, iterations = 2) {
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  let pts = closed ? ring.slice(0, -1) : ring.slice()
  for (let iter = 0; iter < iterations; iter++) {
    const next = []
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const p0 = pts[i]
      const p1 = pts[(i + 1) % n]
      next.push([p0[0] * 0.75 + p1[0] * 0.25, p0[1] * 0.75 + p1[1] * 0.25])
      next.push([p0[0] * 0.25 + p1[0] * 0.75, p0[1] * 0.25 + p1[1] * 0.75])
    }
    pts = next
  }
  if (closed) pts.push(pts[0])
  return pts
}

// Sum of Euclidean segment lengths within each "M ... L ... L ...Z" subpath.
function ringLength(ring) {
  let len = 0
  for (let i = 1; i < ring.length; i++) {
    const [x0, y0] = ring[i - 1]
    const [x1, y1] = ring[i]
    len += Math.hypot(x1 - x0, y1 - y0)
  }
  return len
}

function ringToPathData(ring) {
  return ring.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + 'Z'
}

function contoursToSvg(features, gridSize, scale) {
  const paths = []
  for (const feature of features) {
    const subpaths = []
    let length = 0
    for (const polygon of feature.coordinates) {
      for (const ring of polygon) {
        const smoothed = chaikinSmooth(ring, 2)
        const scaled = smoothed.map(([x, y]) => [x * scale, y * scale])
        subpaths.push(ringToPathData(scaled))
        length += ringLength(scaled)
      }
    }
    if (subpaths.length === 0) continue
    paths.push({ d: subpaths.join(' '), length })
  }

  const size = gridSize * scale
  const pathEls = paths
    .map(
      ({ d, length }) =>
        `<path d="${d}" style="--path-length:${length.toFixed(1)}" class="topo-line" fill="none" stroke="currentColor" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
    )
    .join('\n')

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">\n${pathEls}\n</svg>\n`
}

async function generateOne(mountain) {
  console.log(`\n${mountain.name} (${mountain.lat}, ${mountain.lon})`)
  const points = buildGrid(mountain.lat, mountain.lon, RADIUS_KM, GRID_SIZE)

  const cacheDir = path.join(process.cwd(), 'public', 'topo', '.cache')
  const cachePath = path.join(cacheDir, `${mountain.slug}.json`)
  let raw
  try {
    raw = JSON.parse(await readFile(cachePath, 'utf8'))
    console.log(`  using cached elevations (${cachePath})`)
  } catch {
    console.log(`  fetching ${points.length} elevations from OpenTopoData (aster30m)...`)
    raw = await fetchElevations(points)
    await mkdir(cacheDir, { recursive: true })
    await writeFile(cachePath, JSON.stringify(raw), 'utf8')
  }
  const filled = fillNulls(raw)
  const values = smoothGrid(filled, GRID_SIZE, GRID_SIZE, 2)

  const min = Math.min(...values)
  const max = Math.max(...values)
  console.log(`\n  elevation range: ${min.toFixed(0)}m - ${max.toFixed(0)}m`)

  const generator = contours().size([GRID_SIZE, GRID_SIZE]).thresholds(THRESHOLD_COUNT)
  const features = generator(values)
  console.log(`  generated ${features.length} contour levels`)

  const scale = VIEWBOX_SIZE / GRID_SIZE
  const svg = contoursToSvg(features, GRID_SIZE, scale)

  const outDir = path.join(process.cwd(), 'public', 'topo')
  await mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `${mountain.slug}.svg`)
  await writeFile(outPath, svg, 'utf8')
  console.log(`  wrote ${path.relative(process.cwd(), outPath)}`)
}

async function main() {
  for (const mountain of MOUNTAINS) {
    await generateOne(mountain)
  }
  console.log('\ndone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
