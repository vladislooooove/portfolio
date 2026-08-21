"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { useScroll, useTransform } from "motion/react";
import Reveal from "./Reveal";
import { COMPANIES } from "@/lib/content";

const PcbBackdrop = dynamic(() => import("./PcbBackdrop"), { ssr: false });

/**
 * The board arrives under the hero and this section is what stands on it, so
 * the ground here is void rather than a fill of its own.
 *
 * A 200dvh box with a pinned stage inside it buys the scroll length for the
 * seam into Selected work. That seam is parked along with Selected work; see
 * the block at the foot of this file.
 */
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
  const host = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: host,
    offset: ["start start", "end end"],
  });
  // Spans the whole time the board is on screen, which starts while the hero
  // is still pinned above it and ends once this section has gone.
  const { scrollYProgress: drift } = useScroll({
    target: host,
    offset: ["start end", "end start"],
  });
  /*
   * The board is meant to go out with the tear, so the work section does not
   * arrive over a lit circuit. Both are parked together: with the tear off,
   * this fade left the last viewport of the section standing on bare void.
   * Restore it to [0, 0.4, 0.82, 1] -> [0, 0, 1, 1] when Selected work is back.
   */
  const leave = useTransform(scrollYProgress, [0, 1], [0, 0]);

  return (
    <section
      ref={host}
      id="teams"
      className="relative h-[200dvh] w-full bg-void motion-reduce:h-auto"
    >
      <PcbBackdrop leave={leave} drift={drift} />
      <div className="sticky top-0 flex h-[100dvh] w-full flex-col justify-between overflow-hidden py-28 md:py-36 motion-reduce:static motion-reduce:h-auto">
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 md:px-10 lg:pl-[132px]">
          <Reveal>
            <h2 className="font-display max-w-[16ch] text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] font-bold tracking-tight">
              Teams I have shipped for
            </h2>
          </Reveal>
        </div>

        <div className="ticker relative z-10 overflow-hidden py-4">
          <div className="ticker-track flex w-max">
            <Run />
            <Run hidden />
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-void to-transparent md:w-52" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-void to-transparent md:w-52" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 md:px-10 lg:pl-[132px]">
          <Reveal delay={0.1}>
            <p className="ml-auto max-w-[46ch] text-base leading-relaxed text-muted md:text-right md:text-lg">
              10 years of contracts and full-time seats. Healthcare, telecoms,
              logistics, travel, and a stretch of agency client work.
            </p>
          </Reveal>
        </div>

        {/* Parked with Selected work, which is what it uncovers. Restore this
            and the `tear` value above when that section comes back. */}
        {/* {!reduce && (
          <div className="pointer-events-none absolute inset-0 z-20">
            <TearReveal progress={tear} color="#0a0710" accent="#8b5cf6" />
          </div>
        )} */}
      </div>
    </section>
  );
}
