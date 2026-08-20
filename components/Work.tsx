"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";
import dynamic from "next/dynamic";
import SplitLines from "./SplitLines";
import { PROJECTS } from "@/lib/content";

const ProjectField = dynamic(() => import("./webgl/ProjectField"), { ssr: false });

const TURB = [0.35, 0.95, 1.6];
const SEED = [0, 2.4, 5.1];

function Panel({
  project,
  index,
  onActive,
}: {
  project: (typeof PROJECTS)[number];
  index: number;
  onActive: (i: number) => void;
}) {
  const host = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();

  const { scrollYProgress } = useScroll({
    target: host,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["4%", "-4%"]);
  const fade = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.15, 1, 1, 0.15]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && onActive(index),
      { threshold: 0.45 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [index, onActive]);

  return (
    <article
      ref={host}
      className="flex min-h-[100dvh] items-center px-6 py-28 md:px-10"
    >
      <motion.div
        style={reduce ? undefined : { y, opacity: fade }}
        className="mx-auto w-full max-w-[1400px]"
      >
        <dl className="grid max-w-2xl grid-cols-2 gap-x-8 gap-y-4 font-mono text-xs md:grid-cols-4 md:text-sm">
          {[
            ["Client", project.client],
            ["Sector", project.sector],
            ["Period", project.period],
            ["Seat", project.seat],
          ].map(([term, value]) => (
            <div key={term} className="border-t border-line-control/60 pt-3">
              <dt className="text-muted">{term}</dt>
              <dd className="mt-1 text-text">{value}</dd>
            </div>
          ))}
        </dl>

        <h3 className="font-display mt-10 max-w-[18ch] text-[clamp(2.25rem,6.4vw,6rem)] leading-[0.95] font-bold tracking-[-0.03em] md:mt-14">
          <SplitLines lines={[project.title]} inView />
        </h3>

        <div className="mt-10 grid grid-cols-1 gap-8 md:mt-14 md:grid-cols-12">
          <p className="max-w-[60ch] text-base leading-relaxed text-text/90 md:col-span-6 md:text-lg">
            {project.body}
          </p>
          <ul className="flex flex-wrap gap-2 self-start md:col-span-5 md:col-start-8 md:justify-end">
            {project.stack.map((tech) => (
              <li
                key={tech}
                className="border border-line-control/70 bg-void/50 px-3 py-1.5 font-mono text-xs text-text backdrop-blur-sm"
              >
                {tech}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </article>
  );
}

export default function Work() {
  const [active, setActive] = useState(0);
  const host = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();


  return (
    <section id="work" ref={host} className="relative">
      <div className="pointer-events-none absolute inset-0">
        <div className="sticky top-0 h-[100dvh] w-full overflow-hidden">
          <ProjectField turb={TURB[active]} seed={SEED[active]} />
          {/* Scrim sized so body copy clears WCAG AA over the brightest bands
              while the field still reads. Measured, not guessed. */}
          <div className="absolute inset-0 bg-void/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-void/60" />
        </div>
      </div>

      <div className="relative z-10">
        <div className="mx-auto max-w-[1400px] px-6 pt-28 md:px-10 md:pt-36">
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.75rem)] leading-none font-bold tracking-tight">
            Selected work
          </h2>
          <div className="rule mt-8" />
        </div>

        {PROJECTS.map((project, i) => (
          <Panel key={project.key} project={project} index={i} onActive={setActive} />
        ))}
      </div>
    </section>
  );
}
