import { cssFont } from "./editor-surface";

/**
 * The monitor's screen, drawn the way the editor's was: a 2D canvas that
 * becomes a texture.
 *
 * Deliberately unreadable. Every figure on this page is meant to be checkable,
 * and there are no performance numbers in the content to check against, so the
 * dashboard shows the shape of a dashboard and claims nothing. Its chart fills
 * in step with the columns standing in front of it, which is the only thing it
 * actually needs to say.
 */

const W = 900;
const H = 560;

const C = {
  bg: "#141021",
  panel: "#1b1630",
  line: "#2c2444",
  dim: "#4b4270",
  text: "#b9a8e8",
  bar: "#8b5cf6",
  hot: "#c4a2ff",
};

export type Dashboard = ReturnType<typeof createDashboard>;

export function createDashboard() {
  const sans = cssFont("--font-geist", "ui-sans-serif, system-ui, sans-serif");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  /** Blocks standing in for text, at the size text would be. */
  const stub = (x: number, y: number, w: number, h: number, colour: string) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  };

  const draw = (grown: number) => {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Chrome: a title strip and a rail down the left.
    ctx.fillStyle = C.panel;
    ctx.fillRect(0, 0, W, 54);
    ctx.fillRect(0, 54, 176, H - 54);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(176, 54);
    ctx.lineTo(176, H);
    ctx.moveTo(0, 55);
    ctx.lineTo(W, 55);
    ctx.stroke();

    stub(28, 22, 108, 11, C.text);
    [0, 1, 2, 3, 4].forEach((i) => stub(28, 96 + i * 44, i === 1 ? 96 : 74, 9, i === 1 ? C.hot : C.dim));

    ctx.fillStyle = C.hot;
    ctx.fillRect(0, 96 + 44, 3, 20);

    // The four columns, filling with the ones on the desk in front.
    const base = H - 74;
    const heights = [0.34, 0.52, 0.72, 1];
    const barW = 62;
    const gap = 46;
    const left = 250;

    heights.forEach((tall, i) => {
      const share = Math.min(1, Math.max(0, grown * 4 - i));
      const full = (H - 200) * tall;
      const h = full * share;
      ctx.fillStyle = C.line;
      ctx.fillRect(left + i * (barW + gap), base - full, barW, full);
      const g = ctx.createLinearGradient(0, base - h, 0, base);
      g.addColorStop(0, C.hot);
      g.addColorStop(1, C.bar);
      ctx.fillStyle = g;
      ctx.fillRect(left + i * (barW + gap), base - h, barW, h);
    });

    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.moveTo(216, base + 1);
    ctx.lineTo(W - 40, base + 1);
    ctx.stroke();

    // A trace across the top of them, drawn as far as the columns have got.
    ctx.strokeStyle = C.hot;
    ctx.lineWidth = 3;
    ctx.beginPath();
    heights.forEach((tall, i) => {
      const share = Math.min(1, Math.max(0, grown * 4 - i));
      const x = left + i * (barW + gap) + barW / 2;
      const y = base - (H - 200) * tall * share;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    stub(216, 86, 132, 10, C.text);
    stub(216, 108, 210, 8, C.dim);

    ctx.font = `12px ${sans}`;
  };

  draw(0);

  return { canvas, width: W, height: H, aspect: W / H, draw };
}
