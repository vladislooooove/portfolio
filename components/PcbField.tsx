"use client";

import { useEffect, useRef } from "react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

/**
 * A board, and the signals running on it.
 *
 * Traces are routed the way a real one is: axis aligned runs joined by 45
 * degree corners, never a free curve. They are generated once and drawn once
 * into an offscreen canvas, so the per frame cost is a single blit plus the
 * handful of short segments that are actually lit.
 *
 * A signal is a span of its trace between two lengths along the path, drawn
 * additively as three passes of decreasing width. Canvas shadowBlur would be
 * the obvious way to glow and is far too slow to do per frame.
 *
 * Layout is seeded rather than random, so it does not reshuffle on every
 * reload and a resize lands somewhere recognisable.
 */
const TRACE_BUS = "rgba(139, 92, 246, 0.62)";
const TRACE_DIM = "rgba(124, 77, 219, 0.4)";
const TRACE_FAINT = "rgba(109, 77, 224, 0.22)";
const PAD = "rgba(167, 139, 250, 0.55)";
const GROUND = "#0a0710";

type Trace = {
  pts: { x: number; y: number }[];
  cum: number[];
  len: number;
  weight: number;
};

/**
 * A signal is not one thing travelling; it is three. The pad it leaves fires,
 * the run crosses the board, and the pad it lands on fires. Phase 0 is the
 * gap in between.
 */
type Phase = 0 | 1 | 2 | 3;

type Signal = {
  trace: number;
  phase: Phase;
  t: number;
  head: number;
  speed: number;
  tail: number;
};

const FIRE_IN = 0.34;
const FIRE_OUT = 0.5;

/** Deterministic, so the board is the same board every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function buildTraces(w: number, h: number, count: number): Trace[] {
  const rand = rng(0x5eed);
  const traces: Trace[] = [];
  const step = Math.max(42, Math.round(Math.min(w, h) / 17));

  for (let i = 0; i < count; i++) {
    // All four edges, or the board crowds against whichever one it started
    // from and leaves the far side bare.
    const edge = i % 4;
    let x: number;
    let y: number;
    let dx: number;
    let dy: number;
    if (edge === 0) {
      x = -step * 2;
      y = rand() * h;
      dx = 1;
      dy = 0;
    } else if (edge === 1) {
      x = w + step * 2;
      y = rand() * h;
      dx = -1;
      dy = 0;
    } else if (edge === 2) {
      x = rand() * w;
      y = -step * 2;
      dx = 0;
      dy = 1;
    } else {
      x = rand() * w;
      y = h + step * 2;
      dx = 0;
      dy = -1;
    }

    const pts = [{ x, y }];
    const legs = 4 + Math.floor(rand() * 6);

    for (let leg = 0; leg < legs; leg++) {
      x += dx * step * (1 + Math.floor(rand() * 3));
      y += dy * step * (1 + Math.floor(rand() * 3));
      pts.push({ x, y });

      // The 45 degree elbow, then the axis swaps. Run, mitre, run is what
      // makes it read as routing rather than as a maze.
      const sign = rand() > 0.5 ? 1 : -1;
      const mitre = step * (0.4 + rand() * 0.8);
      const px = dx !== 0 ? dx : sign;
      const py = dy !== 0 ? dy : sign;
      x += px * mitre;
      y += py * mitre;
      pts.push({ x, y });

      if (dx !== 0) {
        dy = py;
        dx = 0;
      } else {
        dx = px;
        dy = 0;
      }

      if (x < -step * 3 || x > w + step * 3 || y < -step * 3 || y > h + step * 3) break;
    }

    if (pts.length < 3) continue;

    const cum = [0];
    let len = 0;
    for (let p = 1; p < pts.length; p++) {
      len += Math.hypot(pts[p].x - pts[p - 1].x, pts[p].y - pts[p - 1].y);
      cum.push(len);
    }
    if (len < step * 3) continue;

    // A few heavy runs among the hair thin ones, the way a board carries a
    // bus next to its signal lines.
    const roll = rand();
    traces.push({ pts, cum, len, weight: roll > 0.9 ? 4 : roll > 0.68 ? 2.4 : 1.2 });
  }
  return traces;
}

type Chip = { cx: number; cy: number; size: number; pad: number };
type Part = { x: number; y: number; w: number; h: number; vertical: boolean };

function makeChip(w: number, h: number): Chip {
  const size = Math.max(150, Math.min(Math.min(w, h) * 0.3, 360));
  return { cx: w / 2, cy: h / 2, size, pad: size * 0.13 };
}

/**
 * Runs leaving the package. Real fan-out breaks away perpendicular to the
 * edge it came from before it starts turning, which is why these get a stub
 * before the first mitre.
 */
