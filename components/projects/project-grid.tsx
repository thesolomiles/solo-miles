import { WorkCard, type WorkCardData } from '@/components/home/work-card'
import { ComingSoonCard } from './coming-soon-card'

const PROJECTS: WorkCardData[] = [
  {
    id: '01',
    title: 'Japanese Flashcards',
    desc: 'Digital flashcards for the Japanese language.',
    cta: 'Try it',
    href: '/projects/japanese-flashcards',
  },
]

export function ProjectGrid() {
  return (
    <div className="grid w-full grid-cols-1 gap-3.5 text-left sm:grid-cols-2 lg:grid-cols-3">
      {PROJECTS.map((project) => (
        <WorkCard key={project.id} {...project} />
      ))}
      <ComingSoonCard id="02" />
    </div>
  )
}
