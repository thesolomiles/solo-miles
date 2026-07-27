export type WorkCardData = {
  id: string
  title: string
  desc: string
  cta: string
}

export function WorkCard({ id, title, desc, cta }: WorkCardData) {
  return (
    <a
      href="#"
      className="group relative flex flex-col gap-3.5 overflow-hidden rounded-card p-3.5 text-paper-000 no-underline shadow-[inset_0_1px_0_rgba(255,255,255,.09)]"
      style={{
        background:
          'linear-gradient(160deg, rgba(255,255,255,.055) 0%, rgba(255,255,255,.018) 55%, rgba(255,255,255,.008) 100%)',
        backdropFilter: 'blur(14px) saturate(1.1)',
        WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_1px_0_rgba(255,255,255,.16)] transition-opacity duration-200 ease-out group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(160deg, rgba(255,255,255,.1) 0%, rgba(255,255,255,.035) 60%, rgba(255,255,255,.012) 100%)',
        }}
      />

      <span
        className="relative block aspect-4/3 overflow-hidden rounded-media bg-cover bg-center shadow-[inset_0_1px_0_rgba(255,255,255,.07)]"
        style={{ backgroundImage: 'url(/solomiles/topo.svg)' }}
      >
        <span className="absolute top-2 left-2 z-10 text-[10px] tracking-[0.16em] text-paper-000 uppercase [text-shadow:0_1px_3px_rgba(0,0,0,.7)]">
          {id}
        </span>
      </span>

      <span className="flex flex-col gap-1.5">
        <span className="font-display text-[17px] leading-[1.05] font-bold tracking-[-0.01em] uppercase">
          {title}
        </span>
        <span className="text-xs leading-[1.6] text-ink-200">{desc}</span>
      </span>

      <span className="mt-auto flex items-center gap-2 text-[11px] tracking-[0.18em] text-hivis-400 uppercase">
        <span>{cta}</span>
        <span>→</span>
      </span>
    </a>
  )
}
