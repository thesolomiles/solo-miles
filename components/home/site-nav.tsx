'use client'

import { Menu, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

const NAV_LINKS: { label: string; href?: string }[] = [
  { label: 'My Career', href: '/career' },
  { label: 'Cycling', href: '/cycling' },
  { label: 'Side Projects', href: '/projects' },
  { label: 'Shop' },
]

function NavLink({ label, href, onClick, className = '' }: { label: string; href?: string; onClick?: () => void; className?: string }) {
  if (!href) {
    return (
      <span
        aria-disabled
        className={
          'flex cursor-not-allowed items-center px-3.5 py-2 text-[13px] tracking-[0.18em] text-ink-200/50 uppercase ' +
          className
        }
      >
        {label}
      </span>
    )
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={
        'flex items-center px-3.5 py-2 text-[13px] tracking-[0.18em] text-paper-000 uppercase no-underline transition-colors hover:text-hivis-400 ' +
        className
      }
    >
      {label}
    </Link>
  )
}

function YoutubeLink({ className }: { className?: string }) {
  return (
    <a
      href="https://www.youtube.com/@thesolomiles"
      target="_blank"
      rel="noopener noreferrer"
      className={
        'flex items-center gap-2 text-[11px] tracking-[0.2em] text-ink-200 uppercase no-underline transition-colors hover:text-hivis-400 ' +
        className
      }
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" className="block">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" />
      </svg>
      <span>YOUTUBE ↗</span>
    </a>
  )
}

export function SiteNav() {
  const [open, setOpen] = useState(false)

  return (
    <header className="relative flex justify-center px-5 pt-13 sm:px-8 sm:pt-[52px]">
      <div className="relative flex w-full max-w-page flex-wrap items-center justify-between gap-4 sm:gap-8">
        <Link href="/" className="flex min-w-0 shrink items-center gap-3.5" onClick={() => setOpen(false)}>
          <Image
            src="/solomiles/logo-horizontal-white.svg"
            alt="Solomiles"
            width={186}
            height={34}
            priority
            className="h-auto w-[140px] opacity-95 sm:w-[163px] md:w-[186px]"
          />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex items-center justify-center p-1.5 text-paper-000 transition-colors hover:text-hivis-400 sm:hidden"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className="hidden min-w-0 flex-wrap items-center gap-1.5 sm:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <NavLink key={label} label={label} href={href} />
          ))}
          <span className="mx-2.5 hidden h-5 w-px bg-white/15 sm:block" />
          <YoutubeLink />
        </nav>

        {open && (
          <nav className="absolute inset-x-0 top-full z-10 mt-3 flex flex-col gap-1 border border-white/15 bg-void/95 p-2 backdrop-blur-sm sm:hidden">
            {NAV_LINKS.map(({ label, href }) => (
              <NavLink key={label} label={label} href={href} onClick={() => setOpen(false)} className="py-2.5" />
            ))}
            <span className="my-1 h-px w-full bg-white/15" />
            <YoutubeLink className="px-3.5 py-2.5" />
          </nav>
        )}
      </div>
    </header>
  )
}
