"use client";

import { useState } from "react";
import { motion, useMotionValueEvent, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { CHAPTERS, chapterAt } from "@/lib/story";

/**
 * Where the reader is in the prologue.
 *
 * The sequence has no landmarks of its own: there is no copy to have got
 * halfway down and nothing that says how much of it is left, so a reader who
 * stops scrolling has no way of knowing whether the next beat is one turn of
 * the wheel away or ten. This is that, and only that.
 *
 * A rail down the right edge because the page already has one down the left,
 * so the two read as a pair rather than as a new piece of furniture. Four even
 * steps rather than four true distances: see lib/story for why.
 *
 * The fill and the marker travel on motion values and never touch React. Only
 * the active chapter re-renders, three times in the whole sequence.
 */
const RAIL = 44;

export default function SceneRail({ progress }: { progress: MotionValue<number> }) {
  const [live, setLive] = useState({ index: 0, local: 0 });

  useMotionValueEvent(progress, "change", (v) => {
    const next = chapterAt(v);
    setLive((prev) =>
      prev.index === next.index && Math.abs(prev.local - next.local) < 0.02 ? prev : next,
    );
  });

  const walk = useTransform(progress, (v) => {
    const { index, local } = chapterAt(v);
    return ((index + local) / CHAPTERS.length) * RAIL;
  });
  const travel = useTransform(walk, (v) => `${v}vh`);
  const fill = useTransform(walk, (v) => v / RAIL);
  // Up from the first frame, since the reader needs it most before they have
  // scrolled at all, and out of the way once the prologue has handed over
  // rather than riding up the page with the pin release.
  const shown = useTransform(progress, [0.975, 0.999], [1, 0]);

  return (
    <motion.div
      style={{ opacity: shown }}
      className="pointer-events-none absolute top-1/2 right-6 z-10 -translate-y-1/2 md:right-10"
      aria-hidden="true"
    >
      <div className="relative w-px bg-line" style={{ height: `${RAIL}vh` }}>
        <motion.div
          style={{ scaleY: fill }}
          className="absolute inset-x-0 top-0 h-full origin-top bg-accent"
        />

        {CHAPTERS.map((chapter, i) => {
          const active = i === live.index;
          const ahead = chapter.from === undefined;
          return (
            <span
              key={chapter.label}
              style={{ top: `${(i / CHAPTERS.length) * 100}%` }}
              className="absolute right-0 flex -translate-y-1/2 items-center gap-3 whitespace-nowrap"
            >
              <span
                className={`font-mono text-[10px] tracking-[0.22em] uppercase transition-colors duration-500 ${
                  active ? "text-text" : ahead ? "text-line-control" : "text-muted"
                }`}
              >
                {chapter.label}
              </span>
              <span
                className={`h-px w-2 shrink-0 transition-colors duration-500 ${
                  active ? "bg-glow" : ahead ? "bg-line" : "bg-line-control"
                }`}
              />
            </span>
          );
        })}

        <motion.span
          style={{ y: travel }}
          className="absolute top-0 right-0 block h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 bg-glow"
        />
      </div>
    </motion.div>
  );
}
