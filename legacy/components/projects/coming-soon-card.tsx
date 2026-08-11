export function ComingSoonCard({ id }: { id: string }) {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3.5 rounded-card border border-dashed border-white/15 p-3.5 text-ink-300"
    >
      <span className="relative block aspect-4/3 rounded-media bg-white/[0.02]">
        <span className="absolute top-2 left-2 text-[10px] tracking-[0.16em] text-white/30 uppercase">{id}</span>
      </span>

      <span className="flex flex-col gap-1.5">
        <span className="font-display text-[17px] leading-[1.05] font-bold tracking-[-0.01em] text-ink-400 uppercase">
          More soon
        </span>
        <span className="text-xs leading-[1.6] text-ink-500">
          Something&apos;s half-built. It&apos;ll show up here when it works.
        </span>
      </span>
    </div>
  )
}
