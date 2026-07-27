'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { KIND_META, KINDS, LEVELS, type Level } from '@/lib/jlpt-decks'

const LEVEL_NOTES: Record<Level, string> = {
  N5: 'Beginner',
  N4: 'Elementary',
  N3: 'Intermediate',
  N2: 'Upper',
  N1: 'Advanced',
}

export function ChooseDeck({ counts }: { counts: Record<Level, Record<string, number>> }) {
  const router = useRouter()
  const [level, setLevel] = useState<Level>('N5')

  return (
    <div className="flex w-full max-w-[640px] flex-col gap-11">
      <div className="flex flex-col gap-3">
        <Link
          href="/projects"
          className="flex w-fit items-center gap-2 text-[11px] tracking-[0.2em] text-ink-300 uppercase no-underline transition-colors hover:text-hivis-400"
        >
          <span>←</span>
          <span>Projects</span>
        </Link>
        <span className="text-[11px] tracking-[0.22em] text-hivis-400 uppercase">01 / Japanese Flashcards</span>
      </div>

      <div className="flex flex-col gap-4">
        <span className="text-[11px] tracking-[0.14em] text-ink-300 uppercase">Level</span>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => {
            const active = l === level
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={
                  'inline-flex items-center gap-2 rounded-[2px] border px-4 py-2.5 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors ' +
                  (active ? 'border-hivis-400 bg-hivis-400 text-void' : 'border-white/20 bg-white/[0.02] text-paper-000 hover:border-white/40')
                }
              >
                <span className="font-semibold">{l}</span>
                <span className="opacity-60">{LEVEL_NOTES[l]}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <span className="text-[11px] tracking-[0.14em] text-ink-300 uppercase">Type of cards</span>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {KINDS.map((kind) => {
            const meta = KIND_META[kind]
            const count = counts[level]?.[kind] ?? 0
            const ready = count > 0
            return ready ? (
              <button
                key={kind}
                type="button"
                onClick={() => router.push(`/projects/japanese-flashcards/${level.toLowerCase()}/${kind}`)}
                className="flex cursor-pointer flex-col items-start gap-2.5 rounded border border-white/20 bg-white/[0.02] p-4 text-left font-mono text-paper-000 transition-colors hover:bg-white/[0.06]"
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="font-display text-2xl leading-none font-extrabold tracking-[-0.02em]">{meta.glyph}</span>
                  <span className="text-[13px]">→</span>
                </span>
                <span className="text-[11px] tracking-[0.16em] uppercase">{meta.name}</span>
                <span className="text-[10px] tracking-[0.14em] tabular-nums uppercase opacity-60">{count} cards</span>
              </button>
            ) : (
              <div
                key={kind}
                aria-disabled
                className="flex cursor-not-allowed flex-col items-start gap-2.5 rounded border border-dashed border-white/15 p-4 text-left font-mono text-white/25"
              >
                <span className="flex w-full items-baseline justify-between gap-3">
                  <span className="font-display text-2xl leading-none font-extrabold tracking-[-0.02em]">{meta.glyph}</span>
                  <span className="text-[13px]">→</span>
                </span>
                <span className="text-[11px] tracking-[0.16em] uppercase">{meta.name}</span>
                <span className="text-[10px] tracking-[0.14em] uppercase opacity-60">Not built yet</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
