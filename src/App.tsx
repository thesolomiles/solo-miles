import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Scene } from './three/Scene'
import { Hud } from './ui/Hud'
import { LightingPanel } from './ui/LightingPanel'
import { ColliderEditorPanel } from './ui/ColliderEditorPanel'
import { IS_MOBILE } from './systems/device'
import { DIAG_NOSHADOW } from './systems/diag'

type Controls = 'forward' | 'back' | 'left' | 'right' | 'interact' | 'jump'

// Dev overlays are URL-gated so production stays clean: `?debug` = lighting/perf
// tuner, `?edit` = the hand-authored collision editor toolbar.
const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined
const DEBUG = !!params?.has('debug')
const EDIT = !!params?.has('edit')

export default function App() {
  const map = useMemo<KeyboardControlsEntry<Controls>[]>(
    () => [
      { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
      { name: 'back', keys: ['ArrowDown', 'KeyS'] },
      { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
      { name: 'right', keys: ['ArrowRight', 'KeyD'] },
      // Space drives the jump; interaction/dialogue still take Space via the
      // HUD's own listener (drei keys each physical key to ONE entry, so Space
      // can't live here twice). E / Enter remain explicit interact keys.
      { name: 'interact', keys: ['KeyE', 'Enter'] },
      { name: 'jump', keys: ['Space'] },
    ],
    [],
  )

  return (
    <div className="app">
      <KeyboardControls map={map}>
        <Canvas
          // VSM shadow maps render as black blobs on iOS Safari (half-float
          // filtering). Mobile falls back to the robust PCF-soft path; desktop
          // keeps the tuned VSM look. See systems/device.ts. `?d=noshadow`
          // disables shadows entirely for on-device bisecting (systems/diag.ts).
          shadows={
            DIAG_NOSHADOW ? false : { type: IS_MOBILE ? THREE.PCFSoftShadowMap : THREE.VSMShadowMap }
          }
          dpr={[1, 2]}
          gl={{ antialias: false }}
          // A default camera is created then immediately replaced by OrthoRig.
          camera={{ position: [0, 16, 25] }}
        >
          <Scene />
        </Canvas>
      </KeyboardControls>

      <Hud />
      {DEBUG && <LightingPanel />}
      {EDIT && <ColliderEditorPanel />}
    </div>
  )
}
