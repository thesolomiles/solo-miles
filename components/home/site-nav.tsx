import Image from 'next/image'
import Link from 'next/link'

const NAV_LINKS = ['My Career', 'Cycling', 'Side Projects', 'Shop']

export function SiteNav() {
  return (
    <header className="relative flex justify-center px-5 pt-13 sm:px-8 sm:pt-[52px]">
      <div className="flex w-full max-w-page flex-wrap items-center justify-between gap-4 sm:gap-8">
        <Link href="/" className="flex min-w-0 shrink items-center gap-3.5">
          <Image
            src="/solomiles/logo-horizontal-white.svg"
            alt="Solomiles"
            width={186}
            height={34}
            priority
            className="h-auto w-[140px] opacity-95 sm:w-[163px] md:w-[186px]"
          />
        </Link>

        <nav className="flex min-w-0 flex-wrap items-center gap-1.5">
          {NAV_LINKS.map((label) => (
            <a
              key={label}
              href="#"
              className="flex items-center px-3.5 py-2 text-[13px] tracking-[0.18em] text-paper-000 uppercase no-underline transition-colors hover:text-hivis-400"
            >
              {label}
            </a>
          ))}
          <span className="mx-2.5 hidden h-5 w-px bg-white/15 sm:block" />
          <a
            href="#"
            className="flex items-center gap-2 text-[11px] tracking-[0.2em] text-ink-200 uppercase no-underline transition-colors hover:text-hivis-400"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" className="block">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
            </svg>
            <span>YOUTUBE ↗</span>
          </a>
        </nav>
      </div>
    </header>
  )
}
