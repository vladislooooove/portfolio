import Section from "./Section";
import Reveal from "./Reveal";
import { DEEP_DIVE } from "@/lib/content";

export default function DeepDive() {
  return (
    <Section
      tone="void"
      texture={<div className="halo top-[12%] left-[6%] h-[380px] w-[380px]" />}
    >
      <div className="grid grid-cols-1 gap-14 md:grid-cols-12 md:gap-10">
        <div className="md:col-span-5">
          <Reveal>
            <h2 className="font-display max-w-[16ch] text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.02em]">
              {DEEP_DIVE.title}
            </h2>
            <p className="mt-8 max-w-[52ch] text-base leading-relaxed text-muted md:text-lg">
              {DEEP_DIVE.body}
            </p>
          </Reveal>
        </div>

        <div className="flex flex-col gap-4 md:col-span-6 md:col-start-7">
          {DEEP_DIVE.facts.map((fact, i) => (
            <Reveal key={fact.value} delay={0.08 * i}>
              <div
                className={`${
                  i === 0 ? "panel-deep" : "panel"
                } flex flex-col gap-3 p-7 md:flex-row md:items-baseline md:gap-8 md:p-9`}
              >
                <p className="font-mono text-3xl text-glow md:w-40 md:shrink-0 md:text-4xl">
                  {fact.value}
                </p>
                <p className="max-w-[34ch] text-sm leading-relaxed text-text/85 md:text-[1rem]">
                  {fact.label}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
