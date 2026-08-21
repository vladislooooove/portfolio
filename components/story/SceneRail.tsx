"use client";

import { useState } from "react";
import { motion, useMotionValueEvent, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";
import { CHAPTERS } from "@/lib/story";

/**
 * Where the reader is in the prologue.
 *
 * The sequence has no landmarks of its own: there is no copy to have got
 * halfway down and nothing that says how much of it is left, so a reader who
 * stops scrolling has no way of knowing whether the next beat is one turn of
 * the wheel away or ten. This is that, and only that.
 *
 * A rail down the right edge because the page already has one down the left,
 * so the two read as a pair rather than as a new piece of furniture. Ticks are
 * the beats rather than an even scale, which is why they are not evenly
 * spaced: the landscape takes most of the run and the screen resolves quickly.
 *
 * The marker travels on a motion value and never touches React. Only the
 * label re-renders, once per chapter.
 *
 * The chapters themselves come from the timeline the scroll ranges are built
 * from, so a beat cannot move without its tick moving with it.
 */
const RAIL = "38vh";

export default function SceneRail({ progress }: { progress: MotionValue<number> }) {
  const [chapter, setChapter] = useState(0);

  useMotionValueEvent(progress, "change", (v) => {
    let next = 0;
    for (let i = 0; i < CHAPTERS.length; i++) if (v >= CHAPTERS[i].at) next = i;
    setChapter((prev) => (prev === next ? prev : next));
  });

  const travel = useTransform(progress, [0, 1], ["0vh", RAIL]);
  const fill = useTransform(progress, [0, 1], [0, 1]);
  // Up from the first frame, since the reader needs it most before they have
  // scrolled at all, and out of the way once the prologue has handed over
  // rather than riding up the page with the pin release.
  const shown = useTransform(progress, [0.9, 0.99], [1, 0]);

  return (
    <motion.div
      style={{ opacity: shown }}
      className="pointer-events-none absolute top-1/2 right-6 z-10 -translate-y-1/2 md:right-10"
      aria-hidden="true"
    >
      <div className="relative h-[38vh] w-px bg-line">
        <motion.div
          style={{ scaleY: fill }}
          className="absolute inset-x-0 top-0 h-full origin-top bg-accent"
        />

        {CHAPTERS.map((mark) => (
          <span
            key={mark.label}
            style={{ top: `${mark.at * 100}%` }}
            className="absolute right-0 h-px w-2 bg-line-control"
          />
        ))}

        <motion.div style={{ y: travel }} className="absolute top-0 right-0">
          <span className="absolute top-0 right-0 block h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 bg-glow" />
          <motion.span
            key={CHAPTERS[chapter].label}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-0 right-5 block -translate-y-1/2 font-mono text-[10px] tracking-[0.22em] whitespace-nowrap text-muted uppercase"
          >
            {CHAPTERS[chapter].label}
          </motion.span>
        </motion.div>
      </div>
    </motion.div>
  );
}
