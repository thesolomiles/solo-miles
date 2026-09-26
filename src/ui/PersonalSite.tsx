import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useGame } from '../state/store'
import { SITE } from '../config/site'
import { playWorldSfx } from './worldSfx'

/** Open / close stings (the world selector's), mounted for the HUD's life so
 *  the close still plays as the window unmounts. */
export function usePersonalSiteSfx() {
  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (s.siteOpen === prev.siteOpen) return
      playWorldSfx(s.siteOpen ? 'open' : 'close')
    })
  }, [])
}

type PageId = keyof typeof SITE.placeholders

/** A page laid straight over the hologram, Ex Machina style: a short intro. (Its fields sit top right — see PageFields.) No
 *  panels — the character stays fully visible behind the text. */
function Page({ id }: { id: PageId }) {
  const p = SITE.placeholders[id]
  return (
    <div className="site__ph">
      {p.intro.length > 0 && (
        <div className="site__phIntro">
          {p.intro.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {id === 'career' && <Jobs />}
    </div>
  )
}

/** Career: one row per company. Click to expand its years, title and
 *  description; opening one closes the others. */
function Jobs() {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <ol className="site__jobs">
      {SITE.jobs.map((j, i) => {
        const isOpen = open === i
        return (
          <li key={j.company} className={'site__jobRow' + (isOpen ? ' is-open' : '')}>
            <button
              className="site__jobName"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
            >
              <span className="site__jobIdx">{String(i + 1).padStart(2, '0')}</span>
              {j.company}
              <span className="site__jobSign" aria-hidden />
            </button>
            {/* grid-rows 0fr → 1fr animates the height */}
            <div className="site__jobBody">
              <div>
                {j.roles.map((r) => (
                  <div key={r.title + r.when} className="site__jobRole">
                    <div className="site__jobWhen">{r.when}</div>
                    <div className="site__jobTitle">{r.title}</div>
                    <p className="site__jobDesc">{r.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** The page's label/value fields, pinned to the top right of the window
 *  (level with the top link). On About they're the bio, tied to the body by
 *  the leader line (BioLeader). */
const PageFields = forwardRef<HTMLDListElement, { id: PageId }>(function PageFields({ id }, ref) {
  if (!SITE.placeholders[id].fields.length) return null
  return (
    <dl className="site__phFields" ref={ref}>
      {SITE.placeholders[id].fields.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
})

/** Front-view image box inside the page (layout px, ignoring the float and
 *  entrance transforms). On About the figure always settles at the page's
 *  centre, so use that rather than its live `left`, which may still be
 *  sliding back from Career's position. */
const FIG_PAD = 26
function figureBox(page: HTMLElement, fig: HTMLElement) {
  const h = fig.offsetHeight - FIG_PAD
  const w = (h * SITE.figures.front.w) / SITE.figures.front.h
  return { left: page.clientWidth / 2 - w / 2, top: fig.offsetTop, w, h }
}

/** The bio callout: a dot on Leonard's chest, a leader line up to the fields
 *  block, and a bracket down its left edge. Measured from layout (not the
 *  animated boxes) and re-measured on resize. */
function BioLeader({
  pageRef,
  figRef,
  fieldsRef,
}: {
  pageRef: React.RefObject<HTMLDivElement | null>
  figRef: React.RefObject<HTMLDivElement | null>
  fieldsRef: React.RefObject<HTMLDListElement | null>
}) {
  const [g, setG] = useState<{ x0: number; y0: number; ex: number; bx: number; by0: number; by1: number } | null>(null)
  useLayoutEffect(() => {
    const page = pageRef.current
    const measure = () => {
      const fig = figRef.current
      const f = fieldsRef.current
      if (!page || !fig || !f) return
      const b = figureBox(page, fig)
      const bx = f.offsetLeft - 14
      const by0 = f.offsetTop + 4
      const by1 = f.offsetTop + f.offsetHeight - 4
      const x0 = b.left + b.w * 0.62
      const y0 = b.top + b.h * 0.4
      // Elbow: rise diagonally to the bracket's middle, then run flat into it.
      const ex = Math.max(x0 + 10, bx - 28)
      setG({ x0, y0, ex, bx, by0, by1 })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (page) ro.observe(page)
    return () => ro.disconnect()
  }, [pageRef, figRef, fieldsRef])
  if (!g) return null
  const mid = (g.by0 + g.by1) / 2
  return (
    <svg className="site__leader" aria-hidden>
      <path className="site__leaderLine" pathLength={1} d={`M${g.x0} ${g.y0} L${g.ex} ${mid} L${g.bx} ${mid}`} />
      <path className="site__leaderBracket" pathLength={1} d={`M${g.bx} ${g.by0} L${g.bx} ${g.by1}`} />
      <circle className="site__leaderDot" cx={g.x0} cy={g.y0} r={4} />
    </svg>
  )
}

/** The + grid (3 × 3, like the reference poster), in % of the page. */
const PLUS_X = [8, 50, 92]
const PLUS_Y = [26, 46, 66]

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>_+#'

/** Text that briefly scrambles, then resolves left to right. Mono font, so
 *  the width never jitters. Re-runs whenever `run` changes. */
function useScramble(text: string, run: number) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    if (!run) return
    let frame = 0
    const total = 14
    const id = window.setInterval(() => {
      frame++
      const done = Math.floor((frame / total) * text.length)
      setOut(
        [...text]
          .map((ch, i) => (ch === ' ' || i < done ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0]))
          .join(''),
      )
      if (frame >= total) {
        window.clearInterval(id)
        setOut(text)
      }
    }, 28)
    return () => window.clearInterval(id)
  }, [text, run])
  return out
}

function SiteLink({
  label,
  className,
  style,
  onClick,
  active,
}: {
  label: string
  className: string
  style: CSSProperties
  onClick: () => void
  active: boolean
}) {
  const [run, setRun] = useState(0)
  const text = useScramble(label, run)
  return (
    <button
      className={className}
      style={style}
      onClick={() => {
        setRun((r) => r + 1)
        onClick()
      }}
      onPointerEnter={() => setRun((r) => r + 1)}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      <span aria-hidden>{text}</span>
    </button>
  )
}
const N = SITE.sections.length
const STAGGER = 0.06 // s between links moving together
const TURN_MS = 700 // the fake turn — same length as the slide across (index.css)
const MBLUR_PX = 16 // peak horizontal blur

/**
 * Leonard's personal site in a fake browser window — opened from the home's
 * work desk (HOME.looks.desk → outcome 'openSite'). Holographic glass over the
 * room, one tab, no address bar. Only the red dot does anything (closes); Esc
 * (Hud) and clicking outside close it too. Nothing links out of the game.
 *
 * Home is just the low-poly Leonard hologram and the section links, stacked
 * bottom left. Opening link k slides links 0…k up to a stack at the top left
 * (the rest stay down); its page's text sits right over the hologram (which
 * stays put) in the gap between the stacks. Clicking an earlier link sends the later ones back down;
 * clicking the open one again goes home.
 */
export function PersonalSite() {
  const close = useGame((s) => s.closeSite)
  // Index of the open section, or -1 for home.
  const [k, setK] = useState(-1)
  const prevK = useRef(-1)

  const open = (i: number) => {
    prevK.current = k
    setK(i === k ? -1 : i)
  }
  const current = k >= 0 ? SITE.sections[k] : null
  const goingUp = k > prevK.current

  // Career shows the ¾ view. It isn't a 3D model, so the turn is faked with
  // a horizontal motion blur (an SVG blur, x only) that swells while he slides
  // across, swaps the image at its peak, and settles back to sharp.
  const wantAngle = current?.id === 'career'
  const [angle, setAngle] = useState(false)
  const angleRef = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const blurRef = useRef<SVGFEGaussianBlurElement>(null)
  useEffect(() => {
    if (wantAngle === angleRef.current) return
    const body = bodyRef.current
    const blur = blurRef.current
    let raf = 0
    let swapped = false
    const t0 = performance.now()
    if (body) body.style.filter = 'url(#site-mblur)'
    const step = (now: number) => {
      const t = Math.min((now - t0) / TURN_MS, 1)
      const k = Math.sin(Math.PI * t) // 0 → 1 → 0
      blur?.setAttribute('stdDeviation', `${(k * MBLUR_PX).toFixed(2)} 0`)
      if (body) body.style.opacity = String(1 - 0.35 * k)
      if (!swapped && t >= 0.5) {
        swapped = true
        angleRef.current = wantAngle
        setAngle(wantAngle)
      }
      if (t < 1) raf = requestAnimationFrame(step)
      else if (body) body.style.filter = ''
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      blur?.setAttribute('stdDeviation', '0 0')
      if (body) {
        body.style.filter = ''
        body.style.opacity = ''
      }
    }
  }, [wantAngle])
  const fig = angle ? SITE.figures.angle : SITE.figures.front

  const pageRef = useRef<HTMLDivElement>(null)
  const figRef = useRef<HTMLDivElement>(null)
  const fieldsRef = useRef<HTMLDListElement>(null)
  // Height/weight show while the pointer is over Leonard (About only); a tap
  // toggles it on touch screens.
  const [measure, setMeasure] = useState(false)
  const about = current?.id === 'about'
  useEffect(() => {
    if (!about) setMeasure(false)
  }, [about])
  const overFigure = (x: number, y: number) => {
    const fig = figRef.current
    if (!fig) return false
    const r = fig.getBoundingClientRect()
    const h = r.height - FIG_PAD
    const w = (h * 311) / 848
    const cx = r.left + r.width / 2
    return x >= cx - w / 2 && x <= cx + w / 2 && y >= r.top && y <= r.top + h
  }

  return (
    <div className="site" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="site__win" role="dialog" aria-label={SITE.tabTitle}>
        <div className="site__chrome">
          <div className="site__dots">
            <button className="site__dot site__dot--red" onClick={close} aria-label="Close" />
            <span className="site__dot site__dot--yellow" />
            <span className="site__dot site__dot--green" />
          </div>
          <div className="site__tab">
            <span className="site__favicon">L</span>
            <span className="site__tabtitle">
              {current ? `${current.label} · ${SITE.tabTitle}` : SITE.tabTitle}
            </span>
          </div>
        </div>

        <div
          ref={pageRef}
          className={'site__page' + (current ? ' is-open' : '') + (measure ? ' is-measure' : '')}
          data-page={current?.id}
          style={{ '--n': N, '--k': Math.max(k, 0) } as CSSProperties}
          onPointerMove={(e) => {
            if (!about || e.pointerType !== 'mouse') return
            const over = overFigure(e.clientX, e.clientY)
            if (over !== measure) setMeasure(over)
          }}
          onPointerLeave={() => setMeasure(false)}
          onPointerUp={(e) => {
            if (about && e.pointerType !== 'mouse' && overFigure(e.clientX, e.clientY)) setMeasure((m) => !m)
          }}
        >
          {/* x-only blur for the fake turn (stdDeviation animated in JS) */}
          <svg className="site__defs" aria-hidden>
            <filter id="site-mblur" x="-60%" width="220%" y="0" height="100%">
              <feGaussianBlur ref={blurRef} stdDeviation="0 0" />
            </filter>
          </svg>
          <div className="site__figure" ref={figRef}>
            <div className="site__pad" />
            <div className="site__body" ref={bodyRef}>
              <img src={fig.src} alt="Low-poly Leonard" draggable={false} style={{ aspectRatio: `${fig.w} / ${fig.h}` }} />
              <div className="site__scan" style={{ WebkitMaskImage: `url(${fig.src})`, maskImage: `url(${fig.src})` }} />
            </div>
            {/* Height + weight: a dimension line that draws in on hover (About). */}
            <div className="site__annot" aria-hidden>
              <div className="site__dim">
                <span className="site__dimLabel">
                  <span>H · {SITE.measurements.height}</span>
                  <span>W · {SITE.measurements.weight}</span>
                </span>
              </div>
            </div>
          </div>

          {PLUS_Y.flatMap((y) =>
            PLUS_X.map((x) => (
              <i key={x + '-' + y} className="site__plus" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden />
            )),
          )}

          <div className="site__sig">
            <div className="site__sigMeta" aria-hidden>
              <span className="site__sigLive" />ONLINE<span>//</span>ID_LG-26
            </div>
            <div className="site__sigName">
              {SITE.signature.name}
              <span className="site__caret" aria-hidden />
            </div>
            <div className="site__sigRule" aria-hidden />
            <p className="site__sigLine">{SITE.signature.line}</p>
          </div>

          {SITE.sections.map((s, i) => {
            // Stagger the links that move together: bottom-up when rising,
            // top-down when falling, so the stack peels off in order.
            const delay = goingUp ? (i - (prevK.current + 1)) * STAGGER : (prevK.current - i) * STAGGER
            return (
              <SiteLink
                key={s.id}
                label={s.label}
                className={'site__link' + (i <= k ? ' is-up' : '') + (i === k ? ' is-active' : '')}
                style={{ '--i': i, '--delay': `${Math.max(delay, 0)}s` } as CSSProperties}
                onClick={() => open(i)}
                active={i === k}
              />
            )
          })}

          {current && (
            <div className="site__content" key={current.id}>
              <Page id={current.id} />
            </div>
          )}
          {current && <PageFields key={'f-' + current.id} id={current.id} ref={fieldsRef} />}
          {about && <BioLeader key="leader" pageRef={pageRef} figRef={figRef} fieldsRef={fieldsRef} />}
        </div>
      </div>
    </div>
  )
}
