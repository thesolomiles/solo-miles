export function CareerHero() {
  return (
    <div className="flex flex-col items-center gap-3 pt-8 pb-10 text-center sm:pt-16">
      <span className="text-[11px] tracking-[0.22em] text-hivis-400 uppercase">01 — My career</span>
      <h1 className="m-0 max-w-[16ch] font-display text-[42px] leading-[0.92] font-extrabold tracking-[-0.03em] text-paper-000 uppercase sm:text-[54px] md:text-[64px]">
        Year 12.
        <br />
        Still hands-on.
      </h1>
      <p className="m-0 mt-1 max-w-[60ch] font-display text-[15px] leading-[1.6] text-ink-200 text-pretty sm:text-base">
        I started in architecture and ended up designing software. Six roles, five companies, all of it in Singapore —
        mostly startups, mostly hands-on. I lead teams now and still draw the screens.
      </p>
      <a
        href="/solomiles/leonard-goh-resume.pdf"
        download
        className="mt-3.5 inline-flex items-center gap-2.5 rounded-[10px] bg-[linear-gradient(160deg,rgba(255,255,255,.055)_0%,rgba(255,255,255,.018)_55%,rgba(255,255,255,.008)_100%)] px-5 py-3 text-[11px] tracking-[0.2em] text-paper-000 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,.09)] backdrop-blur-[14px] transition-colors hover:bg-none hover:bg-hivis-400 hover:text-void"
      >
        Résumé PDF ↓
      </a>
    </div>
  )
}
