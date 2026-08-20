import Section from "./Section";
import Reveal from "./Reveal";
import { LOGO_STRIP, STACK } from "@/lib/content";

export default function Stack() {
  return (
    <Section
      id="stack"
      tone="void"
      texture={<div className="halo bottom-[-10%] left-1/2 h-[420px] w-[520px] -translate-x-1/2" />}
    >
      <Reveal>
        <h2 className="font-display text-[clamp(2rem,4.5vw,3.75rem)] leading-none font-bold tracking-tight">
          The toolkit
        </h2>
      </Reveal>

      <Reveal delay={0.08}>
        <ul className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-6 border-y border-line py-6 md:mt-10 md:gap-x-14">
          {LOGO_STRIP.map((logo) => (
            <li key={logo.slug}>
              <img
                src={`https://cdn.simpleicons.org/${logo.slug}/edeaf5`}
                alt={logo.name}
                title={logo.name}
                width={30}
                height={30}
                loading="lazy"
                decoding="async"
                className="h-6 w-6 opacity-55 transition-all duration-300 ease-[cubic-bezier(0.3,1,0.8,1)] hover:-translate-y-1 hover:opacity-100 md:h-7 md:w-7"
              />
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-9 md:mt-12 md:grid-cols-4 lg:gap-x-10">
        {STACK.map((group, i) => (
          <Reveal key={group.group} delay={0.04 * i}>
            <h3 className="font-mono text-xs text-glow">{group.group}</h3>
            <ul className="mt-4 flex flex-col gap-2">
              {group.items.map((item) => (
                <li key={item} className="text-sm leading-snug text-text/85">
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
