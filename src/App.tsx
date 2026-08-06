import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { useMemo } from 'react'
import { Scene } from './three/Scene'
import { Hud } from './ui/Hud'

type Controls = 'forward' | 'back' | 'left' | 'right' | 'interact'

export default function App() {
  const map = useMemo<KeyboardControlsEntry<Controls>[]>(
    () => [
      { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
      { name: 'back', keys: ['ArrowDown', 'KeyS'] },
      { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
      { name: 'right', keys: ['ArrowRight', 'KeyD'] },
      { name: 'interact', keys: ['KeyE', 'Space', 'Enter'] },
    ],
    [],
  )

  return (
    <div className="app">
      <KeyboardControls map={map}>
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true }}
          // A default camera is created then immediately replaced by OrthoRig.
          camera={{ position: [0, 16, 25] }}
        >
          <Scene />
        </Canvas>
      </KeyboardControls>

      <Hud />
    </div>
  )
}
