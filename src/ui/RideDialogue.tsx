import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../state/store'
import { ACTORS } from '../config/town'
import { ROUTES, SHOW_BLOG, routeScript } from '../config/worlds'
import { RIDE_OUTRO_LINE } from '../config/ride'
import { SpeechBox } from './SpeechBox'
import { RidePhoto } from './RidePhoto'

/** A line that brings up a new photo waits this long for it to land before
 *  the text starts: image, then words. */
const PHOTO_LEAD_MS = 450

const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/** Town Leonard — same name, role and bust as the roadside talk. */
const leonard = ACTORS.rider.interact

/**
 * Leonard's ride chat. Same speech box as town talk; a press finishes the
 * chunk on screen, then advances the route script. Past the closing line the
 * ride ends and fades back to town (store.advanceRide).
 */
export function RideDialogue() {
  const ride = useGame((s) => s.ride)
  const rideLine = useGame((s) => s.rideLine)
  const route = ride ? ROUTES[ride] : null
  const lines = useMemo(
    () => (route ? [...routeScript(route), { say: RIDE_OUTRO_LINE, photos: null }] : []),
    [route],
  )
  const line = lines[rideLine]

  // The photos up now: the latest brought up at or before this line (they hold
  // until the next; null takes them down).
  const shot = useMemo(() => {
    for (let i = rideLine; i >= 0; i--) {
      const l = lines[i]
      if (l && l.photos !== undefined) return l.photos?.length ? l : null
    }
    return null
  }, [lines, rideLine])

  // Image first, then text: a line that brings up photos holds its words back
  // until they've tilted in.
  const leadsWithPhoto = !!line?.photos?.length
  const [readyLine, setReadyLine] = useState(-1)
  const ready = !leadsWithPhoto || readyLine === rideLine
  useEffect(() => {
    if (!leadsWithPhoto) return
    const t = window.setTimeout(() => setReadyLine(rideLine), PHOTO_LEAD_MS)
    return () => window.clearTimeout(t)
  }, [leadsWithPhoto, rideLine])
  const full = ready ? (line?.say ?? '') : ''

  // One photo at a time: a line with several shows its first.
  const photo = shot?.photos?.[0]

  // The photo blown up to fill the screen. The chat holds while it's open, and
  // a different photo (or none) always comes back in at normal size.
  const [zoomed, setZoomed] = useState<string | null>(null)
  const expanded = !!photo && zoomed === photo

  // Warm the cache so each photo is ready the moment he mentions it.
  useEffect(() => {
    for (const l of lines) if (l.photos?.[0]) new Image().src = l.photos[0]
  }, [lines])

  return (
    <>
      {/* Open the ride's blog post in a new tab (same-origin static file under
          public/blog/). Only shown when this route has a post; kept out of the
          speech box so its click doesn't advance the dialogue. */}
      {SHOW_BLOG && route?.blogPath && (
        <button
          className="ride-blog"
          type="button"
          title={`Read the ride log: ${route.place}`}
          onClick={() => window.open(route.blogPath, '_blank', 'noopener,noreferrer')}
        >
          <span className="ride-blog__icon" aria-hidden>📖</span>
          <span className="ride-blog__label">Read the log</span>
        </button>
      )}
      <RidePhoto
        src={photo}
        caption={shot?.caption}
        expanded={expanded}
        onExpand={() => setZoomed(photo ?? null)}
        onCollapse={() => setZoomed(null)}
      />
      <SpeechBox
        name={leonard.name}
        role={leonard.role || undefined}
        portrait={leonard.portrait}
        text={full}
        paused={expanded}
        onContinue={() => ready && useGame.getState().advanceRide()}
        onEscape={() => useGame.getState().requestRide(null)}
        hint={isTouch ? 'Tap to continue' : 'E / Space to continue · Esc to leave'}
      />
    </>
  )
}
