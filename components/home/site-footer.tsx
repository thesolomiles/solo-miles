export function SiteFooter() {
  return (
    <footer className="relative flex justify-center px-5 pb-13 sm:px-8">
      <div className="flex w-full max-w-page flex-col flex-wrap items-center justify-between gap-4 text-[11px] tracking-[0.2em] text-ink-300 uppercase sm:flex-row">
        <span>1.3521° N, 103.8198° E</span>
        <a
          href="mailto:sol@solomiles.cc"
          className="text-paper-000 no-underline transition-colors hover:text-hivis-400"
        >
          SOL@SOLOMILES.CC ↗
        </a>
      </div>
    </footer>
  )
}
