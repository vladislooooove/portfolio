/**
 * Every visible string on the page. Sourced from cv.md in career-ops.
 * Copy follows voice-dna.md: contractions, digits, direct address,
 * no em-dashes, no "it's not X it's Y" constructions.
 */

export const PERSON = {
  name: "Vladyslav Prozapas",
  role: "Senior Frontend Engineer",
  email: "recrean1@gmail.com",
};

export const LINKS = {
  // TODO: swap for the new GitHub URL once confirmed. cv.md has this one.
  github: "https://github.com/vladislooove",
  linkedin: "https://www.linkedin.com/in/vladyslav-prozapas-832652169/",
  stackoverflow: "https://stackoverflow.com/users/14788476/vlad",
  upwork: "https://www.upwork.com/freelancers/~01ad58c7a0fa3f1633",
};

export const NAV = [
  { label: "Work", href: "#work" },
  { label: "Experience", href: "#experience" },
  { label: "Stack", href: "#stack" },
];

export const HERO = {
  lines: ["Front-end", "architecture"],
  sub: "9 years in React and TypeScript. I split monoliths into micro-frontends and publish the design systems teams build on.",
  primary: { label: "See the work", href: "#work" },
  secondary: { label: "Get in touch", href: "#contact" },
};

export const COMPANIES = [
  "C the Signs",
  "GMS",
  "SoftServe",
  "Wedes",
  "Marema",
  "Traivel",
  "Scrupio",
  "Migronis",
  "DRISoft",
  "Grapes",
];

export const PROJECTS = [
  {
    key: "cts",
    client: "C the Signs",
    sector: "Healthcare, London",
    period: "2020-2025",
    seat: "Senior React Developer",
    title: "One monolith, 5 micro-frontends",
    body: "3 Scrum teams shared a single release train, so one regression defect could block everybody. I decomposed the codebase into 5 domain micro-frontends with Module Federation and built the MobX shell that coordinates them. Releases moved from once a fortnight, synchronized across all teams, to several per sprint with nothing blocking across teams.",
    stack: ["TypeScript", "React", "Module Federation", "MobX", "Nx", "Webpack"],
    hue: 0.0,
  },
  {
    key: "gms",
    client: "GMS",
    sector: "Telecommunications",
    period: "2025",
    seat: "Senior Frontend Engineer",
    title: "Accessible primitives, then SSO on top",
    body: "Built a design system on React Aria so the platform gets keyboard and screen-reader behaviour by default instead of bolting it on later. Redesigned the admin application against a new design language, then shipped an SSO dashboard in Next.js authenticating through Microsoft Entra ID, with transactional mail on Resend.",
    stack: ["React", "React Aria", "Next.js", "Microsoft Entra ID", "Resend"],
    hue: 0.09,
  },
  {
    key: "agency",
    client: "Digital agency",
    sector: "Client work, under NDA",
    period: "2026-now",
    seat: "Frontend Engineer",
    title: "Motion work that runs at 60fps",
    body: "Front ends for a run of client sites, and the interactive pieces inside them. GSAP handles the choreography. WebGL takes over when a page needs to do something the DOM can't, and my job is keeping that cheap enough to ship on a phone.",
    stack: ["Vue", "Nuxt", "GSAP", "WebGL", "SCSS"],
    hue: -0.07,
  },
];

export const DEEP_DIVE = {
  title: "The design system nobody had to be talked into",
  body: "At C the Signs I published the internal design system as a versioned npm package. Storybook for the docs, semver for the releases, migration guides when something broke. Two teams pulled it in. Theming sits on a named value layer passed through a ThemeProvider, so every tenant renders the same components under its own styling and no one writes per-tenant component code.",
  facts: [
    { value: "20+", label: "components published and consumed by 2 teams" },
    { value: "Semver", label: "with changelogs and written migration guides" },
    { value: "0", label: "per-tenant component forks in the codebase" },
  ],
};

export const IMPACT = [
  { value: "9", label: "years of production front-end work" },
  { value: "5", label: "micro-frontends carved out of one monolith" },
  { value: "3", label: "Scrum teams freed from a shared release train" },
  { value: "30+", label: "page product migrated from JavaScript to TypeScript" },
];

export const CAPABILITIES = [
  {
    title: "Architecture",
    body: "I split monoliths into domain micro-frontends and build the shell that holds them together. Module Federation at runtime, Nx or Turborepo in the repo, and a BFF layer when the API shape fights the UI.",
    span: "lg:col-span-2 lg:row-span-2",
    surface: "panel-deep",
  },
  {
    title: "Design systems",
    body: "Published as versioned npm packages with Storybook docs and real migration guides. Multi-tenant theming through a named token layer.",
    span: "",
    surface: "panel",
  },
  {
    title: "Accessibility",
    body: "React Aria primitives, WCAG and ARIA. RTL support including mirrored layout and bidirectional text.",
    span: "",
    surface: "panel lattice",
  },
  {
    title: "Performance",
    body: "Chrome DevTools and React Profiler, then virtualized lists, tables and dropdowns once the data stops being polite.",
    span: "",
    surface: "panel",
  },
  {
    title: "Real time",
    body: "WebSockets and server-sent events. Multi-user editing with conflict resolution for concurrent edits.",
    span: "",
    surface: "panel-deep",
  },
];

