import { useEffect, useRef, useState } from 'react'

type Shot = { id: number; src: string; caption?: string; out: boolean }

/**
 * The photo Leonard is talking about on a ride, projected as a hologram beside
 * the speech box — the personal site's glass (iridescent rim, scanlines, float).
 * A new photo tilts in while the old one dissolves; a line without one clears it.
 */
export function RidePhoto({ src, caption }: { src?: string; caption?: string }) {
  const [shots, setShots] = useState<Shot[]>([])
  const seq = useRef(0)

  useEffect(() => {
    setShots((s) => {
      if (s.find((x) => !x.out)?.src === src) return s
      const leaving = s.map((x) => ({ ...x, out: true }))
      return src ? [...leaving, { id: ++seq.current, src, caption, out: false }] : leaving
    })
  }, [src, caption])

  const drop = (id: number) => setShots((s) => s.filter((x) => x.id !== id))

  return (
    <div className="ride-photo" aria-live="polite">
      {shots.map((shot) => (
        <figure
          key={shot.id}
          className={`ride-photo__card${shot.out ? ' is-out' : ''}`}
          onAnimationEnd={(e) => {
            if (shot.out && e.target === e.currentTarget) drop(shot.id)
          }}
        >
          <div className="ride-photo__float">
            <img src={shot.src} alt={shot.caption ?? ''} draggable={false} />
            {shot.caption && <figcaption>{shot.caption}</figcaption>}
          </div>
        </figure>
      ))}
    </div>
  )
}
