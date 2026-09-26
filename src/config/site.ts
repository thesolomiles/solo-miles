/**
 * Leonard's personal site — the page shown in the fake browser that opens from
 * the home's work desk (ui/PersonalSite.tsx). Pure content: edit freely.
 *
 * The home page is the hologram plus three section links; see PersonalSite.
 * Career is from Leonard's LinkedIn (2026-09-26), condensed.
 */

export interface SiteRole {
  title: string
  when: string
  desc: string
}
export interface SiteJob {
  company: string
  /** Newest first; a company with a promotion has more than one. */
  roles: SiteRole[]
}

export const SITE = {
  tabTitle: 'Leonard',
  name: 'Leonard',
  /** Title block at the home page's bottom right (sci-fi poster style). */
  signature: {
    name: 'Leonard Goh',
    line: 'Outcome and result‑driven design practitioner', // non-breaking hyphen
  },

  /** Dimension annotations drawn on the hologram while About is open. */
  measurements: { height: '182 cm', weight: '80 kg' },

  /** The section links — the only words on the home page, stacked bottom
   *  left. Opening one slides it (and those above it) up to the top left. */
  sections: [
    { id: 'about', label: 'About' },
    { id: 'career', label: 'Career' },
    { id: 'philosophy', label: 'Design philosophy' },
  ] as const,

  /** PLACEHOLDER copy for each page, laid straight over the hologram in the
   *  Ex Machina style — for reviewing the layout before real copy goes in.
   *  (The real content below — philosophy, traits, stats, experience, skills —
   *  isn't rendered right now.) */
  placeholders: {
    about: {
      intro: [
        'Trained in architecture, then graduated with a degree in communication design.',
        "I've only ever worked at startups. Most of them failed; this one has a fighting chance.",
        'Off the clock, I ride a lot, and now and then I make cycling videos for YouTube.',
      ],
      fields: [
        ['Name', 'Leonard Goh'],
        // Born 1989: worked out from the current year, so it never needs
        // updating (may read one high before his birthday in a given year).
        ['Age', String(new Date().getFullYear() - 1989)],
        ['Sex', 'Male'],
        ['Title', 'Head of Design'],
      ],
    },
    career: {
      // The job list (SITE.jobs) is the page; no intro or fields.
      intro: [] as string[],
      fields: [] as [string, string][],
    },
    philosophy: {
      intro: ['Placeholder intro. One line on how Leonard approaches design goes here.'],
      fields: [
        ['01', 'Placeholder principle'],
        ['02', 'Placeholder principle'],
        ['03', 'Placeholder principle'],
      ],
    },
  },

  /** Design philosophy page: the big line, then the smaller one(s). */
  philosophy: {
    quote: "People don't want the drill, they want the hole.",
    lines: ['Output and results-oriented. The rest are just noise.'],
  },

  /** About page: boxed traits, each with a one-line note. */
  traits: [
    { label: ['Design', 'leadership'], note: 'Heads design at watchTowr' },
    { label: ['Obsessive', 'craft'], note: 'Pixel-level since 2014' },
    { label: ['Builds what', 'he designs'], note: 'This town: React + three.js' },
    { label: ['National', 'champion'], note: 'Masters ITT 2026' },
  ],
  /** Cut-out low-poly Leonard (public/site): the front view, and the ¾ view
   *  he "turns" to on the Career page. w/h are the image sizes (aspect). */
  figures: {
    front: { src: '/site/leonard.webp', w: 311, h: 848 },
    angle: { src: '/site/leonard-angle.webp', w: 306, h: 851 },
  },

  stats: [
    { value: '12+', label: 'Years designing', note: 'Since 2014' },
    { value: '2×', label: 'National champion', note: 'Masters ITT 2026 · Masters Esports 2024' },
    { value: '4', label: 'Designers led', note: 'Design team at SWAT Mobility' },
  ],

  /** Career page: one row per company; click to expand. */
  jobs: [
    {
      company: 'watchTowr',
      roles: [
        {
          title: 'Head of Design',
          when: 'May 2022 — Now',
          desc: 'I lead a small product design team, working closely with the founder and leads across multiple teams. The bar for craft is very high: I turn demanding expectations into clear direction and consistently high-quality execution, and step into product management when delivery needs it.',
        },
      ],
    },
    {
      company: 'SWAT Mobility',
      roles: [
        {
          title: 'Product Design Lead',
          when: 'Jan 2020 — Jul 2022',
          desc: 'Led product design in a team of four while staying hands-on: people management alongside owning design quality across a growing suite of B2B applications.',
        },
        {
          title: 'Product Designer',
          when: 'Oct 2018 — Dec 2019',
          desc: "Designed the first wave of products for the company's shift from B2C to B2B, partnering with PMs and engineers on internal and customer-facing apps.",
        },
      ],
    },
    {
      company: 'GoBear',
      roles: [
        {
          title: 'Product Designer',
          when: 'Jun 2016 — Oct 2018',
          desc: "Worked on Asia's leading finance and insurance comparison platform, focused on Banking and Loans, across discovery, interaction design and iteration to make complex financial journeys clearer.",
        },
      ],
    },
    {
      company: 'Otsaw Digital',
      roles: [
        {
          title: 'Part-time UI/UX Designer',
          when: 'Jul 2015 — Jan 2016',
          desc: 'UI and interaction design for a mobile app, alongside a small multidisciplinary team of engineers, writers and creatives.',
        },
      ],
    },
    {
      company: 'CX Infotech',
      roles: [
        {
          title: 'UI/UX Designer',
          when: 'Feb 2014 — Feb 2015',
          desc: 'High volumes of UI across client projects on tight timelines. Recreating designs down to the pixel built the eye for spacing, typography and consistency I still work by.',
        },
      ],
    },
  ] as SiteJob[],

  /** Set big as a word wall; every other word is drawn as an outline. */
  skills: [
    'Product design',
    'Design systems',
    'Design leadership',
    'Interaction',
    'Prototyping',
    'Design QA',
    'Figma',
    'Blender',
    'React',
    'three.js',
  ],
}
