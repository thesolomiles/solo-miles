'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, type UIEventHandler } from 'react'
import type { Card, Kind, Level } from '@/lib/jlpt-decks'
import { KIND_META } from '@/lib/jlpt-decks'
import { Button } from './button'
import { Tag } from './tag'

const JP_SERIF = "'Hiragino Mincho ProN','Yu Mincho',serif"
const BATCH_SIZE = 10

function shuffledIndices(length: number) {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Pick up to BATCH_SIZE random indices not already in `seen`. If fewer than
 * BATCH_SIZE cards remain unseen, the whole pool is "recycled" (seen is
 * effectively reset) so a session never just runs dry once a large pool has
 * been mostly explored. */
function pickBatch(poolSize: number, seen: Set<number>): number[] {
  const unseen = shuffledIndices(poolSize).filter((i) => !seen.has(i))
  if (unseen.length >= BATCH_SIZE) return unseen.slice(0, BATCH_SIZE)
  seen.clear()
  return shuffledIndices(poolSize).slice(0, Math.min(BATCH_SIZE, poolSize))
}

export function FlashcardApp({
  cards,
  formLabels,
  level,
  kind,
}: {
  cards: Card[]
  formLabels: string[]
  level: Level
  kind: Kind
}) {
  const kindMeta = KIND_META[kind]
  const seenRef = useRef<Set<number>>(new Set())
  // Math.random() can't run in the initial render (it runs once during SSR
  // and again during client hydration, producing two different "random"
  // batches and a hydration mismatch) — start with a deterministic batch
  // that matches on both server and client, then shuffle for real in an
  // effect that only ever runs on the client, after hydration.
  const [batch, setBatch] = useState<number[]>(() => Array.from({ length: Math.min(BATCH_SIZE, cards.length) }, (_, idx) => idx))

  useEffect(() => {
    const first = pickBatch(cards.length, seenRef.current)
    for (const idx of first) seenRef.current.add(idx)
    setBatch(first)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [known, setKnown] = useState(0)
  const [learning, setLearning] = useState(0)
  const [run, setRun] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)

  const done = i >= batch.length
  const card = done ? null : cards[batch[i]]

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

  const continueWithMore = () => {
    const next = pickBatch(cards.length, seenRef.current)
    for (const idx of next) seenRef.current.add(idx)
    setBatch(next)
    setI(0)
    setFlipped(false)
    setScrolled(false)
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
  }, [i])

  const onScroll: UIEventHandler<HTMLDivElement> = (e) => {
    if (!scrolled && e.currentTarget.scrollTop > 12) setScrolled(true)
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text-body)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 430,
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 20px calc(20px + env(safe-area-inset-bottom))',
          boxSizing: 'border-box',
          gap: 16,
          borderLeft: '1px solid var(--line-hairline)',
          borderRight: '1px solid var(--line-hairline)',
          background: 'var(--surface-overlay)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Image src="/solomiles/logo-horizontal-white.svg" alt="The Solomiles" width={140} height={22} style={{ height: 22, width: 'auto', display: 'block' }} />
          <Link
            href="/projects/japanese-flashcards"
            style={{
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
              textDecoration: 'none',
            }}
          >
            <span>←</span>
            <span>{level} · {kindMeta.name}</span>
          </Link>
        </div>

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
              {run >= 3 ? 'Nice — you were on a roll' : '10 down, keep going'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {known} known · {learning} still learning
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button variant="accent" size="lg" iconRight="arrow-up-right" onClick={continueWithMore}>
                Continue with 10 more
              </Button>
            </div>
            <Link
              href="/projects/japanese-flashcards"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              Switch deck
            </Link>
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
                    {card!.en}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {kindMeta.singular} · JLPT {level}
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
                      <div style={{ fontFamily: JP_SERIF, fontSize: 15, letterSpacing: '0.04em', color: 'var(--clay-500)' }}>{card!.kana}</div>
                      <div style={{ fontFamily: JP_SERIF, fontSize: 50, lineHeight: 1.1, color: 'var(--text-strong)' }}>{card!.kanji}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-md)', color: 'var(--text-body)' }}>{card!.romaji}</div>
                      {card!.group && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                          <Tag tone="neutral" size="sm">{card!.group}</Tag>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '0 22px 26px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, paddingBottom: 8, borderBottom: '2px solid var(--line-strong)' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--label-size)', letterSpacing: 'var(--label-tracking)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          Inflections
                        </div>
                        <div style={{ height: 1, flex: 1 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {card!.forms.map(([jp, romaji], n) => (
                          <div
                            key={n}
                            style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--line-hairline)' }}
                          >
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--mono-xs)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', flex: 'none' }}>
                              {formLabels[n]}
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
