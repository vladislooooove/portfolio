"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotionSafe } from "./useReducedMotionSafe";
import { TIMELINE, TIMELINE_NOTE } from "@/lib/content";

gsap.registerPlugin(ScrollTrigger);

export default function Timeline() {
  const wrap = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotionSafe();


  useEffect(() => {
    const trackEl = track.current;
    if (!trackEl) return;

    if (reduce) {
      trackEl.classList.add("overflow-x-auto", "snap-x", "snap-mandatory");
      return () => {
        trackEl.classList.remove("overflow-x-auto", "snap-x", "snap-mandatory");
      };
    }

    // Storytelling: time runs left to right, so vertical scroll pans the
    // career sideways instead of stacking it.
    const ctx = gsap.context(() => {
      const distance = () => trackEl.scrollWidth - window.innerWidth;
      gsap.to(trackEl, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: wrap.current,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (bar.current) gsap.set(bar.current, { scaleX: self.progress });
          },
        },
      });
    }, wrap);

    return () => ctx.revert();
  }, [reduce]);

  return (
    <section
      id="experience"
      ref={wrap}
      className="relative overflow-hidden bg-surf"
    >
      <div className="relative z-10 flex h-[100dvh] flex-col">
        <div className="mx-auto w-full max-w-[1400px] shrink-0 px-6 pt-28 md:px-10 md:pt-32">
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.75rem)] leading-none font-bold tracking-tight">
            Where the 10 years went
          </h2>
          <div className="mt-7 h-px w-full bg-line">
            <div
              ref={bar}
              className="h-px w-full origin-left scale-x-0 bg-accent"
              aria-hidden="true"
            />
          </div>
        </div>

        <div
          ref={track}
          className="flex flex-1 items-center gap-5 px-6 md:gap-8 md:px-10"
        >
          {TIMELINE.map((entry, i) => (
            <article
              key={entry.org}
              className={`${
                i === 0 ? "panel-deep" : "panel"
              } flex w-[82vw] shrink-0 snap-start flex-col justify-between p-7 sm:w-[58vw] md:p-9 lg:w-[30vw]`}
            >
              <div>
                <p className="font-mono text-sm text-glow">{entry.period}</p>
                <h3 className="font-display mt-5 text-2xl font-bold tracking-tight md:text-3xl">
                  {entry.org}
                </h3>
                <p className="mt-2 text-sm text-muted">{entry.seat}</p>
                <p className="mt-1 font-mono text-xs text-muted">{entry.place}</p>
              </div>
              <p className="mt-8 max-w-[44ch] text-sm leading-relaxed text-text/85">
                {entry.body}
              </p>
            </article>
          ))}

          <div className="flex w-[70vw] shrink-0 items-center sm:w-[40vw] lg:w-[24vw]">
            <p className="max-w-[30ch] text-sm leading-relaxed text-muted">
              {TIMELINE_NOTE}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
