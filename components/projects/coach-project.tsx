import Link from 'next/link'
import { Tag } from '@/components/flashcards/tag'

const COACH_APP_URL = process.env.NEXT_PUBLIC_COACH_APP_URL || 'http://localhost:8008'

const FEATURES = [
  {
    title: 'Training sync',
    desc: 'Pulls activities and wellness metrics from Strava and intervals.icu on a schedule.',
  },
  {
    title: 'Load dashboard',
    desc: 'Tracks CTL, ATL, and ramp rate against a goal date so overreaching shows up early.',
  },
  {
    title: 'AI coach & nutritionist',
    desc: 'Claude-backed daily briefs that read the training data and give direct, unsoftened feedback.',
  },
  {
    title: 'Telegram check-ins',
    desc: 'Briefs and nudges land in a Telegram chat instead of a dashboard I forget to open.',
  },
]

const STACK = ['FastAPI', 'SQLite', 'Claude', 'Strava API', 'intervals.icu API', 'Telegram Bot API', 'APScheduler']

export function CoachProject() {
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-11">
      <div className="flex flex-col gap-3">
        <Link
          href="/projects"
          className="flex w-fit items-center gap-2 text-[11px] tracking-[0.2em] text-ink-300 uppercase no-underline transition-colors hover:text-hivis-400"
        >
          <span>←</span>
          <span>Projects</span>
        </Link>
        <span className="text-[11px] tracking-[0.22em] text-hivis-400 uppercase">02 / Training Coach</span>
      </div>

      <div className="flex flex-col gap-3.5">
        <h1 className="m-0 max-w-[15ch] text-[32px] leading-[0.98] font-extrabold tracking-[-0.03em] text-paper-000 uppercase sm:text-[40px]">
          Training coach.
        </h1>
        <p className="m-0 max-w-[56ch] text-[13px] leading-[1.8] text-ink-200">
          A personal cycling coach built on top of my own training data. It syncs Strava and intervals.icu, tracks
          training load against a goal event, and has Claude write a daily coach and nutritionist brief sent
          straight to Telegram.
        </p>
        <a
          href={COACH_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex w-fit items-center gap-2 rounded-[2px] bg-hivis-400 px-4 py-2.5 font-mono text-[11px] tracking-[0.18em] text-void uppercase no-underline transition-colors hover:bg-hivis-500"
        >
          <span>See app</span>
          <span>→</span>
        </a>
      </div>

      <div className="flex flex-col gap-4">
        <span className="text-[11px] tracking-[0.14em] text-ink-300 uppercase">Features</span>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-2 rounded border border-white/20 bg-white/[0.02] p-4">
              <span className="text-[11px] tracking-[0.16em] text-paper-000 uppercase">{f.title}</span>
              <span className="text-xs leading-[1.6] text-ink-300">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <span className="text-[11px] tracking-[0.14em] text-ink-300 uppercase">Stack</span>
        <div className="flex flex-wrap gap-2">
          {STACK.map((s) => (
            <Tag key={s} size="sm">
              {s}
            </Tag>
          ))}
        </div>
      </div>

      <p className="m-0 text-xs leading-[1.6] text-ink-300">
        It runs against my own Strava, intervals.icu, and training data, so &quot;See app&quot; opens a login screen —
        continue as a guest for a walkthrough with no real data attached.
      </p>
    </div>
  )
}
