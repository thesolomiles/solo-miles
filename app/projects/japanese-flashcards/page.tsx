import type { Metadata } from 'next'
import { FlashcardApp } from '@/components/flashcards/flashcard-app'

export const metadata: Metadata = {
  title: 'N5 Verb Flashcards — Solomiles',
  description: 'Study JLPT N5 verb conjugations — Godan, Ichidan, and irregular verbs.',
}

export default function JapaneseFlashcardsPage() {
  return <FlashcardApp />
}
