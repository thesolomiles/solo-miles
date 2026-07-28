import { panelClass } from './panel'

const STATS = [
  { value: '12.4', label: 'Years in practice' },
  { value: '6', label: 'Roles' },
  { value: '5', label: 'Companies' },
  { value: '1', label: 'City — Singapore' },
]

export function CareerStats() {
  return (
    <div className="grid w-full grid-cols-2 gap-3.5 sm:grid-cols-4">
      {STATS.map(({ value, label }) => (
        <div key={label} className={`${panelClass} flex flex-col gap-2 p-4.5`}>
          <span className="font-display text-[32px] leading-none font-extrabold tracking-[-0.02em] text-paper-000 sm:text-[36px]">
            {value}
          </span>
          <span className="text-[10px] tracking-[0.2em] text-ink-300 uppercase">{label}</span>
        </div>
      ))}
    </div>
  )
}
