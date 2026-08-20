"use client";

import { motion, type Variants } from "motion/react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

/**
 * Hierarchy: display lines rise out of their own mask, so the headline lands
 * before anything else asks for attention.
 *
 * The viewport observer sits on the unclipped wrapper on purpose. Putting it
 * on the masked line means IntersectionObserver measures a rect that the
 * mask has already clipped away, so it never reports as visible.
 */
const WRAPPER: Variants = {
  hidden: {},
  shown: (delay: number) => ({
    transition: { staggerChildren: 0.09, delayChildren: delay },
  }),
};

const LINE: Variants = {
  hidden: { y: "112%" },
  shown: { y: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
};

const LINE_STILL: Variants = {
  hidden: { y: "112%" },
  shown: { y: 0, transition: { duration: 0 } },
};

export default function SplitLines({
  lines,
  className,
  delay = 0,
  inView = false,
  play = true,
}: {
  lines: string[];
  className?: string;
  delay?: number;
  inView?: boolean;
  /** Holds the lines masked until the loader has handed over. */
  play?: boolean;
}) {
  const reduce = useReducedMotionSafe();

  return (
    <motion.span
      className={`block ${className ?? ""}`}
      custom={reduce ? 0 : delay}
      variants={WRAPPER}
      initial="hidden"
      {...(inView
        ? { whileInView: "shown", viewport: { once: true, amount: 0.35 } }
        : { animate: play ? "shown" : "hidden" })}
    >
      {lines.map((line) => (
        <span key={line} className="block overflow-hidden pb-[0.12em]">
          <motion.span className="block" variants={reduce ? LINE_STILL : LINE}>
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
