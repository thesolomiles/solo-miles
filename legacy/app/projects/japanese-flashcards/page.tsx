import type { Metadata } from 'next'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { TopoActiveMountainProvider } from '@/components/home/topo-active-context'
import { TopoBackground } from '@/components/home/topo-background'
import { ChooseDeck } from '@/components/flashcards/choose-deck'
import { MOUNTAINS } from '@/lib/mountains'

export const metadata: Metadata = {
  title: 'Choose a Deck — Japanese Flashcards — Solomiles',
  description: 'Pick a JLPT level and a deck of N5 verb conjugations to study.',
}

export default function ChooseDeckPage() {
  return (
    <TopoActiveMountainProvider count={MOUNTAINS.length}>
      <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
        <TopoBackground />

        <SiteNav />

        <main className="relative flex flex-col items-center justify-center px-5 py-16 sm:px-8">
          <ChooseDeck />
        </main>

        <SiteFooter />
      </div>
    </TopoActiveMountainProvider>
  )
}
