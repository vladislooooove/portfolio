"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

/**
 * Custom cursor, requested explicitly. Guards, because these usually cost
 * more than they give:
 *
 *  - fine pointers only, so a touch device never loses its native behaviour
 *  - stands down entirely under reduced motion, native cursor returns
 *  - the dot tracks the pointer 1:1 with no spring, so pointing stays exact
 *    and only the ring lags
 *  - position lives in motion values, so moving the mouse never re-renders
 *  - no blend mode. A fixed blended layer forces the whole viewport to
 *    re-composite on every scroll frame, and the page is dark enough that a
 *    solid dot reads fine without one
 *
 * The native cursor is hidden through a class this component adds, so with
 * JavaScript off nothing is hidden.
 */
type Mode = "default" | "interactive" | "text";

const INTERACTIVE = 'a, button, [role="button"], summary, label';
const TEXT_FIELD = "input, textarea, [contenteditable='true']";

export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>("default");
  const [down, setDown] = useState(false);
  const [visible, setVisible] = useState(false);

  const x = useMotionValue(-200);
  const y = useMotionValue(-200);
  const ringX = useSpring(x, { stiffness: 380, damping: 32, mass: 0.4 });
  const ringY = useSpring(y, { stiffness: 380, damping: 32, mass: 0.4 });

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const decide = () => setEnabled(fine.matches && !calm.matches);
    decide();
    fine.addEventListener("change", decide);
    calm.addEventListener("change", decide);
    return () => {
      fine.removeEventListener("change", decide);
      calm.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("has-custom-cursor");

    const onMove = (event: PointerEvent) => {
      x.set(event.clientX);
      y.set(event.clientY);
      if (!visible) setVisible(true);
      const target = event.target as Element | null;
      if (!target?.closest) return;
      if (target.closest(TEXT_FIELD)) setMode("text");
      else if (target.closest(INTERACTIVE)) setMode("interactive");
      else setMode("default");
    };
    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);
    const onDown = () => setDown(true);
    const onUp = () => setDown(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);

    return () => {
      root.classList.remove("has-custom-cursor");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [enabled, visible, x, y]);

  if (!enabled) return null;

  const ringSize =
    mode === "interactive" ? 58 : mode === "text" ? 0 : 34;
  const dotSize = mode === "text" ? 2 : mode === "interactive" ? 4 : 6;
  const dotHeight = mode === "text" ? 24 : dotSize;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100]">
      <motion.div
        className="absolute top-0 left-0"
        style={{ x: ringX, y: ringY }}
        animate={{ opacity: visible && mode !== "text" ? 1 : 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Centring lives on a static wrapper. Putting it in a Tailwind
            transform class lets Motion's rotate and scale wipe it out. */}
        <div className="-translate-x-1/2 -translate-y-1/2">
        <motion.div
          className="relative rounded-full border"
          animate={{
            width: ringSize,
            height: ringSize,
            borderColor:
              mode === "interactive" ? "rgb(139 92 246)" : "rgb(167 139 250 / 0.68)",
            rotate: mode === "interactive" ? 45 : 0,
            scale: down ? 0.86 : 1,
          }}
          transition={{ type: "spring", stiffness: 320, damping: 26, mass: 0.5 }}
        >
          {[
            "left-1/2 top-0 h-[5px] w-px -translate-x-1/2 -translate-y-1/2",
            "left-1/2 bottom-0 h-[5px] w-px -translate-x-1/2 translate-y-1/2",
            "top-1/2 left-0 w-[5px] h-px -translate-y-1/2 -translate-x-1/2",
            "top-1/2 right-0 w-[5px] h-px -translate-y-1/2 translate-x-1/2",
          ].map((tick) => (
            <motion.span
              key={tick}
              className={`absolute bg-accent ${tick}`}
              animate={{ opacity: mode === "interactive" ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="absolute top-0 left-0"
        style={{ x, y }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          className="-translate-x-1/2 -translate-y-1/2 bg-text"
          animate={{
            width: mode === "text" ? 2 : dotSize,
            height: dotHeight,
            borderRadius: mode === "text" ? 1 : 999,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.4 }}
        />
      </motion.div>
    </div>
  );
}
