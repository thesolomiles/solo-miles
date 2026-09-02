import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { RIDE_ASSETS, type RideAsset } from './three/ride/assets'
import { makeTarmacTexture } from './three/tarmac'
import { RIDE_COLORS } from './config/ride'

/**
 * Asset library gallery — a standalone dev page (open /assets.html in `pnpm dev`)
 * that renders every reusable ride asset in its own little rotating viewer, straight
 * off the RIDE_ASSETS catalog in three/ride/assets.ts. Add an asset there and it
 * shows up here. Two hand-built swatches (Road, Coast) stand in for the ribbon
 * systems, which aren't single geometries.
 */

/** A soft ground pad: a warm-dark disc under the asset that fades to the card
 *  background at its rim, so there's no hard brown horizon line cutting the frame —
 *  just a subtle shadow-catching vignette. */
function makeGroundTexture(): THREE.CanvasTexture {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgba(42, 46, 36, 1)')
  g.addColorStop(0.55, 'rgba(30, 33, 25, 1)')
  g.addColorStop(1, 'rgba(21, 23, 15, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(c)
}
const GROUND_TEX = makeGroundTexture()

function Lights() {
  return (
    <>
      <hemisphereLight args={[0xf6e8ce, 0x55503f, 1.0]} />
      <ambientLight intensity={0.7} color={0xffefdc} />
      <directionalLight position={[4, 7, 5]} intensity={2.0} color={0xffe6c0} castShadow />
      <directionalLight position={[-5, 4, -3]} intensity={0.5} color={0xaecbe6} />
    </>
  )
}

/** Deterministically fit any asset to the viewer: scale so its largest dimension
 *  fills a fixed target, centre it on X/Z and rest its base on the ground (y=0).
 *  Replaces drei <Bounds>, whose auto-fit mis-framed the tall pole assets. */
const FIT_SIZE = 2.6
function Framed({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    g.scale.setScalar(1)
    g.position.set(0, 0, 0)
    g.updateWorldMatrix(true, true)
    const box = new THREE.Box3().setFromObject(g)
    const size = new THREE.Vector3()
    box.getSize(size)
    const s = FIT_SIZE / (Math.max(size.x, size.y, size.z) || 1)
    g.scale.setScalar(s)
    g.updateWorldMatrix(true, true)
    const b2 = new THREE.Box3().setFromObject(g)
    const c = new THREE.Vector3()
    b2.getCenter(c)
    g.position.set(-c.x, -b2.min.y, -c.z) // centre X/Z, base on the ground
  }, [children])
  return <group ref={ref}>{children}</group>
}

/** A single asset in an auto-rotating, orbit-able viewer.
 *  The Canvas is only mounted while the card is near the viewport — each Canvas is a
 *  live WebGL context and browsers cap those (~16), so with a growing catalog we'd
 *  otherwise blow the limit and the earliest viewers would go blank. */
function AssetViewer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '250px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {visible && (
        <Canvas shadows dpr={[1, 2]} camera={{ position: [2.9, 2.4, 3.5], fov: 42 }}>
          <color attach="background" args={['#15170f']} />
          <Lights />
          <Framed>{children}</Framed>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <circleGeometry args={[7, 48]} />
            <meshStandardMaterial map={GROUND_TEX} transparent roughness={1} />
          </mesh>
          <OrbitControls
            autoRotate
            autoRotateSpeed={1.4}
            enablePan={false}
            target={[0, FIT_SIZE * 0.42, 0]}
            minDistance={2}
            maxDistance={16}
          />
        </Canvas>
      )}
    </div>
  )
}

function PropAsset({ asset }: { asset: RideAsset }) {
  const geom = useMemo(() => asset.geometry(), [asset])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        ...(asset.vertexColors ? { vertexColors: true } : { color: asset.color }),
        flatShading: true,
        roughness: 0.9,
      }),
    [asset],
  )
  // Glow parts (lamp, signal lenses) render unlit so they read as self-illuminated.
  const litGeom = useMemo(() => asset.emissive?.(), [asset])
  const litMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), [])
  return (
    <group>
      <mesh geometry={geom} material={mat} castShadow receiveShadow />
      {litGeom && <mesh geometry={litGeom} material={litMat} />}
    </group>
  )
}