export const TIMELINE = [
  {
    period: "2025-now",
    org: "Independent contractor",
    seat: "Senior Frontend Engineer",
    place: "Remote, Alicante",
    body: "Concurrent contracts. A digital agency for GSAP and WebGL client work, a QR scanning module for Grapes in Next.js, and the GMS platform.",
  },
  {
    period: "2020-2025",
    org: "C the Signs",
    seat: "Senior React Developer",
    place: "Remote, London company",
    body: "Owned the front end from the early startup stage. 5 micro-frontends, an npm design system, a multi-tenant workflow configuration module, and the JavaScript to TypeScript migration. Interviewed, onboarded and mentored the developers who came after.",
  },
  {
    period: "2018-2020",
    org: "SoftServe",
    seat: "Front-end Developer",
    place: "Rivne, Ukraine",
    body: "Modules and features on a large-scale SPA. Shipped RTL support across the whole application, mirrored layout and bidirectional text included, plus multi-brand theming.",
  },
  {
    period: "2016-2018",
    org: "Wedes",
    seat: "Front-end Developer",
    place: "Rivne, Ukraine",
    body: "Responsive templates from PSD, hybrid mobile apps in Ionic and Angular including the Play Store releases, and an internal build framework on Gulp and Webpack.",
  },
];

export const TIMELINE_NOTE =
  "Part-time contracts along the way: Marema, Traivel, Scrupio, DRISoft and Migronis.";

/** Verified against cdn.simpleicons.org. Logos only, no labels under them. */
export const LOGO_STRIP = [
  { name: "TypeScript", slug: "typescript" },
  { name: "React", slug: "react" },
  { name: "Next.js", slug: "nextdotjs" },
  { name: "Vue", slug: "vuedotjs" },
  { name: "Nuxt", slug: "nuxt" },
  { name: "Node.js", slug: "nodedotjs" },
  { name: "Redux", slug: "redux" },
  { name: "Storybook", slug: "storybook" },
  { name: "Tailwind CSS", slug: "tailwindcss" },
  { name: "GSAP", slug: "greensock" },
  { name: "Three.js", slug: "threedotjs" },
  { name: "Docker", slug: "docker" },
];

export const STACK = [
  {
    group: "Core",
    items: ["TypeScript", "React", "Next.js", "Node.js", "Vue", "Nuxt", "React Native"],
  },
  {
    group: "Architecture",
    items: [
      "Module Federation",
      "Nx",
      "Turborepo",
      "Lerna",
      "Webpack",
      "Vite",
      "BFF layer",
      "REST design",
    ],
  },
  {
    group: "State",
    items: ["Redux Toolkit", "Redux-Saga", "MobX", "TanStack Query", "React Hook Form"],
  },
  {
    group: "UI systems",
    items: [
      "React Aria",
      "Storybook",
      "MUI",
      "Tailwind",
      "styled-components",
      "Sass",
      "Design tokens",
      "Multi-tenant theming",
    ],
  },
  {
    group: "Motion and graphics",
    items: ["GSAP", "Framer Motion", "Three.js", "WebGL", "Canvas", "D3", "Chart.js", "Lottie"],
  },
  {
    group: "Testing",
    items: ["Jest", "Vitest", "Playwright", "Cypress", "React Testing Library", "Enzyme"],
  },
  {
    group: "Platform",
    items: ["AWS", "S3", "Docker", "GitHub Actions", "PostgreSQL", "MongoDB", "NestJS"],
  },
  {
    group: "Auth",
    items: ["Microsoft Entra ID", "Keycloak", "Auth0", "OAuth2", "JWT"],
  },
];

/**
 * Real recommendations. Excerpted verbatim, never reworded. LinkedIn
 * recommendations carry named attribution; Upwork reviews are anonymous on
 * the platform, so they are attributed to the platform and linked for checking.
 */
export const QUOTES = [
  {
    body: "He's someone you can always rely on, both technically and personally. Any team would be lucky to have Vlad.",
    name: "Serhii Pov\u00edsenko",
    seat: "Software Engineering",
    note: "Vlad's direct manager for over 5 years",
  },
  {
    body: "Vlad is a calm and reliable teammate who communicates clearly and works seamlessly with others.",
    name: "Anton Povzun",
    seat: "Software Engineer",
    note: "Worked on the same team",
  },
];

export const UPWORK_REVIEWS = [
  "Vlad is one of best developers on Upwork.",
  "Fantastic developer. Easy to work with. Good communication skills.",
  "You won't regret hiring Vlad! He got the job done so quickly and well.",
  "Excellent engineer! Development frontend improvements for my application. Strongly recommend!",
  "Quick, communicates well and has the skills we needed!",
  "Vladyslav did a great job, very quickly. Apparently as for Javascript, he knows his field of expertise very well.",
  "Did a small task quickly and went an extra mile.",
  "Great experience! Acted quickly to help with some issues on a Custom Weebly Template.",
  "Great engineer! Recommend",
];

export const CONTACT = {
  lines: ["Tell me what", "you're building."],
  body: "I'm open to senior front-end roles. Say what you're working on and what's hard about it right now, and I'll tell you straight whether I'm the right person for it.",
  submit: "Send message",
};
