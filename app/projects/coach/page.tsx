import type { Metadata } from 'next'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { TopoActiveMountainProvider } from '@/components/home/topo-active-context'
import { TopoBackground } from '@/components/home/topo-background'
import { CoachProject } from '@/components/projects/coach-project'
import { MOUNTAINS } from '@/lib/mountains'

export const metadata: Metadata = {
  title: 'Training Coach — Solomiles',
  description: 'An AI cycling coach that syncs Strava and intervals.icu and messages me daily.',
}

export default function CoachProjectPage() {
  return (
    <TopoActiveMountainProvider count={MOUNTAINS.length}>
      <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
        <TopoBackground />

        <SiteNav />

        <main className="relative flex flex-col items-center justify-center px-5 py-16 sm:px-8">
          <CoachProject />
        </main>

        <SiteFooter />
      </div>
    </TopoActiveMountainProvider>
  )
}
