import type { CSSProperties } from 'react'
import { useTalkEdit } from '../state/talkEdit'

/**
 * Dev toolbar for `?talk`. The circles are in the scene; this lists whose
 * circle is selected and how big it is.
 */
export function TalkRangePanel() {
  const entries = useTalkEdit((s) => s.entries)
  const selected = useTalkEdit((s) => s.selected)

  const sel = entries.find((e) => e.id === selected)

  return (
    <div style={S.panel}>
      <div style={S.title}>Talk range</div>
      <div style={S.hint}>
        Cyan circle is where E starts the chat. Drag a yellow handle to resize. The prompt updates
        as you drag.
      </div>
      <div style={S.stat}>
        {sel ? `${sel.name} · radius ${sel.radius}` : 'Click a circle to select it'}
      </div>
    </div>
  )
}

const mono = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const S: Record<string, CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 12,
    left: 12,
    width: 260,
    padding: 10,
    background: 'rgba(20, 26, 34, 0.88)',
    backdropFilter: 'blur(8px)',
    borderRadius: 10,
    border: '1px solid rgba(32, 207, 255, 0.35)',
    color: '#e7f0ff',
    font: `11px ${mono}`,
    zIndex: 50,
    userSelect: 'none',
    pointerEvents: 'auto',
  },
  title: { fontSize: 12, fontWeight: 600, letterSpacing: 0.3 },
  hint: { fontSize: 10, opacity: 0.7, lineHeight: 1.4, margin: '8px 0' },
  stat: {
    padding: '4px 6px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 6,
    fontSize: 11,
  },
}
