import { Canvas } from '@react-three/fiber'
import { KeyboardControls, type KeyboardControlsEntry } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { Scene } from './three/Scene'
import { Hud } from './ui/Hud'
import { LightingPanel } from './ui/LightingPanel'
import { ColliderEditorPanel } from './ui/ColliderEditorPanel'
import { ZoneEditorPanel } from './ui/ZoneEditorPanel'
import { useGame } from './state/store'
import { useLighting } from './state/lighting'
import { useCafeColliderEdit } from './state/cafeColliderEdit'
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
  // Which world's collision editor the ?edit toolbar drives — the café while
  // inside it, the town otherwise.
  const inCafe = useGame((s) => s.interior === 'cafe')
  // Atmospheric haze veil strength (also drives the 3D distance fog in Scene).
  // Suppressed inside an interior — the café has its own dark, enclosed mood.
  const hazeKnob = useLighting((s) => s.haze)
  const haze = inCafe ? 0 : hazeKnob
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

      {/* Atmospheric haze veil: a subtle warm screen-space layer, denser toward
          the top (the distance in our fixed 3/4 view) and clearing into the
          foreground — the even, slightly-desaturating aerial haze of golden hour.
          The tight camera shows too little depth for 3D fog alone to read, so this
          carries the look; it sits above the scene but below the HUD, and never
          eats input. Opacity scales with the `haze` knob (?debug). */}
      {haze > 0 && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            background: `linear-gradient(to bottom, rgba(234,224,206,${(
              0.5 * haze
            ).toFixed(3)}) 0%, rgba(234,224,206,${(0.26 * haze).toFixed(
              3,
            )}) 40%, rgba(234,224,206,0) 74%)`,
          }}
        />
      )}

      <Hud />
      {DEBUG && <LightingPanel />}
      {EDIT &&
        (inCafe ? (
          <ColliderEditorPanel
            store={useCafeColliderEdit}
            saveUrl="/__save-cafe-colliders"
            savedKey="solomiles.cafeColliderSavedAt"
            draftKey="solomiles.cafeColliders"
            title="Café collision"
          />
        ) : (
          <ColliderEditorPanel />
        ))}
      {ZONES && <ZoneEditorPanel />}
    </div>
  )
}
