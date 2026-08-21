import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Scene } from './three/Scene'
import { Hud } from './ui/Hud'
import { LightingPanel } from './ui/LightingPanel'

type Controls = 'forward' | 'back' | 'left' | 'right' | 'interact' | 'jump'

// The lighting tuner only exists with `?debug` in the URL — production is clean.
const DEBUG =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

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
          shadows={{ type: THREE.VSMShadowMap }}
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
    </div>
  )
}
