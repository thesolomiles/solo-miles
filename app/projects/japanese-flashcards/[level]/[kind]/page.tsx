import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FlashcardApp } from '@/components/flashcards/flashcard-app'
import { TopoActiveMountainProvider } from '@/components/home/topo-active-context'
import { TopoBackground } from '@/components/home/topo-background'
import { isKind, isLevel, KIND_META, LEVELS, KINDS } from '@/lib/jlpt-decks'
import { getCards, getFormLabels } from '@/lib/jlpt-decks-server'
import { MOUNTAINS } from '@/lib/mountains'

export function generateStaticParams() {
  return LEVELS.flatMap((level) => KINDS.map((kind) => ({ level: level.toLowerCase(), kind })))
}

export async function generateMetadata({ params }: { params: Promise<{ level: string; kind: string }> }): Promise<Metadata> {
  const { level: levelParam, kind } = await params
  const level = levelParam.toUpperCase()
  if (!isLevel(level) || !isKind(kind)) return { title: 'Flashcards — Solomiles' }
  return { title: `${level} ${KIND_META[kind].name} — Flashcards — Solomiles` }
}

export default async function DeckStudyPage({ params }: { params: Promise<{ level: string; kind: string }> }) {
  const { level: levelParam, kind } = await params
  const level = levelParam.toUpperCase()
  if (!isLevel(level) || !isKind(kind)) notFound()

  const [cards, formLabels] = await Promise.all([getCards(level, kind), getFormLabels(kind)])
  if (cards.length === 0) notFound()

  return (
    <TopoActiveMountainProvider count={MOUNTAINS.length}>
      <div className="relative min-h-screen overflow-hidden bg-void">
        <TopoBackground />
        <FlashcardApp cards={cards} formLabels={formLabels} level={level} kind={kind} />
      </div>
    </TopoActiveMountainProvider>
  )
}
