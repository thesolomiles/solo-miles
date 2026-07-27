import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FlashcardApp } from '@/components/flashcards/flashcard-app'
import { DECKS } from '@/data/n5-decks'

export function generateStaticParams() {
  return DECKS.map((deck) => ({ deck: deck.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ deck: string }> }): Promise<Metadata> {
  const { deck: deckSlug } = await params
  const deck = DECKS.find((d) => d.slug === deckSlug)
  return {
    title: deck ? `${deck.name} — N5 Flashcards — Solomiles` : 'N5 Flashcards — Solomiles',
  }
}

export default async function DeckStudyPage({ params }: { params: Promise<{ deck: string }> }) {
  const { deck: deckSlug } = await params
  const deck = DECKS.find((d) => d.slug === deckSlug)
  if (!deck) notFound()

  return <FlashcardApp deckSlug={deck.slug} />
}
