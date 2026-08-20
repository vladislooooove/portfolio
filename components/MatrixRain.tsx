"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

/**
 * Character rain for the loading screen. Kept in the page palette rather than
 * the original green, so the loader still belongs to the site: violet trail,
 * near-white leading glyph.
 *
 * 2D canvas on purpose. This runs before the WebGL chunk has loaded, so it
 * must not depend on it, and a trail effect is cheaper as a translucent fill
 * than as a shader.
 */
const GLYPHS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789<>{}[]()/\\|=+-*!?$#&%";

const FONT_SIZE = 16;
const FRAME_MS = 46;

export default function MatrixRain() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotionSafe();

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;
    let columns = 0;
    let drops: number[] = [];
    let dpr = 1;

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
      ctx.fillStyle = "#0a0710";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    };

    const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

    const paint = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Translucent wash instead of a clear, which leaves the trails behind.
      ctx.fillStyle = "rgba(10, 7, 16, 0.09)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px var(--font-geist-mono), ui-monospace, monospace`;
      ctx.textBaseline = "top";

      for (let i = 0; i < columns; i++) {
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;

        ctx.fillStyle = "#edeaf5";
        ctx.fillText(glyph(), x, y);

        ctx.fillStyle = "rgba(167, 139, 250, 0.75)";
        ctx.fillText(glyph(), x, y - FONT_SIZE);

        ctx.fillStyle = "rgba(139, 92, 246, 0.34)";
        ctx.fillText(glyph(), x, y - FONT_SIZE * 3);

        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
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
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
    />
  );
}
