import { panelClass, pillClass } from './panel'
import { SectionHeading } from './section-heading'

const SKILL_GROUPS = [
  { label: 'Practice', items: ['Product design', 'Interaction design', 'Design systems', 'Prototyping', 'Design QA', 'Team leadership'] },
  { label: 'Tools', items: ['Figma', 'Photoshop', 'After Effects', 'OmniGraffle'] },
  { label: 'Courses', items: ['JavaScript', 'Swift', 'Git', 'Command line'] },
]

export function CareerSkills() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading index="04" title="Skills" />

      <div className={`${panelClass} flex flex-col gap-5 p-5`}>
        {SKILL_GROUPS.map(({ label, items }) => (
          <div key={label} className="flex flex-col gap-2.5">
            <span className="text-[10px] tracking-[0.2em] text-ink-300 uppercase">{label}</span>
            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <span key={item} className={pillClass}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-2.5">
          <span className="text-[10px] tracking-[0.2em] text-ink-300 uppercase">Languages</span>
          <span className="text-[13px] leading-[1.75] tracking-[-0.01em] text-ink-200">
            English — native · Chinese — native · Japanese — elementary
          </span>
        </div>
      </div>
    </div>
  )
}
