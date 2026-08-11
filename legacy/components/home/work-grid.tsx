import { WorkCard, type WorkCardData } from './work-card'

const CARDS: WorkCardData[] = [
  { id: '01', title: 'My Career', desc: 'Career-related stuff.', cta: 'Find out more' },
  { id: '02', title: 'Cycling', desc: 'My rides.', cta: 'See more' },
  { id: '03', title: 'Side Projects', desc: "Things that I've been building.", cta: 'Busybody', href: '/projects' },
  { id: '04', title: 'YouTube', desc: 'A cycling-focused YouTube channel.', cta: 'Go to channel' },
  { id: '05', title: 'Shop', desc: 'Solomiles-related merchandise.', cta: 'Buy stuff' },
]

export function WorkGrid() {
  return (
    <div className="mt-8 grid w-full grid-cols-1 gap-3.5 text-left sm:grid-cols-2 lg:grid-cols-5">
      {CARDS.map((card) => (
        <WorkCard key={card.id} {...card} />
      ))}
    </div>
  )
}
