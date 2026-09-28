import { useEffect } from 'react'
import { useGame } from '../state/store'
import { SHOW_BLOG, type Route } from '../config/worlds'
import { RouteSelector } from './RouteSelector'
import { playWorldSfx } from './worldSfx'

/**
 * Open / close / pick stings. Mounted for the life of the HUD (not inside the
 * selector) so the close and pick sounds still fire as the modal unmounts.
 * Zustand's listener runs inside the click or key handler, so play() stays a
 * user gesture. Picking a route closes the selector in the same update as the
 * ride fade — that one plays the select sting instead of the close sting.
 */
export function useWorldSelectorSfx() {
  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (s.worldOpen === prev.worldOpen) return
      if (s.worldOpen) playWorldSfx('open')
      else if (s.transition?.kind === 'ride' && s.transition.to) playWorldSfx('select')
      else playWorldSfx('close')
    })
  }, [])
}

/** Every ride's log, in the /blog/ page's route picker (src/blog/). Named
 *  explicitly so dev's SPA fallback doesn't swallow the bare /blog/ path. */
const BLOG_INDEX = '/blog/index.html'
const openLogs = () => window.open(BLOG_INDEX, '_blank', 'noopener,noreferrer')

/**
 * The world selector — opens after you say "yes" to Leonard's ride. The shared
 * route picker (RouteSelector) with Enter = ride; L opens the ride logs in a new
 * tab; Esc (Hud) closes.
 */
export function WorldSelector() {
  const close = useGame((s) => s.closeWorld)
  const ride = (r: Route) => useGame.getState().requestRide(r.id)

  useEffect(() => {
    if (!SHOW_BLOG) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyL') return
      e.preventDefault()
      openLogs()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <RouteSelector
      label="Select a world"
      onPick={ride}
      pickLabel="Start ride"
      onBack={close}
      backLabel="Back to town"
      sfx
      hints={
        SHOW_BLOG && (
          <button type="button" className="wsel__hint-btn" onClick={openLogs}>
            <kbd>L</kbd> Ride logs
          </button>
        )
      }
    />
  )
}
