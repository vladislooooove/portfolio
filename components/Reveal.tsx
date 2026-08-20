"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

export default function Reveal({
  children,
  className,
  delay = 0,
  y = 30,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  // Markup must not depend on the media query, or the server and the first
  // client render disagree and React throws the tree away on hydration.
  const reduce = useReducedMotionSafe();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }
      }
    >
      {children}
    </motion.div>
  );
}
