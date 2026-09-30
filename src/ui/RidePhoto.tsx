import { useEffect, useRef, useState } from 'react'

type Shot = { id: number; src: string; caption?: string; out: boolean }

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const

/**
 * The photo Leonard is talking about on a ride, projected as a hologram in the
 * road between the riders and the speech box — the personal site's glass
 * (iridescent rim, scanlines, float). One photo at a time.
 * A new photo tilts in while the old one dissolves; no photo clears it.
 * A click glitches it up to fill the screen (an overlay; the ride carries on
 * under it). Blown up, it gets + marks on its corners — the personal site's —
 * that all turn to × when one is hovered; clicking one, clicking outside the
 * photo, or Esc glitches it back down.
 */
export function RidePhoto({
  src,
  caption,
  expanded = false,
  onExpand,
  onCollapse,
}: {
  src?: string
  caption?: string
  expanded?: boolean
  onExpand?: () => void
  onCollapse?: () => void
}) {
  const [shots, setShots] = useState<Shot[]>([])
  const seq = useRef(0)
  // Which glitch is playing: 'open' / 'close', cleared when it ends. Flipping
  // between the two names restarts it even mid-glitch.
  const [fx, setFx] = useState<'open' | 'close' | null>(null)
  const wasExpanded = useRef(expanded)
  useEffect(() => {
    if (wasExpanded.current === expanded) return
    wasExpanded.current = expanded
    setFx(expanded ? 'open' : 'close')
  }, [expanded])

  useEffect(() => {
    setShots((s) => {
      if (s.find((x) => !x.out)?.src === src) return s
      const leaving = s.map((x) => ({ ...x, out: true }))
      return src ? [...leaving, { id: ++seq.current, src, caption, out: false }] : leaving
    })
  }, [src, caption])

  const drop = (id: number) => setShots((s) => s.filter((x) => x.id !== id))

  // Esc takes it back down (the speech box is paused while it's up, so Esc
  // doesn't also leave the ride).
  const collapseRef = useRef(onCollapse)
  collapseRef.current = onCollapse
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      collapseRef.current?.()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [expanded])

  return (
    <>
      {/* Dims the ride; a click outside the photo closes it (and never reaches
          the speech box). */}
      {expanded && <div className="ride-photo-scrim" aria-hidden onClick={onCollapse} />}
      <div className={`ride-photo${expanded ? ' is-expanded' : ''}`} aria-live="polite">
        {shots.map((shot) => (
          <figure
            key={shot.id}
            className={`ride-photo__card${shot.out ? ' is-out' : ''}`}
            onAnimationEnd={(e) => {
              if (shot.out && e.target === e.currentTarget) drop(shot.id)
            }}
            onClick={!shot.out && !expanded ? onExpand : undefined}
          >
            <div
              className={`ride-photo__glitch${!shot.out && fx ? ` is-${fx}` : ''}`}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setFx(null)
              }}
            >
              <div className="ride-photo__float">
                <img src={shot.src} alt={shot.caption ?? ''} draggable={false} />
                {shot.caption && <figcaption>{shot.caption}</figcaption>}
                {expanded &&
                  !shot.out &&
                  CORNERS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`ride-photo__corner ride-photo__corner--${c}`}
                      aria-label="Close photo"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCollapse?.()
                      }}
                    />
                  ))}
              </div>
            </div>
          </figure>
        ))}
      </div>
    </>
  )
}
