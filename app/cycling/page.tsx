import type { Metadata } from 'next'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { TopoActiveMountainProvider } from '@/components/home/topo-active-context'
import { TopoBackground } from '@/components/home/topo-background'
import { CyclingHero } from '@/components/cycling/cycling-hero'
import { CyclingSplit } from '@/components/cycling/cycling-split'
import { MOUNTAINS } from '@/lib/mountains'

export const metadata: Metadata = {
  title: 'Cycling — Solomiles',
  description: "Rides logged as I get to them, mostly up mountains across Japan and Korea.",
}

export default function CyclingPage() {
  return (
    <TopoActiveMountainProvider count={MOUNTAINS.length}>
      <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
        <TopoBackground />

        <SiteNav />

        <main className="relative flex flex-col items-center px-5 py-16 sm:px-8">
          <div className="flex w-full max-w-page flex-col">
            <CyclingHero />
            <CyclingSplit />
          </div>
        </main>

        <SiteFooter />
      </div>
    </TopoActiveMountainProvider>
  )
}
