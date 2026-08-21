"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { markLoaderDone, onSceneReady } from "@/lib/boot";
import MatrixRain from "./MatrixRain";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

/**
 * Holds the page until the things that actually define how it looks are
 * ready: the display face, the deferred assets, and the first rendered frame
 * of the hero scene. Each row is wired to a real event.
 *
 * The counter is paced across MIN_HOLD_MS rather than stepping in thirds, so
 * the climb is continuous. It stops short of 100 and only closes the gap once
 * every row has actually reported in, so the number never claims to be done
 * before the work is.
 *
 * Handover belongs to the canvas. The readout and the rows fade, and then the
 * rain burns down the screen and erases itself, uncovering the page column by
 * column. Nothing here slides. See MatrixRain for how the burn is drawn.
 *
 * The hero is not released until that reveal has finished, so its entrance
 * plays on a page the reader can already see rather than underneath the
 * loader. Scroll stays locked throughout, so the scroll-driven hero reveal
 * always starts from the top.
 */
const STEPS = [
  { key: "runtime", label: "runtime" },
  { key: "stylesheets", label: "stylesheets" },
  { key: "typefaces", label: "typefaces" },
  { key: "assets", label: "assets" },
  { key: "context", label: "webgl context" },
  { key: "scene", label: "hero scene" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];
type Phase = "load" | "flush" | "gone";

const roster = (value: boolean) =>
  Object.fromEntries(STEPS.map((s) => [s.key, value])) as Record<StepKey, boolean>;

/** Every key the browser would scroll the page with. */
const SCROLL_KEYS = new Set([
  " ",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const CEILING_MS = 9000;
const MIN_HOLD_MS = 2600;
/** If the canvas never reports back, leave anyway. */
const REVEAL_CEILING_MS = 3600;

export default function Loader() {
  const reduce = useReducedMotionSafe();
  const [done, setDone] = useState<Record<StepKey, boolean>>(() => roster(false));
  const [phase, setPhase] = useState<Phase>("load");
  const startedAt = useRef(0);
  const handed = useRef(false);

  const count = useMotionValue(0);
  const readout = useTransform(count, (v) =>
    String(Math.min(100, Math.round(v))).padStart(3, "0"),
  );
  const barScale = useTransform(count, (v) => Math.min(1, v / 100));

  const finish = (key: StepKey) =>
    setDone((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

  // Reaching this at all means React has taken the page over.
  useEffect(() => finish("runtime"), []);

  useEffect(() => {
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    );
    const settled = () => links.every((link) => link.sheet);
    if (settled()) {
      finish("stylesheets");
      return;
    }
    const check = () => settled() && finish("stylesheets");
    links.forEach((link) => {
      link.addEventListener("load", check);
      link.addEventListener("error", check);
    });
    return () =>
      links.forEach((link) => {
        link.removeEventListener("load", check);
        link.removeEventListener("error", check);
      });
  }, []);

  // Whether the device can give us a context at all, which is a different
  // question from whether the hero has drawn with it yet.
  useEffect(() => {
    try {
      const probe = document.createElement("canvas");
      if (probe.getContext("webgl2") || probe.getContext("webgl")) finish("context");
      else finish("context");
    } catch {
      finish("context");
    }
  }, []);

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

  useEffect(() => onSceneReady(() => finish("scene")), []);

  // No canvas is mounted under reduced motion, so that row resolves itself.
  useEffect(() => {
    if (reduce) finish("scene");
  }, [reduce]);

  // Never hang on a device that cannot start WebGL at all.
  useEffect(() => {
    const t = window.setTimeout(() => setDone(roster(true)), CEILING_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Eased so it moves quickly at first and crawls the last stretch, which is
  // how a real load behaves. 94 is the ceiling until the rows agree.
  useEffect(() => {
    startedAt.current = performance.now();
    const run = animate(count, 94, {
      duration: MIN_HOLD_MS / 1000,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => run.stop();
  }, [count]);

  useEffect(() => {
    if (phase !== "load") return;
    if (!STEPS.every((s) => done[s.key])) return;

    const remaining = Math.max(
      0,
      (reduce ? 400 : MIN_HOLD_MS) - (performance.now() - startedAt.current),
    );
    const t = window.setTimeout(() => {
      animate(count, 100, { duration: 0.3, ease: [0.16, 1, 0.3, 1] });
      setPhase("flush");
    }, remaining);
    return () => window.clearTimeout(t);
  }, [done, phase, count, reduce]);

  /** The canvas has finished uncovering the page. Release the hero. */
  const handOver = useCallback(() => {
    if (handed.current) return;
    handed.current = true;
    markLoaderDone();
    setPhase("gone");
  }, []);

  useEffect(() => {
    if (phase !== "flush") return;
    if (reduce) {
      const t = window.setTimeout(handOver, 260);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(handOver, REVEAL_CEILING_MS);
    return () => window.clearTimeout(t);
  }, [phase, reduce, handOver]);

  /**
   * Held at the top by refusing the input, not by setting overflow hidden.
   * Toggling overflow takes the scrollbar away and puts it back, and because
   * this page styles ::-webkit-scrollbar Chrome gives it a classic one that
   * occupies real width, so the entire layout stepped sideways by the
   * scrollbar's width the moment the lock came off. Nothing here touches
   * overflow, so there is nothing to step.
   *
   * Wheel, touch and the scrolling keys are swallowed, so the page does not
   * move in the first place. Lenis is stopped over the same window, which is
   * what stops a wheel gesture being animated and then pulled back a frame
   * later; see SmoothScroll. The frame loop is the backstop for the routes
   * neither of those covers: dragging the scrollbar thumb, a focus jump, a
   * hash in the URL.
   */
  useEffect(() => {
    if (phase === "gone") return;

    // The page always opens at the top. Left on "auto" the browser restores
    // the position it remembered for this entry, which lands the reader
    // mid-page behind the loader and hands ScrollTrigger that position as the
    // hero's starting point. Set once and left set: it only takes effect on
    // the next load of this entry, so restoring it on cleanup would put the
    // restore straight back.
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const swallow = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(event.key)) return;
      // Never take a key away from something the reader is typing into.
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
    };

    window.addEventListener("wheel", swallow, { passive: false });
    window.addEventListener("touchmove", swallow, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    let raf = 0;
    const pin = () => {
      raf = requestAnimationFrame(pin);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    raf = requestAnimationFrame(pin);

    return () => {
      window.removeEventListener("wheel", swallow);
      window.removeEventListener("touchmove", swallow);
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(raf);
    };
  }, [phase]);

  if (phase === "gone") return null;

  const flushing = phase === "flush";

  return (
    // The fill is only there to cover the page for the frames before the
    // canvas has painted. Once the burn starts the canvas is the opaque
    // layer, and this has to be out of the way or nothing would show through.
    // Still swallows input while it is up, including through the reveal. The
    // page underneath is only part uncovered for that second and a bit.
    <div className={`fixed inset-0 z-[70] ${flushing ? "" : "bg-void"}`}>
      <MatrixRain flush={flushing && !reduce} onRevealed={handOver} />

      <motion.div
        className="absolute inset-0 flex flex-col justify-between px-6 py-10 md:px-10 md:py-12"
        initial={{ opacity: 1 }}
        animate={{ opacity: flushing ? 0 : 1 }}
        transition={{
          duration: reduce ? 0.2 : 0.34,
          ease: [0.4, 0, 0.2, 1],
        }}
      >
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

          <ul className="flex flex-col gap-2 md:items-end">
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
    </div>
  );
}
