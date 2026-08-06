import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { useMemo } from 'react'
import { Scene } from './three/Scene'

type Controls = 'forward' | 'back' | 'left' | 'right'

export default function App() {
  const map = useMemo<KeyboardControlsEntry<Controls>[]>(
    () => [
      { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
      { name: 'back', keys: ['ArrowDown', 'KeyS'] },
      { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
      { name: 'right', keys: ['ArrowRight', 'KeyD'] },
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

      <div className="hud">
        <div className="hud__badge">Solomiles · Phase 0</div>
        <div className="hud__hint">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to move
        </div>
      </div>
    </div>
  )
}
