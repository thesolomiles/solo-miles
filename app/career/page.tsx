import type { Metadata } from 'next'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { TopoActiveMountainProvider } from '@/components/home/topo-active-context'
import { TopoBackground } from '@/components/home/topo-background'
import { CareerEducation } from '@/components/career/career-education'
import { CareerExperience } from '@/components/career/career-experience'
import { CareerHero } from '@/components/career/career-hero'
import { CareerSkills } from '@/components/career/career-skills'
import { CareerStats } from '@/components/career/career-stats'
import { MOUNTAINS } from '@/lib/mountains'

export const metadata: Metadata = {
  title: 'My Career — Solomiles',
  description: 'Twelve years in practice — six roles, five companies, all in Singapore.',
}

export default function CareerPage() {
  return (
    <TopoActiveMountainProvider count={MOUNTAINS.length}>
      <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
        <TopoBackground />

        <SiteNav />

        <main className="relative flex flex-col items-center px-5 py-16 sm:px-8">
          <div className="flex w-full max-w-page flex-col">
            <CareerHero />
            <CareerStats />
            <CareerExperience />

            <div className="grid grid-cols-1 gap-10 pt-16 sm:pt-20 lg:grid-cols-2 lg:gap-14">
              <CareerEducation />
              <CareerSkills />
            </div>
          </div>
        </main>

        <SiteFooter />
      </div>
    </TopoActiveMountainProvider>
  )
}
