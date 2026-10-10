import { useEffect, useLayoutEffect, useRef } from 'react'
import { useGame } from '../state/store'
import { forestReveal, inspectForestLandmark, skipForestReveal, useForestEncounter } from '../state/forestEncounter'
import { isTypingTarget } from '../systems/input'
import { IS_MOBILE } from '../systems/device'
import { useForestOpening } from '../state/forestOpening'

export function ForestEncounterHud() {
  const phase = useForestEncounter((s) => s.phase)
  const stage = useForestEncounter((s) => s.stage)
  const nearby = useForestEncounter((s) => s.nearby)
  const dialogue = useGame((s) => s.dialogue)
  const transition = useGame((s) => s.transition)
  const showOpeningHint = useForestOpening((s) => s.showHint)
  const fadeRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    forestReveal.fadeElement = fadeRef.current
    if (fadeRef.current) fadeRef.current.style.opacity = String(forestReveal.opacity)
    return () => { forestReveal.fadeElement = null }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat && !isTypingTarget(e.target) && (e.code === 'KeyE' || e.code === 'Enter')) inspectForestLandmark()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const revealing = phase === 'reveal'
  const returning = stage === 'fade-back' || stage === 'black-back' || stage === 'return'
  const fading = revealing && stage !== 'hold' && stage !== 'story'
  return (
    <>
      {!dialogue && !transition && !revealing && showOpeningHint && (
        <div className="forest-lesson" aria-live="polite">
          <div className="forest-lesson__keys" aria-hidden="true">
            <span className="chint__key chint__key--wide">{IS_MOBILE ? 'JUMP' : 'SPACE'}</span>
            <span>then</span>
            <span className="chint__key chint__key--wide">{IS_MOBILE ? 'JUMP' : 'SPACE'}</span>
          </div>
          <span className="chint__label">JUMP AGAIN NEAR THE TOP</span>
        </div>
      )}
      {!dialogue && !transition && nearby && (phase === 'ready' || phase === 'complete') && (
        <button className="prompt prompt--show" onClick={inspectForestLandmark}>
          <span className="prompt__key">{IS_MOBILE ? '›' : 'E'}</span>
          <span>Inspect · <span className="prompt__name">Ancient remains</span></span>
        </button>
      )}
      {revealing && !transition && !returning && (
        <div className="forest-reveal" aria-label="Forest viewpoint">
          <button className="forest-reveal__skip" onClick={skipForestReveal}>
            Back to walk{!IS_MOBILE && <span> Esc</span>}
          </button>
        </div>
      )}
      <div ref={fadeRef} className={'forest-reveal__fade' + (fading ? ' forest-reveal__fade--active' : '')} aria-hidden="true" />
    </>
  )
}
