import { PageHero } from '@/components/site/page-hero'

export function CareerHero() {
  return (
    <PageHero
      eyebrow="01 — My career"
      heading={
        <>
          Year 12.
          <br />
          Still hands-on.
        </>
      }
      description="I'm a digital product designer. Core design principles stem from my days in architecture school. Been at startups for 12 years, now I lead design teams and still draw the screens."
    >
      <a
        href="/solomiles/leonard-goh-resume.pdf"
        download
        className="mt-3.5 inline-flex items-center gap-2.5 rounded-[10px] bg-[linear-gradient(160deg,rgba(255,255,255,.055)_0%,rgba(255,255,255,.018)_55%,rgba(255,255,255,.008)_100%)] px-5 py-3 text-[11px] tracking-[0.2em] text-paper-000 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-[14px] transition-colors hover:bg-none hover:bg-hivis-400 hover:text-void"
      >
        Résumé PDF ↓
      </a>
    </PageHero>
  )
}
