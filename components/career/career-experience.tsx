import { panelClass, tagClass } from './panel'
import { SectionHeading } from './section-heading'

type Role = {
  period: string
  duration: string
  current?: boolean
  title: string
  description: string
  tags?: string[]
}

const ROLES: Role[] = [
  {
    period: '2022 — NOW',
    duration: '4 yrs 3 mos',
    current: true,
    title: 'watchTowr — Head of Design',
    description:
      "I lead a small product design team, working directly with the founder and leads across teams. The bar for craft is very high — a large part of the job is turning demanding expectations into clear direction and consistent execution. When it's needed I step past design into product: shaping requirements, managing delivery, reviewing across disciplines, keeping the cycle on track.",
    tags: ['Design leadership', 'Craft & QA standards', 'Product management', 'Cybersecurity'],
  },
  {
    period: '2020 — 2022',
    duration: '2 yrs 7 mos',
    title: 'SWAT Mobility — Product Design Lead',
    description:
      'Led design in a team of four and stayed hands-on throughout. People management alongside ownership of design quality across a growing suite of B2B applications — setting standards, reviewing work, and supporting designers through regular critique. Worked with PMs and engineers to shape problems, prioritise, and ship.',
    tags: ['Team of 4', 'B2B suite', 'Critique & standards'],
  },
  {
    period: '2018 — 2019',
    duration: '1 yr 3 mos',
    title: 'SWAT Mobility — Product Designer',
    description:
      'Joined during the shift from B2C to B2B and designed the first wave of products supporting it — internal tools and customer-facing applications — balancing user needs, technical constraints and business priorities on a fast-moving product surface.',
  },
  {
    period: '2016 — 2018',
    duration: '2 yrs 5 mos',
    title: 'GoBear — Product Designer',
    description:
      "Asia's leading finance and insurance comparison platform, mostly on Banking and Loans. Reporting to the Design Director across discovery, interaction design and iteration — untangling complex financial journeys so people could actually decide.",
  },
  {
    period: '2015 — 2016',
    duration: '7 mos · part-time',
    title: 'Otsaw Digital — UI/UX Designer',
    description:
      'A mobile application project with a small multidisciplinary team. UI and interaction design next to engineers, writers and other creatives — where I learned what cross-functional collaboration actually costs and returns.',
  },
  {
    period: '2014 — 2015',
    duration: '1 yr 1 mo',
    title: 'CX Infotech — UI/UX Designer',
    description:
      'A software house where speed mattered: large volumes of UI screens across client projects, on tight timelines. Much of it was recreating existing designs pixel for pixel. That discipline built my eye for spacing, typography and consistency — it still shapes how I execute.',
  },
]

export function CareerExperience() {
  return (
    <div className="flex flex-col gap-6 pt-16 sm:pt-20">
      <SectionHeading index="02" title="Experience" />

      <div className="flex flex-col gap-3.5">
        {ROLES.map((role) => (
          <article
            key={role.title}
            className={`${panelClass} flex flex-col gap-5 p-5 sm:grid sm:grid-cols-[180px_1fr] sm:gap-8`}
          >
            <div className="flex flex-col gap-2">
              <span className="text-xs tracking-[0.1em] text-paper-000">{role.period}</span>
              <span className="text-[11px] tracking-[0.12em] text-ink-300">{role.duration}</span>
              {role.current && (
                <span className="mt-1 inline-flex items-center gap-2 text-[11px] tracking-[0.2em] text-hivis-400 uppercase">
                  <span className="sm-pip block h-1.5 w-1.5 rounded-full bg-hivis-400" />
                  Current
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="m-0 font-display text-lg font-extrabold tracking-[-0.015em] text-paper-000 uppercase">
                {role.title}
              </h3>
              <p className="m-0 max-w-[74ch] text-sm leading-[1.75] tracking-[-0.01em] text-ink-200 text-pretty">
                {role.description}
              </p>
              {role.tags && (
                <div className="flex flex-wrap gap-2">
                  {role.tags.map((tag) => (
                    <span key={tag} className={tagClass}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
