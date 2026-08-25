import { useEffect, useState } from 'react'
import { useColliderEdit, type ColliderEditStore } from '../state/colliderEdit'

/**
 * Dev-only toolbar for a collision editor. Rendered ONLY with `?edit` (see
 * App.tsx), and collapsed by default — click the header to bring it out, like
 * the lighting panel. Add / delete / seed / clear the hand-authored boxes, then
 * "Save" writes them into the world's config file and git-commits (via the
 * dev-server endpoint) — the old Copy JSON → paste → commit, in one click. Boxes
 * are drawn + dragged in-scene by three/ColliderEditor.tsx.
 *
 * Store-driven so the same toolbar serves both worlds: the town (default) and
 * the café. App picks the store + save endpoint for whichever world is active.
 */
type SaveState = 'idle' | 'saving' | 'ok' | 'err'

interface Props {
  /** Which collider-edit store to drive (town or café). */
  store?: ColliderEditStore
  /** Dev-server endpoint the Save button POSTs the boxes to. */
  saveUrl?: string
  /** sessionStorage key for the "Saved ✓" timestamp (per world, so two panels
   *  don't share it). */
  savedKey?: string
  /** localStorage `?edit` draft key to drop once the file is the source of
   *  truth. */
  draftKey?: string
  /** Panel heading. */
  title?: string
}

export function ColliderEditorPanel({
  store = useColliderEdit,
  saveUrl = '/__save-colliders',
  savedKey = 'solomiles.colliderSavedAt',
  draftKey = 'solomiles.manualColliders',
  title = 'Collision',
}: Props = {}) {
  const { open, toggle, boxes, selected, add, remove, seedFromDerived, clear } = store()
  const [save, setSave] = useState<SaveState>(() => {
    try {
      const t = Number(sessionStorage.getItem(savedKey))
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
        sessionStorage.removeItem(savedKey)
      } catch {
        /* ignore */
      }
    }, 2000)
    return () => clearTimeout(id)
  }, [save, savedKey])

  const doSave = async () => {
    setSave('saving')
    try {
      const res = await fetch(saveUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(boxes),
      })
      const data = (await res.json()) as { ok: boolean; committed?: boolean }
      if (!res.ok || !data.ok) throw new Error('save failed')
      // File is now the source of truth — drop the localStorage draft so it
      // can't shadow future file edits.
      try {
        localStorage.removeItem(draftKey)
        sessionStorage.setItem(savedKey, String(Date.now()))
      } catch {
        /* ignore */
      }
      setSave('ok')
    } catch {
      setSave('err')
      setTimeout(() => setSave('idle'), 2000)
    }
  }

  const sel = selected != null ? boxes[selected] : null
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
        <span style={S.title}>▦ {title} {open ? '' : '(hidden)'}</span>
        <span style={S.btnSm}>{open ? '–' : '+'}</span>
      </div>

      {open && (
        <>
          <div style={S.hint}>
            Click a box to select · drag its face to move · drag a yellow corner to resize
          </div>

          <div style={S.stat}>
            {boxes.length} box{boxes.length === 1 ? '' : 'es'}
            {sel &&
              ` · sel ${round(sel.maxX - sel.minX)}×${round(sel.maxZ - sel.minZ)} @ (${round((sel.minX + sel.maxX) / 2)}, ${round((sel.minZ + sel.maxZ) / 2)})`}
          </div>

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
            {seedFromDerived && (
              <button style={S.btnAlt} onClick={seedFromDerived}>
                Seed town.glb
              </button>
            )}
            <button style={S.btnAlt} onClick={() => confirm('Clear all boxes?') && clear()}>
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
    top: 12,
    left: 12,
    width: 244,
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
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 },
  btn: {
    padding: '6px 0',
    background: 'rgba(224,138,60,0.9)',
    color: '#1a1512',
    border: 'none',
    borderRadius: 6,
    font: `11px ${mono}`,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnAlt: {
    padding: '6px 0',
    background: 'rgba(255,255,255,0.1)',
    color: '#f2e9df',
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
    color: '#f2e9df',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    lineHeight: '20px',
  },
}
