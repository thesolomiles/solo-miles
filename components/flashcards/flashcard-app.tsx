'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type UIEventHandler } from 'react'
import { DECKS, FORM_LABELS, type Deck } from '@/data/n5-verbs'
import { Button } from './button'
import { IconButton } from './icon-button'
import { Tag } from './tag'

const JP_SERIF = "'Hiragino Mincho ProN','Yu Mincho',serif"

const LEVELS = [
  { id: 'N5', blurb: 'Beginner — the first 800 words.' },
  { id: 'N4', blurb: 'Everyday conversation, 1500 words.' },
  { id: 'N3', blurb: 'Bridging to fluent reading.' },
  { id: 'N2', blurb: 'News, work, and long-form text.' },
  { id: 'N1', blurb: 'Academic and idiomatic Japanese.' },
] as const

type LevelId = (typeof LEVELS)[number]['id']

// Only N5 verbs are actually populated; other JLPT levels are shown in the
// picker (matching the source design's level switcher) but not built yet.
function decksForLevel(level: LevelId): Deck[] {
  if (level === 'N5') return DECKS
  return []
}

export function FlashcardApp() {
  const [level, setLevel] = useState<LevelId>('N5')
  const [deckSlug, setDeckSlug] = useState<string>(DECKS[0].slug)
  const [pickerOpen, setPickerOpen] = useState(false)

  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [known, setKnown] = useState(0)
  const [learning, setLearning] = useState(0)
  const [run, setRun] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)

  const deck = DECKS.find((d) => d.slug === deckSlug) ?? DECKS[0]
  const verbs = deck.verbs
  const total = verbs.length
  const done = i >= total
  const verb = verbs[Math.min(i, total - 1)]

  const flip = () => setFlipped((f) => !f)

  const advance = (knew: boolean) => {
    setI((n) => n + 1)
    setFlipped(false)
    setScrolled(false)
    if (knew) {
      setKnown((n) => n + 1)
      setRun((n) => n + 1)
    } else {
      setLearning((n) => n + 1)
      setRun(0)
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  const restart = () => {
    setI(0)
    setFlipped(false)
    setScrolled(false)
    setKnown(0)
    setLearning(0)
    setRun(0)
  }

  const selectDeck = (slug: string) => {
    setDeckSlug(slug)
    setPickerOpen(false)
    restart()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        flip()
      }
      if (e.key === 'ArrowRight') advance(true)
      if (e.key === 'ArrowLeft') advance(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckSlug, i])

  const onScroll: UIEventHandler<HTMLDivElement> = (e) => {
    if (!scrolled && e.currentTarget.scrollTop > 12) setScrolled(true)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--surface-page)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text-body)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
          gap: 16,
          borderLeft: '1px solid var(--line-hairline)',
          borderRight: '1px solid var(--line-hairline)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Image src="/solomiles/logo-horizontal-white.svg" alt="The Solomiles" width={140} height={22} style={{ height: 22, width: 'auto', display: 'block' }} />
          <div
            onClick={() => setPickerOpen((o) => !o)}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid var(--line-strong)',
              borderRadius: 'var(--radius-control)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--mono-sm)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-strong)',
            }}
          >
            <span>{level} · {deck.name}</span>
            <span
              style={{
                fontSize: 9,
                display: 'inline-block',
                transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform .18s cubic-bezier(.2,.8,.2,1)',
              }}
            >
              ▾
            </span>
          </div>
        </div>

        {pickerOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div
              onClick={() => setPickerOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'var(--surface-overlay)', backdropFilter: 'blur(3px)' }}
            />
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 430,
                background: 'var(--surface-card)',
                borderTop: '2px solid var(--hivis-400)',
                boxShadow: 'var(--shadow-overlay)',
                padding: '18px 20px calc(22px + env(safe-area-inset-bottom))',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                maxHeight: '86vh',
                animation: 'sheetUp .28s cubic-bezier(.2,.8,.2,1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, lineHeight: 0.95, letterSpacing: '-0.03em', textTransform: 'uppercase', color: 'var(--text-strong)' }}>
                    Pick a deck
                  </div>
                  <div style={{ fontSize: 'var(--body-sm)', lineHeight: 1.5, color: 'var(--text-muted)' }}>
                    {(LEVELS.find((l) => l.id === level) ?? LEVELS[0]).blurb}
                  </div>
                </div>
                <IconButton icon="x" label="Close" variant="outline" onClick={() => setPickerOpen(false)} />
              </div>

              <div className="sm-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
                {LEVELS.map((lvl) => {
                  const active = lvl.id === level
                  return (
                    <div
                      key={lvl.id}
                      onClick={() => setLevel(lvl.id)}
                      style={{
                        cursor: 'pointer',
                        flex: 'none',
                        padding: '7px 14px',
                        borderRadius: 'var(--radius-control)',
                        background: active ? 'var(--hivis-400)' : 'transparent',
                        color: active ? 'var(--ink-900)' : 'var(--text-muted)',
                        border: '1px solid ' + (active ? 'var(--hivis-400)' : 'var(--line-hairline)'),
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--mono-sm)',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      JLPT {lvl.id}
                    </div>
                  )
                })}
              </div>

              <div
                className="sm-scroll"
                style={{
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1,
                  background: 'var(--line-hairline)',
                  border: '1px solid var(--line-hairline)',
                }}
              >
                {(() => {
                  const levelDecks = decksForLevel(level)
                  const items = levelDecks.length > 0 ? levelDecks : [null]
                  return items.map((d, idx) => {
                    const ready = !!d
                    const active = ready && d!.slug === deckSlug
                    return (
                      <div
                        key={d ? d.slug : idx}
                        onClick={ready ? () => selectDeck(d!.slug) : undefined}
                        style={{
                          cursor: ready ? 'pointer' : 'default',
                          background: active ? 'var(--surface-raised)' : 'var(--surface-card)',
                          padding: 14,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                          minHeight: 120,
                          boxSizing: 'border-box',
                          opacity: ready ? 1 : 0.5,
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 2,
                            background: active ? 'var(--hivis-400)' : 'var(--surface-inverse)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: JP_SERIF,
                            fontSize: 24,
                            color: active ? 'var(--ink-900)' : 'var(--text-faint)',
                          }}
                        >
                          {ready ? d!.glyph : '動'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'auto' }}>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--heading-xs)', letterSpacing: '-0.015em', color: 'var(--text-strong)' }}>
                            {ready ? d!.name : 'Verbs'}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--mono-xs)',
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: active ? 'var(--clay-500)' : 'var(--text-faint)',
                            }}
                          >
                            {ready ? `${d!.verbs.length} cards` : 'Not built yet'}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>
        )}

        {done ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              textAlign: 'center',
              background: 'var(--surface-card)',
              border: '1px solid var(--line-hairline)',
              borderTop: '2px solid var(--hivis-400)',
              padding: '36px 26px',
              minHeight: 340,
            }}
          >
            <div
              className="sm-grain"
              style={{
                width: 96,
                height: 96,
                borderRadius: 2,
                background: 'var(--surface-inverse)',
                border: '1px solid var(--line-hairline)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--mono-xs)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--text-faint)',
                textAlign: 'center',
                padding: 8,
              }}
            >
              Mews<br />art TBD
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 26,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                textTransform: 'uppercase',
                color: 'var(--text-strong)',
                maxWidth: 260,
                textWrap: 'balance',
              }}
            >
              {run >= 3 ? 'Nice — you were on a roll' : 'That is the whole deck'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {known} known · {learning} still learning
            </div>
            <Button variant="accent" size="lg" iconRight="arrow-up-right" onClick={restart}>
              Go again
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
            <div style={{ perspective: 1400, height: 'clamp(340px,54vh,440px)', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  transformStyle: 'preserve-3d',
                  transition: 'transform .28s cubic-bezier(.2,.8,.2,1)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front */}
                <div
                  onClick={flip}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--line-hairline)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 16,
                    padding: '32px 24px',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-size)', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    English
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 42,
                      lineHeight: 0.92,
                      letterSpacing: '-0.03em',
                      textTransform: 'uppercase',
                      color: 'var(--text-strong)',
                      textWrap: 'balance',
                    }}
                  >
                    {verb.en}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Verb · JLPT {level}
                  </div>
                  <div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-xs)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                    Tap the card to flip it
                  </div>
                </div>

                {/* Back */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'var(--surface-card)',
                    border: '1px solid var(--line-hairline)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    ref={scrollRef}
                    className="sm-scroll"
                    onScroll={onScroll}
                    style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
                  >
                    <div
                      onClick={flip}
                      style={{
                        height: '100%',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '28px 24px 52px',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontFamily: JP_SERIF, fontSize: 15, letterSpacing: '0.04em', color: 'var(--clay-500)' }}>{verb.kana}</div>
                      <div style={{ fontFamily: JP_SERIF, fontSize: 50, lineHeight: 1.1, color: 'var(--text-strong)' }}>{verb.kanji}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-md)', color: 'var(--text-body)' }}>{verb.romaji}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                        <Tag tone="neutral" size="sm">{verb.group}</Tag>
                      </div>
                    </div>
                    <div style={{ padding: '0 22px 26px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, paddingBottom: 8, borderBottom: '2px solid var(--line-strong)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-size)', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Inflections
                        </div>
                        <div style={{ height: 1, flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {verb.forms.map(([jp, romaji], n) => (
                          <div
                            key={n}
                            style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--line-hairline)' }}
                          >
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', flex: 'none' }}>
                              {FORM_LABELS[n]}
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ fontFamily: JP_SERIF, fontSize: 21, lineHeight: 1.2, color: 'var(--text-strong)' }}>{jp}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-xs)', color: 'var(--text-faint)' }}>{romaji}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div onClick={flip} style={{ marginTop: 18, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-sm)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--clay-500)', cursor: 'pointer' }}>
                        Back to English
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 52,
                      pointerEvents: 'none',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      paddingBottom: 10,
                      background: 'linear-gradient(rgba(23,27,31,0), var(--surface-card) 70%)',
                      transition: 'opacity .18s',
                      opacity: flipped && !scrolled ? 1 : 0,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 'var(--mono-xs)',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        animation: 'nudge 2.4s ease-in-out infinite',
                      }}
                    >
                      Scroll for inflections ↓
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="accent" size="lg" block iconRight="arrow-up-right" onClick={() => advance(true)}>
                Next word
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