function fanout(chip: Chip, w: number, h: number): Trace[] {
  const rand = rng(0xfa0);
  const out: Trace[] = [];
  const half = chip.size / 2;
  const step = Math.max(40, Math.round(Math.min(w, h) / 18));
  const perSide = 7;

  for (let side = 0; side < 4; side++) {
    for (let n = 0; n < perSide; n++) {
      const along = ((n + 0.5) / perSide - 0.5) * chip.size * 0.82;
      let x = chip.cx;
      let y = chip.cy;
      let dx = 0;
      let dy = 0;
      if (side === 0) { x -= half; y += along; dx = -1; }
      else if (side === 1) { x += half; y += along; dx = 1; }
      else if (side === 2) { x += along; y -= half; dy = -1; }
      else { x += along; y += half; dy = 1; }

      const pts = [{ x, y }];
      x += dx * step * 0.7;
      y += dy * step * 0.7;
      pts.push({ x, y });

      for (let leg = 0; leg < 6; leg++) {
        x += dx * step * (1 + Math.floor(rand() * 3));
        y += dy * step * (1 + Math.floor(rand() * 3));
        pts.push({ x, y });

        const sign = rand() > 0.5 ? 1 : -1;
        const mitre = step * (0.4 + rand() * 0.7);
        const px = dx !== 0 ? dx : sign;
        const py = dy !== 0 ? dy : sign;
        x += px * mitre;
        y += py * mitre;
        pts.push({ x, y });
        if (dx !== 0) { dy = py; dx = 0; } else { dx = px; dy = 0; }

        if (x < -step || x > w + step || y < -step || y > h + step) break;
      }

      const cum = [0];
      let len = 0;
      for (let i = 1; i < pts.length; i++) {
        len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        cum.push(len);
      }
      if (len < step * 2) continue;
      out.push({ pts, cum, len, weight: rand() > 0.7 ? 2.4 : 1.2 });
    }
  }
  return out;
}

/** Two pad footprints with a body between them, scattered clear of the chip. */
function makeParts(w: number, h: number, chip: Chip, count: number): Part[] {
  const rand = rng(0x9a71);
  const parts: Part[] = [];
  const keepOut = chip.size * 0.8;
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    if (Math.abs(x - chip.cx) < keepOut && Math.abs(y - chip.cy) < keepOut) continue;
    const vertical = rand() > 0.5;
    const long = 12 + rand() * 16;
    const short = 5 + rand() * 3;
    parts.push({
      x,
      y,
      w: vertical ? short : long,
      h: vertical ? long : short,
      vertical,
    });
  }
  return parts;
}

function paintParts(b: CanvasRenderingContext2D, parts: Part[]) {
  for (const p of parts) {
    b.fillStyle = "rgba(30, 24, 48, 0.95)";
    b.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    b.strokeStyle = "rgba(124, 77, 219, 0.42)";
    b.lineWidth = 1;
    b.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);

    // The two pads it sits on.
    b.fillStyle = "rgba(167, 139, 250, 0.5)";
    if (p.vertical) {
      b.fillRect(p.x - p.w / 2, p.y - p.h / 2 - 3, p.w, 3);
      b.fillRect(p.x - p.w / 2, p.y + p.h / 2, p.w, 3);
    } else {
      b.fillRect(p.x - p.w / 2 - 3, p.y - p.h / 2, 3, p.h);
      b.fillRect(p.x + p.w / 2, p.y - p.h / 2, 3, p.h);
    }
  }
}

