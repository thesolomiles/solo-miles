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
/** A page intro paragraph: a boxed title + text. */
export interface SiteLogEntry {
  tag: string
  text: string
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

  /** About: Ex Machina-style boxed labels stacked in the bottom-right corner,
   *  summarising Leonard. */
  summary: ['Success-driven', 'INTP', 'Hands-on', 'Self-aware'],

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
      // Each paragraph gets a boxed title (Ex Machina style). Written in the
      // third person, as if Leonard is being analysed.
      intro: [
        { tag: 'Education', text: 'Trained in architecture, then completed a degree in communication design.' },
        { tag: 'Start-ups', text: 'Worked exclusively at startups. Fast-paced, high execution rate, hands-on.' },
        { tag: 'Hobbies', text: 'Cycles frequently. Periodically produces cycling content for YouTube.' },
      ] as SiteLogEntry[],
      fields: [
        ['Name', 'Leonard Goh'],
        // Born 1989: worked out from the current year, so it never needs
        // updating (may read one high before his birthday in a given year).
        ['Age', String(new Date().getFullYear() - 1989)],
        ['Sex', 'Male'],
        ['Current position', 'Head of Design'],
      ],
    },
    career: {
      // The job list (SITE.jobs) is the page; no intro or fields.
      intro: [] as SiteLogEntry[],
      fields: [] as [string, string][],
    },
    philosophy: {
      intro: [] as SiteLogEntry[],
      // (Key influences are callout 04 on the zoomed head.)
      fields: [] as [string, string][],
    },
  },

  /** Design philosophy page: annotations on the zoomed head + the prime directive. */
  philosophy: {
    /** Clickable callouts on the zoomed-in head; the selected one's `desc`
     *  (or `items`) shows under the links. `at` = where the line starts on
     *  the FRONT figure image (fractions of its width/height); the lines run
     *  behind him, so only the y really shows. */
    annotations: [
      {
        text: 'Rooted in architecture',
        at: [0.5, 0.1],
        desc: 'Placeholder: a line or two on how architecture shaped the way Leonard designs.',
      },
      {
        text: 'Room for mistakes',
        at: [0.5, 0.145],
        desc: 'Placeholder: a line or two on why he leaves room for mistakes.',
      },
      {
        text: 'Knows how things work',
        at: [0.5, 0.19],
        desc: 'Placeholder: a line or two on knowing how things work.',
      },
      {
        text: 'Key influences',
        at: [0.5, 0.235],
        items: [
          ['The Design of Everyday Things', 'Don Norman'],
          ['Competing Against Luck', 'Clayton M. Christensen'],
          ['Just Enough Research', 'Erika Hall'],
        ],
      },
    ] as { text: string; at: [number, number]; desc?: string; items?: [string, string][] }[],
    prime: "My work contributes to the business. If it doesn't, it's just theatrics.", // shown in quotes, bottom left
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
