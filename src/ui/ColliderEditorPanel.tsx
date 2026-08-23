import { useState } from 'react'
import type { BoxCollider } from '../config/town'
import { useColliderEdit } from '../state/colliderEdit'

/**
 * Dev-only toolbar for the collision editor. Rendered ONLY with `?edit` (see
 * App.tsx). Add / delete / seed / clear the hand-authored boxes, then "Copy
 * JSON" dumps the current set as a `MANUAL_COLLIDERS` snippet to paste into
 * src/config/colliders.data.ts and commit — that's what ships. Until then the
 * live edits persist in localStorage, so a reload keeps your work.
 *
 * Boxes are drawn + dragged in-scene by three/ColliderEditor.tsx.
 */
export function ColliderEditorPanel() {
  const { boxes, selected, add, remove, seedFromDerived, clear } = useColliderEdit()
  const [copied, setCopied] = useState(false)

  const fmt = (b: BoxCollider) =>
    `  { minX: ${round(b.minX)}, maxX: ${round(b.maxX)}, minZ: ${round(b.minZ)}, maxZ: ${round(b.maxZ)} },`
  const snippet = `export const MANUAL_COLLIDERS: BoxCollider[] = [\n${boxes.map(fmt).join('\n')}\n]`

  const copy = () => {
    // Always log — the guaranteed path if the clipboard API is blocked (some
    // embedded/headless browsers deny writeText); grab it from the console then.
    // eslint-disable-next-line no-console
    console.log(snippet)
    navigator.clipboard?.writeText(snippet).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  const sel = selected != null ? boxes[selected] : null

  return (
    <div style={S.panel}>
      <div style={S.title}>▦ Collision editor</div>
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
        <button style={S.btnAlt} onClick={seedFromDerived}>
          Seed town.glb
        </button>
        <button style={S.btnAlt} onClick={() => confirm('Clear all boxes?') && clear()}>
          Clear all
        </button>
      </div>

      <button style={S.copy} onClick={copy}>
        {copied ? 'Copied ✓ — paste into colliders.data.ts' : 'Copy JSON'}
      </button>
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
  title: { fontSize: 12, fontWeight: 600, letterSpacing: 0.3, marginBottom: 6 },
  hint: { fontSize: 10, opacity: 0.6, lineHeight: 1.4, marginBottom: 8 },
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
  copy: {
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
}
