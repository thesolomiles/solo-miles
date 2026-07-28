import { panelClass } from './panel'
import { SectionHeading } from './section-heading'

const SCHOOLS = [
  {
    school: 'Singapore Institute of Technology',
    program: "Bachelor's Degree, Communication Design",
    period: '2014 — 2016',
  },
  {
    school: 'Temasek Polytechnic',
    program: 'Diploma, Environment Design — architecture and space',
    period: '2007 — 2011',
  },
]

export function CareerEducation() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading index="03" title="Education" />

      <div className="flex flex-col gap-3.5">
        {SCHOOLS.map(({ school, program, period }) => (
          <div key={school} className={`${panelClass} flex flex-col gap-2 p-5`}>
            <span className="font-display text-[17px] font-bold text-paper-000 uppercase">{school}</span>
            <span className="text-[13px] leading-[1.75] tracking-[-0.01em] text-ink-200">{program}</span>
            <span className="text-[11px] tracking-[0.16em] text-ink-300">{period}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
