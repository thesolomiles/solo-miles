import { useMemo } from 'react'
import { useGame } from '../state/store'
import { ACTORS } from '../config/town'
import { ROUTES, routeScript } from '../config/worlds'
import { RIDE_OUTRO_LINE } from '../config/ride'
import { SpeechBox } from './SpeechBox'

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
  const lines = useMemo(() => (route ? [...routeScript(route), RIDE_OUTRO_LINE] : []), [route])
  const full = lines[rideLine] ?? ''

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
      <SpeechBox
        name={leonard.name}
        role={leonard.role || undefined}
        portrait={leonard.portrait}
        text={full}
        onContinue={() => useGame.getState().advanceRide()}
        onEscape={() => useGame.getState().requestRide(null)}
        hint={isTouch ? 'Tap to continue' : 'E / Space to continue · Esc to leave'}
      />
    </>
  )
}