function paintChip(b: CanvasRenderingContext2D, chip: Chip) {
  const { cx, cy, size, pad } = chip;
  const half = size / 2;
  const inner = half - pad;
  const dieHalf = size * 0.225;

  // Pins first, so the package sits on top of where they enter it.
  const pins = 20;
  const lead = size * 0.075;
  for (let i = 0; i < pins; i++) {
    const along = ((i + 0.5) / pins - 0.5) * size * 0.92;
    // Bright at the tip, dark where it enters the moulding, which is what
    // makes a gull wing lead read as metal rather than as a painted tick.
    for (const [x, y, w, h] of [
      [cx - half - lead, cy + along - 1.5, lead, 3],
      [cx + half, cy + along - 1.5, lead, 3],
      [cx + along - 1.5, cy - half - lead, 3, lead],
      [cx + along - 1.5, cy + half, 3, lead],
    ] as const) {
      const horizontal = w > h;
      const g = b.createLinearGradient(x, y, horizontal ? x + w : x, horizontal ? y : y + h);
      const outward =
        (horizontal && x < cx) || (!horizontal && y < cy)
          ? ["rgba(233, 226, 255, 0.9)", "rgba(109, 77, 224, 0.4)"]
          : ["rgba(109, 77, 224, 0.4)", "rgba(233, 226, 255, 0.9)"];
      g.addColorStop(0, outward[0]);
      g.addColorStop(1, outward[1]);
      b.fillStyle = g;
      b.fillRect(x, y, w, h);
    }
  }

  // Package, lit from the top left so it reads as a moulded body rather than
  // a flat square. The rim is a second pass at a brighter stop.
  const body = b.createLinearGradient(cx - half, cy - half, cx + half, cy + half);
  body.addColorStop(0, "rgba(42, 35, 64, 0.98)");
  body.addColorStop(0.45, "rgba(24, 19, 38, 0.98)");
  body.addColorStop(1, "rgba(14, 11, 24, 0.98)");
  b.fillStyle = body;
  b.fillRect(cx - half, cy - half, size, size);

  // Specular sweep across the moulding, brightest near the top left where
  // the body gradient is already lightest.
  const sheen = b.createLinearGradient(cx - half, cy - half, cx + half * 0.4, cy + half);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.16)");
  sheen.addColorStop(0.28, "rgba(255, 255, 255, 0.05)");
  sheen.addColorStop(0.52, "rgba(255, 255, 255, 0)");
  b.fillStyle = sheen;
  b.fillRect(cx - half, cy - half, size, size);

  b.strokeStyle = "rgba(226, 216, 255, 0.72)";
  b.lineWidth = 1.6;
  b.strokeRect(cx - half + 0.8, cy - half + 0.8, size - 1.6, size - 1.6);
  b.strokeStyle = "rgba(255, 255, 255, 0.3)";
  b.lineWidth = 1;
  b.beginPath();
  b.moveTo(cx - half + 2, cy + half - 2);
  b.lineTo(cx - half + 2, cy - half + 2);
  b.lineTo(cx + half - 2, cy - half + 2);
  b.stroke();
  b.strokeStyle = "rgba(139, 92, 246, 0.28)";
  b.lineWidth = 1;
  b.strokeRect(cx - inner, cy - inner, inner * 2, inner * 2);

  // Ball grid, finer than the pins and skipped where the die sits.
  const gap = Math.max(6, size / 34);
  b.fillStyle = "rgba(167, 139, 250, 0.3)";
  for (let x = -inner + gap; x < inner; x += gap) {
    for (let y = -inner + gap; y < inner; y += gap) {
      if (Math.abs(x) < dieHalf + gap * 1.5 && Math.abs(y) < dieHalf + gap * 1.5) continue;
      b.beginPath();
      b.arc(cx + x, cy + y, 1.25, 0, Math.PI * 2);
      b.fill();
    }
  }

  // Bond wires, drawn before the die so they run under its edge.
  b.strokeStyle = "rgba(203, 184, 255, 0.3)";
  b.lineWidth = 0.8;
  for (let i = 0; i < 11; i++) {
    const t = (i + 0.5) / 11;
    const a = -dieHalf + t * dieHalf * 2;
    b.beginPath();
    b.moveTo(cx - dieHalf, cy + a);
    b.lineTo(cx - inner + 2, cy + a * 1.6);
    b.moveTo(cx + dieHalf, cy + a);
    b.lineTo(cx + inner - 2, cy + a * 1.6);
    b.moveTo(cx + a, cy - dieHalf);
    b.lineTo(cx + a * 1.6, cy - inner + 2);
    b.moveTo(cx + a, cy + dieHalf);
    b.lineTo(cx + a * 1.6, cy + inner - 2);
    b.stroke();
  }

  // The light off the die. Additive within this layer, so the beams add up
  // where they cross instead of flattening each other.
  b.save();
  b.globalCompositeOperation = "lighter";

  const bloom = b.createRadialGradient(cx, cy, 0, cx, cy, size * 0.78);
  bloom.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  bloom.addColorStop(0.1, "rgba(233, 226, 255, 0.6)");
  bloom.addColorStop(0.24, "rgba(167, 139, 250, 0.4)");
  bloom.addColorStop(0.5, "rgba(139, 92, 246, 0.14)");
  bloom.addColorStop(1, "rgba(139, 92, 246, 0)");
  b.fillStyle = bloom;
  b.fillRect(cx - size, cy - size, size * 2, size * 2);

  // Four long rays and four short ones, the flare a bright source throws.
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i;
    const reach = i % 2 === 0 ? size * 1.15 : size * 0.58;
    const ray = b.createLinearGradient(cx, cy, cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
    ray.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    ray.addColorStop(0.22, "rgba(203, 184, 255, 0.26)");
    ray.addColorStop(0.55, "rgba(167, 139, 250, 0.08)");
    ray.addColorStop(1, "rgba(139, 92, 246, 0)");
    b.strokeStyle = ray;
    b.lineWidth = i % 2 === 0 ? 4.2 : 2.4;
    b.beginPath();
    b.moveTo(cx, cy);
    b.lineTo(cx + Math.cos(angle) * reach, cy + Math.sin(angle) * reach);
    b.stroke();
  }
  b.restore();

  /*
   * The die. Not a lit block: silicon with a circuit etched into it, lit from
   * underneath, which is the thing that actually reads as a processor at this
   * size. The pattern is seeded so it is the same die on every load.
   */
  b.fillStyle = "rgba(11, 8, 20, 0.99)";
  b.fillRect(cx - dieHalf, cy - dieHalf, dieHalf * 2, dieHalf * 2);

  const etch = rng(0xd1e5);
  const cells = 8;
  const cw = (dieHalf * 2) / cells;

  b.save();
  b.beginPath();
  b.rect(cx - dieHalf, cy - dieHalf, dieHalf * 2, dieHalf * 2);
  b.clip();
  b.lineCap = "square";
  b.lineJoin = "miter";

  for (let gx = 0; gx < cells; gx++) {
    for (let gy = 0; gy < cells; gy++) {
      const x0 = cx - dieHalf + gx * cw;
      const y0 = cy - dieHalf + gy * cw;
      const r = etch();
      const hot = r > 0.7;
      b.strokeStyle = hot ? "rgba(255, 255, 255, 0.95)" : "rgba(203, 184, 255, 0.6)";
      b.lineWidth = hot ? Math.max(1.8, cw * 0.16) : Math.max(1, cw * 0.1);

      b.beginPath();
      if (r < 0.26) {
        b.moveTo(x0, y0 + cw / 2);
        b.lineTo(x0 + cw, y0 + cw / 2);
      } else if (r < 0.52) {
        b.moveTo(x0 + cw / 2, y0);
        b.lineTo(x0 + cw / 2, y0 + cw);
      } else if (r < 0.7) {
        b.moveTo(x0, y0 + cw / 2);
        b.lineTo(x0 + cw / 2, y0 + cw / 2);
        b.lineTo(x0 + cw / 2, y0 + cw);
      } else if (r < 0.88) {
        b.moveTo(x0 + cw / 2, y0);
        b.lineTo(x0 + cw / 2, y0 + cw / 2);
        b.lineTo(x0 + cw, y0 + cw / 2);
      } else {
        b.strokeRect(x0 + cw * 0.24, y0 + cw * 0.24, cw * 0.52, cw * 0.52);
      }
      b.stroke();

      if (r > 0.93) {
        b.fillStyle = "rgba(255, 255, 255, 0.95)";
        b.beginPath();
        b.arc(x0 + cw / 2, y0 + cw / 2, Math.max(1.3, cw * 0.11), 0, Math.PI * 2);
        b.fill();
      }
    }
  }
  b.restore();

  // Lit from under the etching, so the middle burns out and the corners keep
  // their detail.
  b.save();
  b.globalCompositeOperation = "lighter";
  const inside = b.createRadialGradient(cx, cy, 0, cx, cy, dieHalf * 1.45);
  inside.addColorStop(0, "rgba(255, 255, 255, 0.62)");
  inside.addColorStop(0.34, "rgba(203, 184, 255, 0.3)");
  inside.addColorStop(1, "rgba(139, 92, 246, 0)");
  b.fillStyle = inside;
  b.fillRect(cx - dieHalf * 1.6, cy - dieHalf * 1.6, dieHalf * 3.2, dieHalf * 3.2);
  b.restore();

  b.strokeStyle = "rgba(233, 226, 255, 0.9)";
  b.lineWidth = 1.4;
  b.strokeRect(cx - dieHalf, cy - dieHalf, dieHalf * 2, dieHalf * 2);

  // Pin one, bottom left, as it is on a real package.
  b.fillStyle = "rgba(203, 184, 255, 0.85)";
  b.beginPath();
  b.arc(cx - half + pad * 0.8, cy + half - pad * 0.8, 3.2, 0, Math.PI * 2);
  b.fill();
}

