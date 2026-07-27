import { Hero } from '@/components/home/hero'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { TopoBackground } from '@/components/home/topo-background'
import { WorkGrid } from '@/components/home/work-grid'

export default function Page() {
  return (
    <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
      <TopoBackground />

      <SiteNav />

      <main className="relative flex flex-col items-center justify-center gap-7 px-5 py-16 sm:px-8">
        <div className="flex w-full max-w-page flex-col items-center gap-3.5">
          <Hero />
          <WorkGrid />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
