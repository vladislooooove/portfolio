"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

/**
 * Feedback: interactive elements lean toward the pointer before you click,
 * so the target feels physical. Pointer position is a motion value, never
 * React state, so this never re-renders the tree.
 */
export default function Magnetic({
  children,
  strength = 0.3,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const pull = reduce ? 0 : strength;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 18, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 250, damping: 18, mass: 0.4 });

  return (
    <motion.div
      ref={host}
      className={className}
      style={{ x: sx, y: sy }}
      onPointerMove={(event) => {
        const box = host.current?.getBoundingClientRect();
        if (!box) return;
        x.set((event.clientX - (box.left + box.width / 2)) * pull);
        y.set((event.clientY - (box.top + box.height / 2)) * pull);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
