import Section from "./Section";
import Reveal from "./Reveal";
import { CAPABILITIES } from "@/lib/content";

export default function Capabilities() {
  return (
    <Section tone="void">
      <Reveal>
        <h2 className="font-display text-[clamp(2rem,4.5vw,3.75rem)] leading-none font-bold tracking-tight">
          What I actually do
        </h2>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-4 md:mt-14 md:grid-cols-2 lg:h-[58vh] lg:grid-cols-4 lg:grid-rows-2">
        {CAPABILITIES.map((cap, i) => (
          <Reveal
            key={cap.title}
            delay={0.06 * i}
            className={`${cap.span} ${cap.surface} flex min-h-[210px] flex-col justify-end p-6 md:p-8`}
          >
            <h3 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
              {cap.title}
            </h3>
            <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-text/80 md:text-[1rem]">
              {cap.body}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
