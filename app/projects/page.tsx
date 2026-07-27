import type { Metadata } from 'next'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { TopoActiveMountainProvider } from '@/components/home/topo-active-context'
import { TopoBackground } from '@/components/home/topo-background'
import { ProjectGrid } from '@/components/projects/project-grid'
import { ProjectsHero } from '@/components/projects/projects-hero'
import { MOUNTAINS } from '@/lib/mountains'

export const metadata: Metadata = {
  title: 'Side Projects — Solomiles',
  description: "Things that I've been building.",
}

export default function ProjectsPage() {
  return (
    <TopoActiveMountainProvider count={MOUNTAINS.length}>
      <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
        <TopoBackground />

        <SiteNav />

        <main className="relative flex flex-col items-center justify-center gap-7 px-5 py-16 sm:px-8">
          <div className="flex w-full max-w-page flex-col items-center gap-3.5">
            <ProjectsHero />
            <div className="mt-8 w-full">
              <ProjectGrid />
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </TopoActiveMountainProvider>
  )
}
