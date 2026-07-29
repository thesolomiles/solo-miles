import type { Metadata } from 'next'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { CyclingActiveRideProvider } from '@/components/cycling/cycling-active-ride-context'
import { CyclingMapBackground } from '@/components/cycling/cycling-map-background'
import { CyclingSplit } from '@/components/cycling/cycling-split'

export const metadata: Metadata = {
  title: 'Cycling — Solomiles',
  description: "Rides logged as I get to them, mostly up mountains across Japan and Korea.",
}

export default function CyclingPage() {
  return (
    <CyclingActiveRideProvider>
      <div className="relative grid h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
        <CyclingMapBackground />

        <SiteNav />

        <main className="pointer-events-none relative flex min-h-0 flex-col items-start overflow-hidden px-5 pt-6 pb-6 sm:px-8 sm:pt-8">
          <CyclingSplit />
        </main>

        <SiteFooter showCoords={false} />
      </div>
    </CyclingActiveRideProvider>
  )
}
