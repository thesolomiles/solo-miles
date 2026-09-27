import { useEffect, useMemo, useState } from 'react'
import { useGame } from '../state/store'
import { ACTORS } from '../config/town'
import { ROUTES, routeScript } from '../config/worlds'
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
    () => (route ? [...routeScript(route), { say: RIDE_OUTRO_LINE, photo: null }] : []),
    [route],
  )
  const line = lines[rideLine]

  // The photo up now: the latest one brought up at or before this line (a
  // photo holds until the next; null takes it down).
  const shot = useMemo(() => {
    for (let i = rideLine; i >= 0; i--) {
      const l = lines[i]
      if (l && l.photo !== undefined) return l.photo ? l : null
    }
    return null
  }, [lines, rideLine])

  // Image first, then text: a line that brings up a photo holds its words back
  // until the photo has tilted in.
  const leadsWithPhoto = !!line?.photo
  const [readyLine, setReadyLine] = useState(-1)
  const ready = !leadsWithPhoto || readyLine === rideLine
  useEffect(() => {
    if (!leadsWithPhoto) return
    const t = window.setTimeout(() => setReadyLine(rideLine), PHOTO_LEAD_MS)
    return () => window.clearTimeout(t)
  }, [leadsWithPhoto, rideLine])
  const full = ready ? (line?.say ?? '') : ''

  // Warm the cache so each photo is ready the moment he mentions it.
  useEffect(() => {
    for (const l of lines) if (l.photo) new Image().src = l.photo
  }, [lines])

  return (
    <>
      {/* Open the ride's blog post in a new tab (same-origin static file under
          public/blog/). Only shown when this route has a post; kept out of the
          speech box so its click doesn't advance the dialogue. */}
      {route?.blogPath && (
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
      <RidePhoto src={shot?.photo ?? undefined} caption={shot?.caption} />
      <SpeechBox
        name={leonard.name}
        role={leonard.role || undefined}
        portrait={leonard.portrait}
        text={full}
        onContinue={() => ready && useGame.getState().advanceRide()}
        onEscape={() => useGame.getState().requestRide(null)}
        hint={isTouch ? 'Tap to continue' : 'E / Space to continue · Esc to leave'}
      />
    </>
  )
}
