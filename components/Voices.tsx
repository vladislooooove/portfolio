import Section from "./Section";
import Reveal from "./Reveal";
import { QUOTES } from "@/lib/content";

export default function Voices() {
  if (QUOTES.length === 0) return null;

  return (
    <Section
      tone="surf"
      texture={<div className="halo top-[8%] right-[8%] h-[360px] w-[360px]" />}
    >
      <Reveal>
        <h2 className="font-display text-[clamp(2rem,4.5vw,3.75rem)] leading-none font-bold tracking-tight">
          People I worked for
        </h2>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-14 md:mt-20 lg:grid-cols-12 lg:gap-10">
        {QUOTES.map((quote, i) => (
          <Reveal
            key={quote.name}
            delay={0.08 * i}
            className={i === 0 ? "lg:col-span-7" : "lg:col-span-5 lg:col-start-8 lg:mt-24"}
          >
            <figure>
              <blockquote
                className={`font-display font-medium tracking-tight text-text ${
                  i === 0
                    ? "max-w-[44ch] text-lg leading-[1.22] md:text-2xl lg:text-3xl xl:text-4xl"
                    : "max-w-[44ch] text-lg leading-[1.3] md:text-xl xl:text-2xl"
                }`}
              >
                &ldquo;{quote.body}&rdquo;
              </blockquote>
              <figcaption className="mt-7">
                <span className="block text-sm font-medium text-text">{quote.name}</span>
                <span className="mt-1 block text-sm text-muted">{quote.seat}</span>
                <span className="mt-1 block font-mono text-xs text-muted">{quote.note}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
