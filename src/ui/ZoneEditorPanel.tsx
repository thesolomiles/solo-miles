import { useEffect, useState } from 'react'
import { useZoneEdit } from '../state/zoneEdit'

// A successful Save rewrites the data file, which triggers a Vite HMR remount —
// wiping the button's "Saved ✓" state. Stash a timestamp so the freshly-mounted
// panel can re-show the confirmation for the rest of its window.
const SAVED_KEY = 'solomiles.zoneSavedAt'

/**
 * Dev-only toolbar for the interaction-zone editor. Rendered ONLY with `?zones`
 * (see App.tsx), collapsed by default — click the header to bring it out, like
 * the collision panel. Add / delete / clear the named boxes, NAME the selected
 * one (this is how you point at a box to wire up later), then "Save" writes them
 * into src/config/zones.data.ts and git-commits (via the dev-server endpoint in
 * vite.config.ts). Boxes are drawn + dragged in-scene by three/ZoneEditor.tsx.
 */
type SaveState = 'idle' | 'saving' | 'ok' | 'err'

export function ZoneEditorPanel() {
  const { open, toggle, zones, selected, add, remove, setVerb, clear } = useZoneEdit()
  const [save, setSave] = useState<SaveState>(() => {
    try {
      const t = Number(sessionStorage.getItem(SAVED_KEY))
      if (t && Date.now() - t < 3000) return 'ok'
    } catch {
      /* ignore */
    }
    return 'idle'
  })

  // Clear a restored/just-set confirmation after its window (survives remount).
  useEffect(() => {
    if (save !== 'ok') return
    const id = setTimeout(() => {
      setSave('idle')
      try {
        sessionStorage.removeItem(SAVED_KEY)
      } catch {
        /* ignore */
      }
    }, 2000)
    return () => clearTimeout(id)
  }, [save])

  const doSave = async () => {
    setSave('saving')
    try {
      const res = await fetch('/__save-zones', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(zones),
      })
      const data = (await res.json()) as { ok: boolean; committed?: boolean }
      if (!res.ok || !data.ok) throw new Error('save failed')
      // File is now the source of truth — drop the localStorage draft so it
      // can't shadow future file edits.
      try {
        localStorage.removeItem('solomiles.interactZones')
        sessionStorage.setItem(SAVED_KEY, String(Date.now()))
      } catch {
        /* ignore */
      }
      setSave('ok')
    } catch {
      setSave('err')
      setTimeout(() => setSave('idle'), 2000)
    }
  }

  const sel = selected != null ? zones[selected] : null
  const saveLabel =
    save === 'saving'
      ? 'Saving…'
      : save === 'ok'
        ? 'Saved ✓ committed'
        : save === 'err'
          ? 'Save failed (dev only)'
          : 'Save'

  return (
    <div style={S.panel}>
      {/* Whole header toggles; the +/- is a visual affordance (no own handler,
          so a click on it bubbles to this div and toggles exactly once). */}
      <div style={S.head} onClick={toggle}>
        <span style={S.title}>⬚ Zones {open ? '' : '(hidden)'}</span>
        <span style={S.btnSm}>{open ? '–' : '+'}</span>
      </div>

      {open && (
        <>
          <div style={S.hint}>
            Click a box to select · drag its face to move · drag a yellow corner to resize. Pressing
            E inside a box does nothing until it's wired up by id.
          </div>

          <div style={S.stat}>
            {zones.length} zone{zones.length === 1 ? '' : 's'}
            {sel &&
              ` · sel ${round(sel.maxX - sel.minX)}×${round(sel.maxZ - sel.minZ)} @ (${round((sel.minX + sel.maxX) / 2)}, ${round((sel.minZ + sel.maxZ) / 2)})`}
          </div>

          {sel && selected != null && (
            <div style={S.fields}>
              <div style={S.id}>id: {sel.id}</div>
              <label style={S.field}>
                <span style={S.lbl}>Verb</span>
                <input
                  style={S.input}
                  value={sel.verb ?? ''}
                  onChange={(e) => setVerb(selected, e.target.value || undefined)}
                  placeholder="Enter"
                  spellCheck={false}
                />
              </label>
            </div>
          )}

          <div style={S.grid}>
            <button style={S.btn} onClick={add}>
              + Add box
            </button>
            <button
              style={{ ...S.btn, opacity: selected == null ? 0.4 : 1 }}
              disabled={selected == null}
              onClick={() => selected != null && remove(selected)}
            >
              Delete sel
            </button>
            <button
              style={{ ...S.btnAlt, gridColumn: '1 / -1' }}
              onClick={() => confirm('Clear all zones?') && clear()}
            >
              Clear all
            </button>
          </div>

          <button
            style={{ ...S.save, background: save === 'err' ? 'rgba(255,90,90,0.9)' : S.save.background }}
            onClick={doSave}
            disabled={save === 'saving'}
          >
            {saveLabel}
          </button>
        </>
      )}
    </div>
  )
}

const round = (n: number) => Math.round(n * 10) / 10

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const S: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    // Bottom-right so the three dev panels each get their own corner: collision
    // top-left, lighting top-right, zones here. (Grows upward when tall.)
    bottom: 12,
    right: 12,
    width: 244,
    padding: 10,
    background: 'rgba(20,26,34,0.82)',
    backdropFilter: 'blur(8px)',
    borderRadius: 10,
    border: '1px solid rgba(120,180,255,0.22)',
    color: '#e7f0ff',
    font: `11px ${mono}`,
    zIndex: 50,
    userSelect: 'none',
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  title: { fontSize: 12, fontWeight: 600, letterSpacing: 0.3 },
  hint: { fontSize: 10, opacity: 0.6, lineHeight: 1.4, margin: '8px 0' },
  stat: {
    margin: '0 0 8px',
    padding: '4px 6px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    fontSize: 10,
    opacity: 0.9,
  },
  fields: {
    display: 'grid',
    gap: 6,
    margin: '0 0 8px',
    padding: 8,
    background: 'rgba(120,180,255,0.1)',
    borderRadius: 6,
  },
  field: { display: 'grid', gridTemplateColumns: '38px 1fr', alignItems: 'center', gap: 6 },
  lbl: { fontSize: 10, opacity: 0.7 },
  input: {
    width: '100%',
    padding: '5px 7px',
    background: 'rgba(0,0,0,0.28)',
    color: '#e7f0ff',
    border: '1px solid rgba(120,180,255,0.28)',
    borderRadius: 5,
    font: `11px ${mono}`,
    outline: 'none',
  },
  id: { fontSize: 11, opacity: 0.85, fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  btn: {
    padding: '6px 0',
    background: 'rgba(90,150,255,0.9)',
    color: '#0b1220',
    border: 'none',
    borderRadius: 6,
    font: `11px ${mono}`,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnAlt: {
    padding: '6px 0',
    background: 'rgba(255,255,255,0.1)',
    color: '#e7f0ff',
    border: 'none',
    borderRadius: 6,
    font: `11px ${mono}`,
    cursor: 'pointer',
  },
  save: {
    width: '100%',
    marginTop: 8,
    padding: '6px 0',
    background: 'rgba(0,224,160,0.85)',
    color: '#0c1512',
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
    color: '#e7f0ff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    lineHeight: '20px',
  },
}
