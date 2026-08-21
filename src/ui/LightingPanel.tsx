import { useState } from 'react'
import { LIGHTING_CONTROLS, useLighting } from '../state/lighting'

/**
 * Dev-only lighting tuner. Rendered ONLY when the URL has `?debug` (see
 * App.tsx), so production never shows it. Sliders write straight into the
 * lighting store, which Scene / PostFX / TownModel read live. "Copy" dumps the
 * current values as a `LIGHTING_DEFAULTS` snippet to paste into
 * `src/state/lighting.ts` once you like the look — that's what ships.
 */
export function LightingPanel() {
  const state = useLighting()
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const body = LIGHTING_CONTROLS.map(([k]) => `  ${k}: ${state[k]},`).join('\n')
    navigator.clipboard?.writeText(`export const LIGHTING_DEFAULTS: LightingState = {\n${body}\n}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div style={S.panel}>
      <div style={S.head}>
        <span style={S.title}>☀ Lighting {open ? '' : '(hidden)'}</span>
        <button style={S.btnSm} onClick={() => setOpen((o) => !o)}>
          {open ? '–' : '+'}
        </button>
      </div>

      {open && (
        <>
          {LIGHTING_CONTROLS.map(([key, label, min, max, step]) => (
            <label key={key} style={S.row}>
              <span style={S.label}>{label}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={state[key]}
                onChange={(e) => state.set(key, parseFloat(e.target.value))}
                style={S.slider}
              />
              <span style={S.val}>{state[key].toFixed(2)}</span>
            </label>
          ))}
          <div style={S.actions}>
            <button style={S.btn} onClick={state.reset}>
              Reset
            </button>
            <button style={S.btn} onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy values'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const S: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 12,
    right: 12,
    width: 232,
    padding: 10,
    background: 'rgba(24,22,20,0.82)',
    backdropFilter: 'blur(8px)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#f2e9df',
    font: `11px ${mono}`,
    zIndex: 50,
    userSelect: 'none',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 12, fontWeight: 600, letterSpacing: 0.3 },
  row: { display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0' },
  label: { width: 74, opacity: 0.85, flexShrink: 0 },
  slider: { flex: 1, accentColor: '#e08a3c', height: 14 },
  val: { width: 34, textAlign: 'right', opacity: 0.7, flexShrink: 0 },
  actions: { display: 'flex', gap: 6, marginTop: 8 },
  btn: {
    flex: 1,
    padding: '5px 0',
    background: 'rgba(224,138,60,0.9)',
    color: '#1a1512',
    border: 'none',
    borderRadius: 6,
    font: `11px ${mono}`,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnSm: {
    width: 22,
    height: 22,
    background: 'rgba(255,255,255,0.1)',
    color: '#f2e9df',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    lineHeight: '20px',
  },
}
