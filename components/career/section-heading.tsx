export function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="text-[11px] tracking-[0.22em] text-hivis-400 uppercase">{index}</span>
      <h2 className="m-0 font-display text-[18px] font-extrabold tracking-[-0.01em] text-paper-000 uppercase sm:text-[22px]">
        {title}
      </h2>
      <span className="h-px flex-1 bg-white/[0.16]" />
    </div>
  )
}
