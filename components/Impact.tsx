import Section from "./Section";
import Reveal from "./Reveal";
import { IMPACT } from "@/lib/content";

export default function Impact() {
  return (
    <Section
      tone="surf-2"
      texture={
        <>
          <div className="lattice absolute inset-0 opacity-60" />
          <div className="halo top-1/2 right-[8%] h-[340px] w-[340px] -translate-y-1/2" />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-y-12 sm:grid-cols-2 md:gap-y-20 lg:grid-cols-4">
        {IMPACT.map((item, i) => (
          <Reveal
            key={item.value}
            delay={0.08 * i}
            className={`lg:px-8 ${i > 0 ? "lg:border-l lg:border-line" : ""} ${
              i === 0 ? "lg:pl-0" : ""
            }`}
          >
            <p className="font-mono text-[clamp(3.5rem,8vw,7rem)] leading-[0.86] text-text">
              {item.value}
            </p>
            <p className="mt-6 max-w-[24ch] text-sm leading-relaxed text-muted md:text-[1rem]">
              {item.label}
            </p>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
