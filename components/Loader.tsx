"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { markLoaderDone, onSceneReady } from "@/lib/boot";
import MatrixRain from "./MatrixRain";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

/**
 * Holds the page until the things that actually define how it looks are
 * ready: the display face, the deferred assets, and the first rendered frame
 * of the hero scene. Each row is wired to a real event, so the readout is
 * the truth rather than a timed fake.
 *
 * Scroll stays locked while it is up, so the scroll-driven hero reveal always
 * starts from the top.
 */
const STEPS = [
  { key: "typefaces", label: "typefaces" },
  { key: "assets", label: "assets" },
  { key: "webgl", label: "webgl scene" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const CEILING_MS = 7000;
const MIN_MS = 320;

export default function Loader() {
  const reduce = useReducedMotionSafe();
  const [done, setDone] = useState<Record<StepKey, boolean>>({
    typefaces: false,
    assets: false,
    webgl: false,
  });
  const [visible, setVisible] = useState(true);

  const target = useMotionValue(4);
  const smooth = useSpring(target, { stiffness: 55, damping: 18, mass: 0.6 });
  const readout = useTransform(smooth, (v) =>
    String(Math.min(100, Math.round(v))).padStart(3, "0"),
  );
  const barScale = useTransform(smooth, (v) => Math.min(1, v / 100));

  const finish = (key: StepKey) =>
    setDone((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  useEffect(() => {
    let cancelled = false;

    document.fonts?.ready.then(() => !cancelled && finish("typefaces"));

    if (document.readyState === "complete") finish("assets");
    else {
      const onLoad = () => finish("assets");
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => onSceneReady(() => finish("webgl")), []);

  // No canvas is mounted under reduced motion, so that row resolves itself.
  useEffect(() => {
    if (reduce) finish("webgl");
  }, [reduce]);

  // Never hang on a device that cannot start WebGL at all.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDone({ typefaces: true, assets: true, webgl: true });
    }, CEILING_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const count = STEPS.filter((s) => done[s.key]).length;
    target.set(4 + (count / STEPS.length) * 96);
    if (count === STEPS.length) {
      const t = window.setTimeout(() => {
        setVisible(false);
        markLoaderDone();
      }, MIN_MS);
      return () => window.clearTimeout(t);
    }
  }, [done, target]);

  useEffect(() => {
    const root = document.documentElement;
    if (visible) {
      window.scrollTo(0, 0);
      root.style.overflow = "hidden";
    } else {
      root.style.overflow = "";
    }
    return () => {
      root.style.overflow = "";
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[70] flex flex-col justify-between bg-void px-6 py-10 md:px-10 md:py-12"
          initial={{ opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "-100%" }}
          transition={{ duration: reduce ? 0.2 : 0.72, ease: [0.76, 0, 0.24, 1] }}
        >
          <MatrixRain />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(88%_66%_at_50%_56%,rgba(10,7,16,0.92)_0,rgba(10,7,16,0.42)_62%,rgba(10,7,16,0)_100%)]"
          />

          <p className="relative font-mono text-xs text-muted">
            Vladyslav Prozapas
          </p>

          <div className="relative flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <motion.p
              className="font-mono text-[clamp(4rem,16vw,12rem)] leading-[0.8] text-text tabular-nums"
              aria-live="polite"
              aria-label="Loading progress"
            >
              {readout}
            </motion.p>

            <ul className="flex flex-col gap-2.5 md:items-end">
              {STEPS.map((step) => (
                <li
                  key={step.key}
                  className="flex items-center gap-3 font-mono text-xs md:text-sm"
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 transition-colors duration-300 ${
                      done[step.key] ? "bg-glow" : "bg-line-control"
                    }`}
                  />
                  <span className={done[step.key] ? "text-text" : "text-muted"}>
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative h-px w-full bg-line">
            <motion.div
              style={{ scaleX: barScale }}
              className="h-px w-full origin-left bg-accent"
              aria-hidden="true"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
