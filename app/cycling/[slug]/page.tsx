import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteFooter } from '@/components/home/site-footer'
import { SiteNav } from '@/components/home/site-nav'
import { TopoActiveMountainProvider } from '@/components/home/topo-active-context'
import { TopoBackground } from '@/components/home/topo-background'
import { MOUNTAINS } from '@/lib/mountains'
import { RIDES } from '@/lib/rides'

export function generateStaticParams() {
  return RIDES.map((ride) => ({ slug: ride.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const ride = RIDES.find((r) => r.slug === slug)
  return { title: ride ? `${ride.title} — Cycling — Solomiles` : 'Cycling — Solomiles' }
}

export default async function RidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ride = RIDES.find((r) => r.slug === slug)
  if (!ride) notFound()

  return (
    <TopoActiveMountainProvider count={MOUNTAINS.length}>
      <div className="relative grid min-h-screen grid-rows-[auto_1fr_auto] overflow-hidden bg-void font-mono text-paper-000">
        <TopoBackground />

        <SiteNav />

        <main className="relative flex flex-col items-center px-5 py-16 sm:px-8">
          <div className="flex w-full max-w-page flex-col items-center gap-4 pt-16 pb-24 text-center sm:pt-24">
            <span className="text-[11px] tracking-[0.22em] text-hivis-400 uppercase">{ride.place}</span>
            <h1 className="m-0 max-w-[20ch] font-display text-[32px] leading-[0.95] font-extrabold tracking-[-0.03em] uppercase sm:text-[44px]">
              {ride.title}
            </h1>
            <p className="m-0 text-sm text-ink-200">Ride details coming soon.</p>
            <Link
              href="/cycling"
              className="mt-3.5 inline-flex items-center gap-2.5 rounded-[10px] bg-[linear-gradient(160deg,rgba(255,255,255,.055)_0%,rgba(255,255,255,.018)_55%,rgba(255,255,255,.008)_100%)] px-5 py-3 text-[11px] tracking-[0.2em] text-paper-000 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-[14px] transition-colors hover:bg-none hover:bg-hivis-400 hover:text-void"
            >
              ← Back to Cycling
            </Link>
          </div>
        </main>

        <SiteFooter />
      </div>
    </TopoActiveMountainProvider>
  )
}