/** A short straight length of the ride road: tarmac + painted edge lines + dashes. */
function RoadSwatch() {
  const tex = useMemo(() => {
    const t = makeTarmacTexture({ road: RIDE_COLORS.road, dark: RIDE_COLORS.roadDark, light: RIDE_COLORS.roadLight })
    t.repeat.set(1, 2)
    return t
  }, [])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.2, 7]} />
        <meshStandardMaterial map={tex} roughness={0.92} />
      </mesh>
      {[-1.4, 1.4].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 0]}>
          <planeGeometry args={[0.14, 7]} />
          <meshStandardMaterial color={RIDE_COLORS.edgeLine} roughness={0.6} />
        </mesh>
      ))}
      {[-2.2, 0, 2.2].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]}>
          <planeGeometry args={[0.2, 1.3]} />
          <meshStandardMaterial color={RIDE_COLORS.dash} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** A cross-section of the coast: sand shoulder, blue sea and a foam seam. */
function CoastSwatch() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-2.1, 0.02, 0]} receiveShadow>
        <planeGeometry args={[2.2, 7]} />
        <meshStandardMaterial color={0xdcc790} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.95, 0.03, 0]}>
        <planeGeometry args={[0.3, 7]} />
        <meshStandardMaterial color={0xf3eede} roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.5, 0, 0]} receiveShadow>
        <planeGeometry args={[4.2, 7, 12, 12]} />
        <meshStandardMaterial color={0x35a8d2} roughness={0.42} metalness={0.06} flatShading />
      </mesh>
    </group>
  )
}

const CATEGORIES = ['Trees', 'Farmland', 'Roadside', 'Ground & Rock'] as const

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="viewer">{children}</div>
      <div className="name">{title}</div>
    </div>
  )
}

function Gallery() {
  return (
    <>
      <header>
        <h1>Solomiles · Asset Library</h1>
        <p>Reusable low-poly ride assets. Drag to orbit. Add to <code>src/three/ride/assets.ts</code> and they appear here.</p>
      </header>

      {CATEGORIES.map((cat) => (
        <section key={cat}>
          <h2>{cat}</h2>
          <div className="grid">
            {RIDE_ASSETS.filter((a) => a.category === cat).map((a) => (
              <Card key={a.id} title={a.name}>
                <AssetViewer>
                  <PropAsset asset={a} />
                </AssetViewer>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <section>
        <h2>Road &amp; Coast</h2>
        <p className="note">Ribbon systems that follow the road — shown here as short straight swatches.</p>
        <div className="grid">
          <Card title="Road">
            <AssetViewer><RoadSwatch /></AssetViewer>
          </Card>
          <Card title="Coast (sand · sea)">
            <AssetViewer><CoastSwatch /></AssetViewer>
          </Card>
        </div>
      </section>
    </>
  )
}

const STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #12140f; color: #e7e9df;
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  header { padding: 32px 32px 8px; }
  header h1 { margin: 0 0 6px; font-size: 1.5rem; letter-spacing: -0.01em; }
  header p { margin: 0; color: #8f978a; font-size: 0.92rem; }
  header code { color: #d6b24a; }
  section { padding: 12px 32px 24px; }
  section h2 { margin: 20px 0 12px; font-size: 0.8rem; text-transform: uppercase;
    letter-spacing: 0.1em; color: #d6b24a; border-bottom: 1px solid #2a2e24; padding-bottom: 8px; }
  .note { margin: -4px 0 12px; color: #8f978a; font-size: 0.85rem; }
  .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  .card { background: #1a1d16; border: 1px solid #2a2e24; border-radius: 12px; overflow: hidden; }
  .viewer { aspect-ratio: 4 / 3; }
  .viewer canvas { display: block; width: 100% !important; height: 100% !important; }
  .name { padding: 10px 12px; font-weight: 600; font-size: 0.9rem; border-top: 1px solid #2a2e24; }
`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <style>{STYLES}</style>
    <Gallery />
  </StrictMode>,
)
