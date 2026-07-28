'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { OptionTile } from '@/components/controls/option-tile'
import { SegmentedControl } from '@/components/controls/segmented-control'
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
        <SegmentedControl
          options={LEVELS.map((l) => ({ value: l, label: l, note: LEVEL_NOTES[l] }))}
          value={level}
          onChange={setLevel}
        />
      </div>

      <div className="flex flex-col gap-4">
        <span className="text-[11px] tracking-[0.14em] text-ink-300 uppercase">Type of cards</span>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {KINDS.map((kind) => {
            const meta = KIND_META[kind]
            const count = counts[level]?.[kind] ?? 0
            const ready = count > 0
            return (
              <OptionTile
                key={kind}
                glyph={meta.glyph}
                title={meta.name}
                subtitle={ready ? `${count} cards` : 'Not built yet'}
                disabled={!ready}
                onClick={() => router.push(`/projects/japanese-flashcards/${level.toLowerCase()}/${kind}`)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
