import { StrictMode, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useTownGLTF } from './three/gltf'

/**
 * Face-shot — a standalone dev page (open /face-shot.html in `pnpm dev`) that
 * loads one character GLB on a TRANSPARENT canvas and frames its head + shoulders,
 * so we can grab a clean cut-out bust PNG for the Persona-style dialogue portrait.
 *
 *   /face-shot.html?model=george&yaw=18&zoom=1
 *
 * Params: model (george|james|melanie|cyclist|character), yaw (deg, spin the
 * model), lift (raise/lower the framing), zoom (dolly in/out).
 *
 * window.__grabFace() returns a PNG data URL of just the model (no background).
 */

const params = new URLSearchParams(location.search)
const MODEL = params.get('model') || 'george'
const YAW = (parseFloat(params.get('yaw') || '18') * Math.PI) / 180
// how far ABOVE the head bone to aim (the eyes/face sit above the neck joint)
const FACEUP = parseFloat(params.get('faceup') || '0.14')
// vertical span (metres) to fit in frame — smaller = tighter crop
const FIT = parseFloat(params.get('fit') || '0.62')
// a touch of downward tilt (deg) for a friendlier eye-level look
const TILT = (parseFloat(params.get('tilt') || '2') * Math.PI) / 180

function idleClip(animations: THREE.AnimationClip[]) {
  return (
    animations.find((c) => c.name === 'idle') ??
    animations.find((c) => c.name === 'sit') ??
    animations[0]
  )
}

function Bust() {
  const { scene, animations } = useTownGLTF(`/models/${MODEL}.glb`)
  const root = useMemo(() => skeletonClone(scene), [scene])
  const { camera } = useThree()

  // Stamp the idle pose (bind pose is a T-pose) before the first frame.
  useLayoutEffect(() => {
    if (!animations.length) return
    const mixer = new THREE.AnimationMixer(root)
    const clip = idleClip(animations)
    const action = mixer.clipAction(clip)
    action.reset()
    action.play()
    mixer.update(0.6) // settle a little way into the loop, off the T-pose
  }, [root, animations])

  // Frame the face off the HEAD bone (arms in a T-pose skew a whole-body bbox,
  // so bbox-centring pushes the face off to one side). Aim a little above the
  // head bone to hit the eyes, and dolly so FIT metres fit vertically.
  useLayoutEffect(() => {
    root.rotation.y = YAW
    root.updateWorldMatrix(true, true)

    let head: THREE.Object3D | null = null
    root.traverse((o) => {
      if (!head && (o as THREE.Bone).isBone && /head/i.test(o.name)) head = o
    })
    const anchor = new THREE.Vector3()
    if (head) (head as THREE.Object3D).getWorldPosition(anchor)
    else new THREE.Box3().setFromObject(root).getCenter(anchor)

    const target = new THREE.Vector3(anchor.x, anchor.y + FACEUP, anchor.z)

    const fov = 30
    const dist = FIT / 2 / Math.tan((fov * Math.PI) / 360)
    camera.position.set(target.x, target.y + Math.sin(TILT) * dist, target.z + Math.cos(TILT) * dist)
    camera.lookAt(target)
    ;(camera as THREE.PerspectiveCamera).fov = fov
    ;(camera as THREE.PerspectiveCamera).near = 0.01
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
    ;(window as unknown as { __faceTarget: THREE.Vector3 }).__faceTarget = target
    ;(window as unknown as { __dbg: unknown }).__dbg = {
      clips: animations.map((c) => c.name),
      anchor: anchor.toArray().map((n) => +n.toFixed(3)),
      foundHead: !!head,
    }
  }, [root, camera, animations])

  return <primitive object={root} />
}

function Grabber() {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    ;(window as unknown as { __grabFace: () => string }).__grabFace = () => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    }
    ;(window as unknown as { __faceReady: boolean }).__faceReady = true
  }, [gl, scene, camera])
  return null
}

function Stage() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 400)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="wrap">
      <Canvas
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        dpr={[1, 2]}
        camera={{ position: [0, 1.4, 1], fov: 30 }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <hemisphereLight args={[0xf6e8ce, 0x55503f, 1.1]} />
        <ambientLight intensity={0.8} color={0xffefdc} />
        <directionalLight position={[3, 5, 4]} intensity={2.1} color={0xffe6c0} />
        <directionalLight position={[-4, 3, 2]} intensity={0.6} color={0xaecbe6} />
        <Bust />
        <Grabber />
      </Canvas>
      {ready && <div className="hint">ready · orbit to adjust · window.__grabFace()</div>}
    </div>
  )
}

const STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; background:
    repeating-conic-gradient(#e7e4dc 0% 25%, #d8d4c8 0% 50%) 0 / 28px 28px; }
  .wrap { position: fixed; inset: 0; }
  .wrap canvas { display: block; width: 100% !important; height: 100% !important; }
  .hint { position: fixed; left: 12px; bottom: 12px; font: 12px/1 ui-monospace, monospace;
    color: #444; background: rgba(255,255,255,.7); padding: 6px 10px; border-radius: 6px; }
`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <style>{STYLES}</style>
    <Stage />
  </StrictMode>,
)
