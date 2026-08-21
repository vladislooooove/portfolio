"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

/**
 * Character rain for the loading screen, and the reveal that follows it.
 *
 * 2D canvas on purpose. This runs before the WebGL chunk has loaded, so it
 * must not depend on it, and a trail effect is cheaper as a translucent fill
 * than as a shader.
 *
 * The canvas is the only opaque layer over the page. That is what makes the
 * handover work: on `flush` each column grows a burn head that travels down
 * the screen, and everything above that head is erased out of the canvas with
 * `destination-out`. The site is uncovered by the rain itself rather than by
 * a curtain sliding off it. Columns run at different speeds, so the page
 * arrives in ragged strips the way the rain falls.
 *
 * `flush` is read through a ref. As a dependency it would restart the effect,
 * reseed every column, and the rain would visibly jump at the worst moment.
 */
const GLYPHS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789<>{}[]()/\\|=+-*!?$#&%";

const FONT_SIZE = 16;
const FRAME_MS = 46;

/** Column erase speeds, px per second. The spread is the whole effect. */
const BURN_MIN = 420;
const BURN_MAX = 1150;
/** Soft alpha ramp at the burn head, so it is not a ruled line. */
const EDGE = 34;

export default function MatrixRain({
  flush = false,
  onRevealed,
}: {
  flush?: boolean;
  onRevealed?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flushing = useRef(false);
  const revealedCb = useRef(onRevealed);
  const reduce = useReducedMotionSafe();

  useEffect(() => {
    flushing.current = flush;
  }, [flush]);

  useEffect(() => {
    revealedCb.current = onRevealed;
  }, [onRevealed]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let columns = 0;
    let drops: number[] = [];
    let burn: number[] = [];
    let burnRate: number[] = [];
    let dpr = 1;
    let done = false;
    let burnFrom = 0;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.floor(window.innerWidth * dpr);
      node.height = Math.floor(window.innerHeight * dpr);
      node.style.width = `${window.innerWidth}px`;
      node.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      columns = Math.ceil(window.innerWidth / FONT_SIZE);
      // Seeded across the full height, not above it, so the screen is
      // populated on the first frame rather than a second in.
      const rows = Math.ceil(window.innerHeight / FONT_SIZE);
      drops = Array.from({ length: columns }, () =>
        Math.floor(Math.random() * rows * 1.4),
      );
      // Reseeded only while the rain is still steady. Resetting these during
      // the reveal would send every head back to the top and play it twice.
      if (!flushing.current || burn.length !== columns) {
        burn = new Array(columns).fill(0);
        burnRate = Array.from(
          { length: columns },
          () => BURN_MIN + Math.random() * (BURN_MAX - BURN_MIN),
        );
      }
      ctx.globalCompositeOperation = "source-over";
      if (!flushing.current) {
        ctx.fillStyle = "#0a0710";
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

    const setFont = () => {
      ctx.font = `${FONT_SIZE}px var(--font-geist-mono), ui-monospace, monospace`;
      ctx.textBaseline = "top";
    };

    /** Steady state: wash the whole frame, then advance every column once. */
    const paint = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Translucent wash instead of a clear, which leaves the trails behind.
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(10, 7, 16, 0.09)";
      ctx.fillRect(0, 0, w, h);
      setFont();

      for (let i = 0; i < columns; i++) {
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;

        ctx.fillStyle = "#edeaf5";
        ctx.fillText(glyph(), x, y);

        ctx.fillStyle = "rgba(167, 139, 250, 0.62)";
        ctx.fillText(glyph(), x, y - FONT_SIZE);

        ctx.fillStyle = "rgba(139, 92, 246, 0.26)";
        ctx.fillText(glyph(), x, y - FONT_SIZE * 3);

        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    /**
     * Handover: the wash is applied only under each burn head, so the part
     * already erased is never painted back in, and the clear runs as a solid
     * block plus a short gradient so the boundary dissolves instead of ruling
     * a line across the page.
     */
    const burnDown = (now: number) => {
      const h = window.innerHeight;
      if (!burnFrom) burnFrom = now;
      // Driven from elapsed time, not from the frame delta. Per frame, a
      // device that drops to 12fps stretches the whole reveal by the same
      // factor, which is how this ran past its own ceiling.
      const elapsed = (now - burnFrom) / 1000;

      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(10, 7, 16, 0.11)";
      for (let i = 0; i < columns; i++) {
        const head = burn[i];
        if (head < h) ctx.fillRect(i * FONT_SIZE, head, FONT_SIZE, h - head);
      }

      // One gradient per frame, positioned per column by the transform.
      const edge = ctx.createLinearGradient(0, -EDGE, 0, 0);
      edge.addColorStop(0, "rgba(0,0,0,1)");
      edge.addColorStop(1, "rgba(0,0,0,0)");

      ctx.globalCompositeOperation = "destination-out";
      let open = 0;
      for (let i = 0; i < columns; i++) {
        burn[i] = Math.min(h + EDGE, elapsed * burnRate[i]);
        const head = burn[i];
        if (head >= h + EDGE) open++;
        const solid = head - EDGE;
        if (solid > 0) {
          // Opaque, and set every pass. Under destination-out the source
          // alpha IS the erase strength, and leaving the wash's 0.11 here
          // rubbed out only a ninth of each column per frame. What survived
          // was a full screen of ghost glyphs sitting over the hero, and a
          // visible pop when the canvas finally unmounted.
          ctx.fillStyle = "#000";
          ctx.fillRect(i * FONT_SIZE, 0, FONT_SIZE, solid);
        }
        ctx.save();
        ctx.translate(i * FONT_SIZE, head);
        ctx.fillStyle = edge;
        ctx.fillRect(0, -EDGE, FONT_SIZE, EDGE);
        ctx.restore();
      }

      // Nothing may be left behind: the canvas is removed from the page a
      // beat later, and any remnant leaves as a step rather than a fade.
      if (open === columns) {
        ctx.clearRect(0, 0, window.innerWidth, h);
      }

      ctx.globalCompositeOperation = "source-over";
      setFont();
      for (let i = 0; i < columns; i++) {
        const x = i * FONT_SIZE;
        const head = burn[i];
        if (head >= h) continue;

        // The head itself, bright, so the edge reads as burning rather than
        // as a rectangle that stopped being drawn.
        ctx.fillStyle = "#f6f4fb";
        ctx.fillText(glyph(), x, head);
        ctx.fillStyle = "rgba(196, 181, 253, 0.92)";
        ctx.fillText(glyph(), x, head + FONT_SIZE);
        ctx.fillStyle = "rgba(139, 92, 246, 0.5)";
        ctx.fillText(glyph(), x, head + FONT_SIZE * 2.4);

        // The ordinary drop keeps falling underneath, faster than before.
        const y = drops[i] * FONT_SIZE;
        if (y > head) {
          ctx.fillStyle = "#edeaf5";
          ctx.fillText(glyph(), x, y);
          ctx.fillStyle = "rgba(167, 139, 250, 0.55)";
          ctx.fillText(glyph(), x, y - FONT_SIZE);
        }
        drops[i] += 3;
        if (y > h) drops[i] = head / FONT_SIZE;
      }

      if (!done && open === columns) {
        done = true;
        revealedCb.current?.();
      }
    };

    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);

      // The burn runs every frame. Gating it to the rain's own cadence made
      // the reveal step down the screen instead of sliding.
      if (flushing.current) {
        burnDown(time);
        return;
      }
      if (time - last < FRAME_MS) return;
      last = time;
      paint();
    };

    resize();
    // Lay down a few passes up front so trails already exist.
    for (let pass = 0; pass < 8; pass++) paint();

    if (reduce) {
      // One still frame, so the screen still reads as the same thing.
      for (let pass = 0; pass < 18; pass++) paint();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }

    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