/** Walks the polyline and emits the span between two path lengths. */
function span(trace: Trace, from: number, to: number) {
  const out: { x: number; y: number }[] = [];
  const a = Math.max(0, from);
  const b = Math.min(trace.len, to);
  if (b <= a) return out;

  for (let i = 1; i < trace.pts.length; i++) {
    const s0 = trace.cum[i - 1];
    const s1 = trace.cum[i];
    if (s1 < a || s0 > b) continue;
    const p0 = trace.pts[i - 1];
    const p1 = trace.pts[i];
    const segLen = s1 - s0 || 1;
    const t0 = Math.max(0, (a - s0) / segLen);
    const t1 = Math.min(1, (b - s0) / segLen);
    if (out.length === 0) {
      out.push({ x: p0.x + (p1.x - p0.x) * t0, y: p0.y + (p1.y - p0.y) * t0 });
    }
    out.push({ x: p0.x + (p1.x - p0.x) * t1, y: p0.y + (p1.y - p0.y) * t1 });
  }
  return out;
}

export default function PcbField({ running = true }: { running?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 1, h: 1 });
  const live = useRef(running);
  const reduce = useReducedMotionSafe();

  useEffect(() => {
    live.current = running;
  }, [running]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const ctx = node.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stamp = 0;
    let dpr = 1;
    let traces: Trace[] = [];
    let signals: Signal[] = [];
    let parts: Part[] = [];
    let chip: Chip = makeChip(1, 1);
    let board: HTMLCanvasElement | null = null;
    let chipCanvas: HTMLCanvasElement | null = null;

    const paintBoard = (w: number, h: number) => {
      board = document.createElement("canvas");
      board.width = Math.floor(w * dpr);
      board.height = Math.floor(h * dpr);
      const b = board.getContext("2d");
      if (!b) return;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);

      b.fillStyle = GROUND;
      b.fillRect(0, 0, w, h);

      b.lineCap = "round";
      b.lineJoin = "round";

      for (const t of traces) {
        b.strokeStyle =
          t.weight > 3 ? TRACE_BUS : t.weight > 2 ? TRACE_DIM : TRACE_FAINT;
        b.lineWidth = t.weight;
        b.beginPath();
        b.moveTo(t.pts[0].x, t.pts[0].y);
        for (let i = 1; i < t.pts.length; i++) b.lineTo(t.pts[i].x, t.pts[i].y);
        b.stroke();

        // Vias at the corners, which is where a real board puts them.
        b.fillStyle = PAD;
        for (let i = 1; i < t.pts.length - 1; i += 2) {
          b.beginPath();
          b.arc(t.pts[i].x, t.pts[i].y, t.weight > 2 ? 3 : 1.9, 0, Math.PI * 2);
          b.fill();
        }
      }

      paintParts(b, parts);
    };

    // Its own layer, drawn after the signals, so a run passes beneath the
    // package the way it does on a real board instead of over the top of it.
    const paintChipLayer = (w: number, h: number) => {
      chipCanvas = document.createElement("canvas");
      chipCanvas.width = Math.floor(w * dpr);
      chipCanvas.height = Math.floor(h * dpr);
      const c = chipCanvas.getContext("2d");
      if (!c) return;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintChip(c, chip);
    };

    const resize = () => {
      const box = node.parentElement;
      const w = Math.max(1, box ? box.clientWidth : window.innerWidth);
      const h = Math.max(1, box ? box.clientHeight : window.innerHeight);
      size.current = { w, h };
      dpr = Math.min(2, window.devicePixelRatio || 1);
      node.width = Math.floor(w * dpr);
      node.height = Math.floor(h * dpr);
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      chip = makeChip(w, h);
      traces = buildTraces(w, h, Math.round((w * h) / 12500)).concat(
        fanout(chip, w, h),
      );
      parts = makeParts(w, h, chip, Math.round((w * h) / 42000));
      const rand = rng(0xb0a4d);
      // Not every trace carries one. A board where every run is live at once
      // is noise, and the eye stops following any single one of them.
      signals = [];
      traces.forEach((t, i) => {
        if (rand() > 0.42) return;
        signals.push({
          trace: i,
          phase: 0 as Phase,
          t: rand() * 4,
          head: 0,
          speed: 210 + rand() * 320,
          tail: 80 + rand() * 170,
        });
      });
      paintBoard(w, h);
      paintChipLayer(w, h);
    };

    const drawSignal = (s: Signal) => {
      const t = traces[s.trace];
      if (!t) return;
      const pts = span(t, s.head - s.tail, s.head);
      if (pts.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

      // Three passes instead of a shadow: wide and faint, then tighter, then
      // the core. Additive, so crossings brighten the way they should.
      ctx.strokeStyle = "rgba(139, 92, 246, 0.16)";
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(233, 226, 255, 0.9)";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      const head = pts[pts.length - 1];
      ctx.fillStyle = "rgba(244, 240, 255, 0.95)";
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
    };

    /**
     * k runs 0 to 1 across the flash; the shape is a rise and a fall.
     *
     * Nothing fires off the edge of the frame. A trace can begin or end well
     * outside it, and a pad lighting up out there put a dot on screen with no
     * run attached to it, which reads as the board twitching at random.
     */
    const fire = (x: number, y: number, k: number, ring: boolean) => {
      const { w, h } = size.current;
      if (x < 6 || x > w - 6 || y < 6 || y > h - 6) return;
      const a = Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);
      if (a <= 0.01) return;

      ctx.fillStyle = `rgba(139, 92, 246, ${0.3 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(167, 139, 250, ${0.55 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * a})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();

      if (ring) {
        ctx.strokeStyle = `rgba(203, 184, 255, ${0.5 * (1 - k)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x, y, 4 + k * 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const frame = (dt: number) => {
      const { w, h } = size.current;

      ctx.globalCompositeOperation = "source-over";
      if (board) ctx.drawImage(board, 0, 0, w, h);

      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const s of signals) {
        const t = traces[s.trace];
        if (!t) continue;
        const from = t.pts[0];
        const to = t.pts[t.pts.length - 1];
        s.t -= dt;

        if (s.phase === 0) {
          if (s.t <= 0) {
            s.phase = 1;
            s.t = FIRE_IN;
          }
        } else if (s.phase === 1) {
          fire(from.x, from.y, 1 - s.t / FIRE_IN, false);
          if (s.t <= 0) {
            s.phase = 2;
            s.head = 0;
          }
        } else if (s.phase === 2) {
          s.head += s.speed * dt;
          // The pad it left stays warm while the run is still on the board.
          fire(from.x, from.y, 0.5, false);
          drawSignal(s);
          if (s.head - s.tail > t.len) {
            s.phase = 3;
            s.t = FIRE_OUT;
          }
        } else {
          fire(to.x, to.y, 1 - s.t / FIRE_OUT, true);
          if (s.t <= 0) {
            s.phase = 0;
            s.t = 1.1 + Math.random() * 3.4;
          }
        }
      }

      ctx.globalCompositeOperation = "source-over";
      if (chipCanvas) ctx.drawImage(chipCanvas, 0, 0, w, h);
    };

    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      const dt = stamp ? Math.min(0.05, (time - stamp) / 1000) : 0.016;
      stamp = time;
      // Nothing is drawn while the layer is hidden. It is a full screen
      // canvas and there is no reason to pay for it before it is on.
      if (!live.current) return;
      frame(dt);
    };

    resize();
    frame(0);

    if (reduce) {
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
