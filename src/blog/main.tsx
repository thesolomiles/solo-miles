import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ROUTES, type Route } from '../config/worlds'
import { BlogBrowser } from './BlogBrowser'
import { RideLog } from './RideLog'
import './blog.css'

/**
 * The ride logs (/blog/) — a streaming-style browse page (BlogBrowser): top
 * nav, the highlighted ride as the hero, every ride in a row along the bottom.
 * Picking one opens its mini blog. The open log is in the URL hash
 * (/blog/index.html#<route-id>), so a log can be linked, and Back closes it.
 */

const fromHash = () => ROUTES[decodeURIComponent(location.hash.slice(1))] ?? null

function Blog() {
  const [open, setOpen] = useState<Route | null>(fromHash)
  const initialId = useRef(open?.id).current

  useEffect(() => {
    const sync = () => setOpen(fromHash())
    addEventListener('popstate', sync)
    return () => removeEventListener('popstate', sync)
  }, [])

  const read = (r: Route) => {
    history.pushState({ log: true }, '', '#' + r.id)
    setOpen(r)
  }
  const closeLog = () => {
    // Opened from the picker: step back. Landed straight on a log: just drop the hash.
    if (history.state?.log) history.back()
    else {
      history.replaceState(null, '', location.pathname)
      setOpen(null)
    }
  }
  const toTown = () => (location.href = '/')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (open) closeLog()
      else toTown()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <BlogBrowser onRead={read} onHome={toTown} initialId={initialId} paused={!!open} />
      {open && <RideLog key={open.id} route={open} onClose={closeLog} />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Blog />
  </StrictMode>,
)
