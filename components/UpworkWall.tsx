import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Section from "./Section";
import Reveal from "./Reveal";
import { LINKS, UPWORK_REVIEWS } from "@/lib/content";

export default function UpworkWall() {
  if (UPWORK_REVIEWS.length === 0) return null;

  return (
    <Section tone="void">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.75rem)] leading-none font-bold tracking-tight">
            And from Upwork
          </h2>
          <a
            href={LINKS.upwork}
            target="_blank"
            rel="noreferrer noopener"
            className="link-wipe inline-flex items-center gap-2 font-mono text-xs text-muted hover:text-glow"
          >
            All {UPWORK_REVIEWS.length} are on my profile
            <ArrowUpRight size={13} weight="regular" />
          </a>
        </div>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
        {UPWORK_REVIEWS.map((review, i) => (
          <Reveal
            key={review}
            delay={0.04 * i}
            className={`${i % 4 === 0 ? "panel-deep" : "panel"} flex flex-col justify-between p-6 md:p-7`}
          >
            <p className="text-sm leading-relaxed text-text/90">&ldquo;{review}&rdquo;</p>
            <cite className="mt-5 block font-mono text-xs text-muted not-italic">
              Upwork client
            </cite>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
