import Link from 'next/link'
import type { Ride } from '@/lib/rides'
import { cn } from '@/lib/utils'

export function RideCard({
  ride,
  active,
  onActivate,
  onDeactivate,
}: {
  ride: Ride
  active: boolean
  onActivate: () => void
  onDeactivate: () => void
}) {
  return (
    <Link
      href={`/cycling/${ride.slug}`}
      onMouseEnter={onActivate}
      onMouseLeave={onDeactivate}
      onFocus={onActivate}
      onBlur={onDeactivate}
      className={cn(
        'group relative flex flex-col gap-4 overflow-hidden rounded-card p-4.5 text-paper-000 no-underline shadow-[inset_0_1px_0_rgba(255,255,255,.09)] transition-shadow duration-200',
        active && 'shadow-[inset_0_0_0_1px_rgba(216,242,80,.45),inset_0_1px_0_rgba(255,255,255,.09)]',
      )}
      style={{
        background:
          'linear-gradient(160deg, rgba(255,255,255,.055) 0%, rgba(255,255,255,.018) 55%, rgba(255,255,255,.008) 100%)',
        backdropFilter: 'blur(14px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
      }}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_1px_0_rgba(255,255,255,.16)] transition-opacity duration-200 ease-out group-hover:opacity-100',
          active && 'opacity-100',
        )}
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,.1) 0%, rgba(255,255,255,.035) 60%, rgba(255,255,255,.012) 100%)',
        }}
      />

      <span className="relative flex flex-col gap-1.5">
        <span className="text-[11px] tracking-[0.18em] text-hivis-400 uppercase">{ride.country}</span>
        <span className="font-display text-[19px] leading-[1.1] font-bold tracking-[-0.01em] uppercase">{ride.title}</span>
        <span className="text-xs leading-[1.6] text-ink-200">{ride.place}</span>
      </span>

      <span className="relative flex gap-6">
        <span className="flex flex-col gap-1">
          <span className="font-display text-lg leading-none font-extrabold tracking-[-0.02em] text-paper-000">
            {ride.distanceKm} km
          </span>
          <span className="text-[10px] tracking-[0.2em] text-ink-300 uppercase">Distance</span>
        </span>
        <span className="flex flex-col gap-1">
          <span className="font-display text-lg leading-none font-extrabold tracking-[-0.02em] text-paper-000">
            {ride.elevationM} m
          </span>
          <span className="text-[10px] tracking-[0.2em] text-ink-300 uppercase">Elevation gained</span>
        </span>
      </span>
    </Link>
  )
}
