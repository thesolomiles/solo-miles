import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Scene } from './three/Scene'
import { Hud } from './ui/Hud'
import { LightingPanel } from './ui/LightingPanel'
import { ColliderEditorPanel } from './ui/ColliderEditorPanel'
import { DIAG_NOSHADOW, DIAG_INFO } from './systems/diag'
import { IS_MOBILE } from './systems/device'
import { MOBILE_CANVAS_FILTER } from './three/PostFX'

/** `?d=info` overlay — reads the device flags on the actual phone so we can see
 *  whether IS_MOBILE (and thus the mobile render path) is firing. Temporary. */
function DiagInfo() {
  const coarse =
    typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  const touch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : -1
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        zIndex: 9999,
        maxWidth: '92vw',
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        font: '12px/1.4 monospace',
        borderRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {`IS_MOBILE=${IS_MOBILE}\npointer:coarse=${coarse}\nmaxTouchPoints=${touch}\nUA=${ua}`}
    </div>
  )
}

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
          // VSM shadows work fine on iOS — the black-blob bug was the post
          // pipeline, not shadows (see PostFX.tsx). `?d=noshadow` disables
          // shadows entirely for on-device bisecting (systems/diag.ts).
          shadows={DIAG_NOSHADOW ? false : { type: THREE.VSMShadowMap }}
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
      {DIAG_INFO && <DiagInfo />}
    </div>
  )
}
