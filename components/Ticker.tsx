import Section from "./Section";
import Reveal from "./Reveal";
import { COMPANIES } from "@/lib/content";

function Run({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {COMPANIES.map((name, i) => (
        <li
          key={name}
          className={`font-display px-6 text-[clamp(2.5rem,7vw,7rem)] leading-none font-bold tracking-tight whitespace-nowrap md:px-12 ${
            i % 2 === 1 ? "stroked" : "text-text"
          }`}
        >
          {name}
        </li>
      ))}
    </ul>
  );
}

export default function Ticker() {
  return (
    <Section
      tone="none"
      bleed
      className="z-30 -mt-[100dvh] motion-reduce:mt-0"
      texture={
        // Soft top edge on purpose. A hard one would slice through the tear
        // bloom arriving from the hero above it.
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0,var(--color-surf-2)_260px)] motion-reduce:bg-surf-2 motion-reduce:bg-none" />
      }
      contentClassName="flex min-h-[100dvh] flex-col justify-between py-28 md:py-36"
    >
      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
        <Reveal>
          <h2 className="font-display max-w-[16ch] text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] font-bold tracking-tight">
            Teams I have shipped for
          </h2>
        </Reveal>
      </div>

      <div className="ticker relative overflow-hidden py-4">
        <div className="ticker-track flex w-max">
          <Run />
          <Run hidden />
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-surf-2 to-transparent md:w-52" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-surf-2 to-transparent md:w-52" />
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
        <Reveal delay={0.1}>
          <p className="ml-auto max-w-[46ch] text-base leading-relaxed text-muted md:text-right md:text-lg">
            9 years of contracts and full-time seats. Healthcare, telecoms,
            logistics, travel, and a stretch of agency client work.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
