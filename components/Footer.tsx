import { LINKS, PERSON } from "@/lib/content";

const LINKED = [
  { href: LINKS.linkedin, label: "LinkedIn" },
  { href: LINKS.github, label: "GitHub" },
  { href: LINKS.stackoverflow, label: "Stack Overflow" },
  { href: LINKS.upwork, label: "Upwork" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-void">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <a href="#top" className="link-wipe font-display text-base font-bold tracking-tight">
          {PERSON.name}
        </a>
        <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
          <a
            href={`mailto:${PERSON.email}`}
            className="link-wipe font-mono text-sm text-muted hover:text-text"
          >
            {PERSON.email}
          </a>
          {LINKED.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noreferrer noopener"
              className="link-wipe text-sm text-muted hover:text-text"
            >
              {link.label}
            </a>
          ))}
        </div>
        <p className="text-sm text-muted">Copyright 2026 {PERSON.name}</p>
      </div>
    </footer>
  );
}
