import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Scene } from './three/Scene'
import { Hud } from './ui/Hud'
import { LightingPanel } from './ui/LightingPanel'
import { ColliderEditorPanel } from './ui/ColliderEditorPanel'
import { ZoneEditorPanel } from './ui/ZoneEditorPanel'
import { IS_MOBILE } from './systems/device'
import { MOBILE_CANVAS_FILTER } from './three/PostFX'

type Controls = 'forward' | 'back' | 'left' | 'right' | 'interact' | 'jump'

// Dev overlays are URL-gated so production stays clean: `?debug` = lighting/perf
// tuner, `?edit` = the collision editor toolbar, `?zones` = the interaction-zone
// (named "door" box) editor toolbar.
const params =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : undefined
const DEBUG = !!params?.has('debug')
const EDIT = !!params?.has('edit')
const ZONES = !!params?.has('zones')

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
          // VSM shadows render fine on iOS — the black-blob bug was the post
          // composer, not shadows (see PostFX.tsx).
          shadows={{ type: THREE.VSMShadowMap }}
          dpr={[1, 2]}
          // Mobile skips the WebGL post composer (iOS black-blob bug, see
          // PostFX.tsx) and antialiasing goes to MSAA instead of the SMAA pass;
          // the colour grade is re-applied here as a cheap CSS filter.
          gl={{ antialias: IS_MOBILE }}
          style={IS_MOBILE ? { filter: MOBILE_CANVAS_FILTER } : undefined}
          // A default camera is created then immediately replaced by OrthoRig.
          camera={{ position: [0, 16, 25] }}
        >
          <Scene />
        </Canvas>
      </KeyboardControls>

      <Hud />
      {DEBUG && <LightingPanel />}
      {EDIT && <ColliderEditorPanel />}
      {ZONES && <ZoneEditorPanel />}
    </div>
  )
}
