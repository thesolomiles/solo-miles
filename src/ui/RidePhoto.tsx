import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Shot = { id: number; srcs: string[]; caption?: string; out: boolean }

/**
 * The photo Leonard is talking about on a ride, projected as a hologram in the
 * road between the riders and the speech box — the personal site's glass
 * (iridescent rim, scanlines, float).
 * New photos tilt in while the old ones dissolve; photos brought up together
 * sit side by side in one frame. No photos clears it.
 */
export function RidePhoto({ srcs, caption }: { srcs?: string[]; caption?: string }) {
  const key = srcs?.join('|') ?? ''
  const [shots, setShots] = useState<Shot[]>([])
  const seq = useRef(0)

  useEffect(() => {
    setShots((s) => {
      if ((s.find((x) => !x.out)?.srcs.join('|') ?? '') === key) return s
      const leaving = s.map((x) => ({ ...x, out: true }))
      return key ? [...leaving, { id: ++seq.current, srcs: key.split('|'), caption, out: false }] : leaving
    })
  }, [key, caption])

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
          <div className="ride-photo__float" style={{ '--n': shot.srcs.length } as CSSProperties}>
            <div className="ride-photo__row">
              {shot.srcs.map((src) => (
                <img key={src} src={src} alt={shot.caption ?? ''} draggable={false} />
              ))}
            </div>
            {shot.caption && <figcaption>{shot.caption}</figcaption>}
          </div>
        </figure>
      ))}
    </div>
  )
}
