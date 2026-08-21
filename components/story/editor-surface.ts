import { STORY } from "@/lib/content";
import { SYNTAX, tokenize, type Token } from "./highlight";

/**
 * Draws a VS Code window into a 2D canvas, which the scene uses as a texture.
 *
 * Canvas rather than DOM for two reasons. The screen has to survive being
 * zoomed out onto a laptop and then turned away from the reader in the scenes
 * that follow, and a texture does that for free where a CSS-transformed panel
 * does not. And the assembly needs to know what the screen looks like before
 * it exists: the dots read their target colour out of these pixels.
 *
 * Two canvases, not one. The chrome never changes, so it is drawn once into
 * `shell` and blitted in; only the code, the line numbers, the caret, the
 * minimap and the cursor position in the status bar are redrawn as the file is
 * typed. That keeps an update to one drawImage plus about thirty short text
 * runs, which is cheap enough to do inside a scroll frame.
 *
 * Everything is laid out in texture pixels against a fixed 1600x1000 board,
 * which is 16:10, the aspect of the laptop screen it ends up on.
 */

const W = 1600;
const H = 1000;

const TITLE_H = 44;
const ACTIVITY_W = 68;
const SIDEBAR_W = 300;
const TAB_H = 46;
const CRUMB_H = 30;
const STATUS_H = 32;
const GUTTER_W = 66;
const MINIMAP_W = 88;

const CODE_X = ACTIVITY_W + SIDEBAR_W + GUTTER_W;
const CODE_TOP = TITLE_H + TAB_H + CRUMB_H;
const CODE_BOTTOM = H - STATUS_H;
const CODE_RIGHT = W - MINIMAP_W;
const LINE_H = 27;
const FONT_SIZE = 18;
const VISIBLE_LINES = Math.floor((CODE_BOTTOM - CODE_TOP) / LINE_H);

/**
 * Dark+ tinted a few degrees toward this page's violet. Straight #1e1e1e sat
 * on the page like a screenshot someone had pasted in; carrying the page's hue
 * through the chrome makes the screen part of the same world. The syntax
 * colours underneath are left alone, because those are what say VS Code.
 */
const C = {
  chrome: "#120f1c",
  sidebar: "#171327",
  editor: "#1c1729",
  line: "#2a2340",
  text: "#cfc9e0",
  dim: "#7d7794",
  faint: "#5a5474",
  gutterOn: "#c9c3dd",
  accent: "#8b5cf6",
  status: "#6d28d9",
  statusText: "#f5f2ff",
  react: "#519aba",
  lineHi: "rgba(255,255,255,0.035)",
  indent: "rgba(237,234,245,0.07)",
  hover: "rgba(255,255,255,0.05)",
};

export const cssFont = (variable: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return value ? `${value}, ${fallback}` : fallback;
};

const round = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export type EditorSurface = ReturnType<typeof createEditorSurface>;

export function createEditorSurface() {
  const mono = cssFont("--font-geist-mono", "ui-monospace, SFMono-Regular, Menlo, monospace");
  const sans = cssFont("--font-geist", "ui-sans-serif, system-ui, sans-serif");

  const shell = document.createElement("canvas");
  shell.width = W;
  shell.height = H;
  const sctx = shell.getContext("2d", { alpha: true })!;

  const frame = document.createElement("canvas");
  frame.width = W;
  frame.height = H;
  const ctx = frame.getContext("2d", { alpha: true })!;

  const lines = STORY.code.split("\n");
  /** Newline counts as a character, so the caret pauses at the end of a line. */
  const total = lines.reduce((sum, line) => sum + line.length + 1, 0);

  // Every line is tokenized once. Typing only changes how much of each line is
  // painted, never how it is coloured, so there is no reason to re-scan.
  const coloured: Token[][] = [];
  let depth = 0;
  for (const line of lines) {
    const scan = tokenize(line, depth);
    coloured.push(scan.tokens);
    depth = scan.depth;
  }

  ctx.font = `${FONT_SIZE}px ${mono}`;
  const charW = ctx.measureText("M").width;

  /* ---------------------------------------------------------------- shell */

  const icon = (x: number, y: number, draw: () => void, on: boolean) => {
    sctx.save();
    sctx.strokeStyle = on ? "#e6e2f2" : "#6f6a86";
    sctx.fillStyle = on ? "#e6e2f2" : "#6f6a86";
    sctx.lineWidth = 1.6;
    sctx.translate(x, y);
    draw();
    sctx.restore();
  };

  const drawShell = () => {
    sctx.save();
    sctx.clearRect(0, 0, W, H);

    // Soft corners, because the thing is a window and later a screen. Clipped
    // rather than drawn, so nothing has to know where the corners are.
    round(sctx, 0, 0, W, H, 18);
    sctx.clip();

    sctx.fillStyle = C.editor;
    sctx.fillRect(0, 0, W, H);

    // Title bar.
    sctx.fillStyle = C.chrome;
    sctx.fillRect(0, 0, W, TITLE_H);
    const lights = ["#ff5f57", "#febc2e", "#28c840"];
    lights.forEach((colour, i) => {
      sctx.fillStyle = colour;
      sctx.beginPath();
      sctx.arc(28 + i * 24, TITLE_H / 2, 6.5, 0, Math.PI * 2);
      sctx.fill();
    });
    sctx.fillStyle = C.dim;
    sctx.font = `500 15px ${sans}`;
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillText(`${STORY.file} - ${STORY.project}`, W / 2, TITLE_H / 2 + 1);
    sctx.textAlign = "left";

    // Activity bar.
    sctx.fillStyle = C.chrome;
    sctx.fillRect(0, TITLE_H, ACTIVITY_W, H - TITLE_H - STATUS_H);

    const cx = ACTIVITY_W / 2;
    let iy = TITLE_H + 42;

    // Explorer, and the only one lit, since the explorer is what is open.
    icon(cx, iy, () => {
      sctx.strokeRect(-9, -11, 13, 22);
      sctx.beginPath();
      sctx.moveTo(-4, -11);
      sctx.lineTo(9, -11);
      sctx.lineTo(9, 11);
      sctx.lineTo(-4, 11);
      sctx.stroke();
    }, true);
    sctx.fillStyle = C.text;
    sctx.fillRect(0, iy - 22, 2, 44);

    iy += 62;
    icon(cx, iy, () => {
      sctx.beginPath();
      sctx.arc(-2, -2, 8, 0, Math.PI * 2);
      sctx.stroke();
      sctx.beginPath();
      sctx.moveTo(4, 4);
      sctx.lineTo(10, 10);
      sctx.stroke();
    }, false);

    iy += 62;
    icon(cx, iy, () => {
      sctx.beginPath();
      sctx.arc(-7, -7, 4, 0, Math.PI * 2);
      sctx.arc(-7, 8, 4, 0, Math.PI * 2);
      sctx.arc(8, 0, 4, 0, Math.PI * 2);
      sctx.stroke();
      sctx.beginPath();
      sctx.moveTo(-7, -3);
      sctx.lineTo(-7, 4);
      sctx.moveTo(-3, -6);
      sctx.lineTo(4, -2);
      sctx.stroke();
    }, false);

    iy += 62;
    icon(cx, iy, () => {
      sctx.beginPath();
      sctx.arc(0, 0, 7, 0, Math.PI * 2);
      sctx.stroke();
      sctx.beginPath();
      sctx.moveTo(-2, -4);
      sctx.lineTo(4, 0);
      sctx.lineTo(-2, 4);
      sctx.closePath();
      sctx.fill();
    }, false);

    iy += 62;
    icon(cx, iy, () => {
      sctx.strokeRect(-10, -10, 8, 8);
      sctx.strokeRect(2, -10, 8, 8);
      sctx.strokeRect(-10, 2, 8, 8);
      sctx.beginPath();
      sctx.moveTo(6, 1);
      sctx.lineTo(6, 11);
      sctx.moveTo(1, 6);
      sctx.lineTo(11, 6);
      sctx.stroke();
    }, false);

    // Sidebar.
    sctx.fillStyle = C.sidebar;
    sctx.fillRect(ACTIVITY_W, TITLE_H, SIDEBAR_W, H - TITLE_H - STATUS_H);

    sctx.fillStyle = C.dim;
    sctx.font = `600 11px ${sans}`;
    sctx.fillText("EXPLORER", ACTIVITY_W + 20, TITLE_H + 24);

    let ty = TITLE_H + 56;
    sctx.font = `600 12.5px ${sans}`;
    sctx.fillStyle = C.text;
    sctx.fillText(STORY.project.toUpperCase(), ACTIVITY_W + 30, ty);
    // Folder chevron, open.
    sctx.strokeStyle = C.dim;
    sctx.lineWidth = 1.4;
    sctx.beginPath();
    sctx.moveTo(ACTIVITY_W + 14, ty - 3);
    sctx.lineTo(ACTIVITY_W + 19, ty + 2);
    sctx.lineTo(ACTIVITY_W + 24, ty - 3);
    sctx.stroke();

    ty += 12;
    sctx.font = `13px ${sans}`;
    for (const row of STORY.tree) {
      ty += 26;
      const x = ACTIVITY_W + 24 + row.depth * 18;

      if (row.active) {
        sctx.fillStyle = C.hover;
        sctx.fillRect(ACTIVITY_W, ty - 18, SIDEBAR_W, 26);
        sctx.fillStyle = C.accent;
        sctx.fillRect(ACTIVITY_W, ty - 18, 2, 26);
      }

      if (row.folder) {
        sctx.strokeStyle = C.dim;
        sctx.beginPath();
        sctx.moveTo(x, ty - 8);
        sctx.lineTo(x + 5, ty - 3);
        sctx.lineTo(x, ty + 2);
        sctx.stroke();
      } else {
        // File-type dot, the same colour VS Code's icon theme gives the
        // extension. Reads at a glance as a mixed tree of real files.
        sctx.fillStyle = row.name.endsWith(".tsx")
          ? C.react
          : row.name.endsWith(".css")
            ? "#c586c0"
            : "#cbcb41";
        sctx.beginPath();
        sctx.arc(x + 3, ty - 3, 3.5, 0, Math.PI * 2);
        sctx.fill();
      }

      sctx.fillStyle = row.active ? C.text : C.dim;
      sctx.fillText(row.name, x + (row.folder ? 14 : 16), ty);
    }

    sctx.strokeStyle = C.line;
    sctx.lineWidth = 1;
    sctx.beginPath();
    sctx.moveTo(ACTIVITY_W + SIDEBAR_W + 0.5, TITLE_H);
    sctx.lineTo(ACTIVITY_W + SIDEBAR_W + 0.5, H - STATUS_H);
    sctx.stroke();

    // Tab strip.
    const stripX = ACTIVITY_W + SIDEBAR_W;
    sctx.fillStyle = C.sidebar;
    sctx.fillRect(stripX, TITLE_H, W - stripX, TAB_H);

    let tx = stripX;
    sctx.font = `13.5px ${sans}`;
    for (const tab of STORY.tabs) {
      const width = sctx.measureText(tab.name).width + 74;
      if (tab.active) {
        sctx.fillStyle = C.editor;
        sctx.fillRect(tx, TITLE_H, width, TAB_H);
        sctx.fillStyle = C.accent;
        sctx.fillRect(tx, TITLE_H, width, 2);
      }
      sctx.fillStyle = tab.name.endsWith(".tsx") ? C.react : "#cbcb41";
      sctx.beginPath();
      sctx.arc(tx + 20, TITLE_H + TAB_H / 2, 4, 0, Math.PI * 2);
      sctx.fill();

      sctx.fillStyle = tab.active ? C.text : C.dim;
      sctx.fillText(tab.name, tx + 34, TITLE_H + TAB_H / 2 + 1);

      // Unsaved dot on the active tab, close cross on the rest.
      const ex = tx + width - 22;
      if (tab.active) {
        sctx.fillStyle = C.text;
        sctx.beginPath();
        sctx.arc(ex, TITLE_H + TAB_H / 2, 4.5, 0, Math.PI * 2);
        sctx.fill();
      } else {
        sctx.strokeStyle = C.faint;
        sctx.lineWidth = 1.3;
        sctx.beginPath();
        sctx.moveTo(ex - 4, TITLE_H + TAB_H / 2 - 4);
        sctx.lineTo(ex + 4, TITLE_H + TAB_H / 2 + 4);
        sctx.moveTo(ex + 4, TITLE_H + TAB_H / 2 - 4);
        sctx.lineTo(ex - 4, TITLE_H + TAB_H / 2 + 4);
        sctx.stroke();
      }
      tx += width;
    }

    // Breadcrumbs.
    sctx.fillStyle = C.editor;
    sctx.fillRect(stripX, TITLE_H + TAB_H, W - stripX, CRUMB_H);
    sctx.font = `12.5px ${sans}`;
    sctx.fillStyle = C.faint;
    let bx = CODE_X - GUTTER_W + 12;
    STORY.crumbs.forEach((crumb, i) => {
      if (i) {
        sctx.fillText("›", bx, TITLE_H + TAB_H + CRUMB_H / 2 + 1);
        bx += 14;
      }
      sctx.fillText(crumb, bx, TITLE_H + TAB_H + CRUMB_H / 2 + 1);
      bx += sctx.measureText(crumb).width + 8;
    });

    // Minimap ground and its viewport slider.
    sctx.fillStyle = "rgba(255,255,255,0.02)";
    sctx.fillRect(CODE_RIGHT, CODE_TOP, MINIMAP_W, CODE_BOTTOM - CODE_TOP);

    // Status bar.
    sctx.fillStyle = C.status;
    sctx.fillRect(0, H - STATUS_H, W, STATUS_H);
    sctx.font = `12.5px ${sans}`;
    sctx.fillStyle = C.statusText;
    sctx.textBaseline = "middle";
    const sy = H - STATUS_H / 2;

    // Remote indicator, the darker block at the far left.
    sctx.fillStyle = "rgba(0,0,0,0.22)";
    sctx.fillRect(0, H - STATUS_H, 34, STATUS_H);
    sctx.fillStyle = C.statusText;
    sctx.beginPath();
    sctx.moveTo(11, sy - 5);
    sctx.lineTo(21, sy);
    sctx.lineTo(11, sy + 5);
    sctx.closePath();
    sctx.fill();

    // Branch glyph plus name, then the problem counts.
    sctx.beginPath();
    sctx.arc(50, sy - 4, 3, 0, Math.PI * 2);
    sctx.arc(50, sy + 5, 3, 0, Math.PI * 2);
    sctx.arc(62, sy - 4, 3, 0, Math.PI * 2);
    sctx.fill();
    sctx.lineWidth = 1.4;
    sctx.strokeStyle = C.statusText;
    sctx.beginPath();
    sctx.moveTo(50, sy - 1);
    sctx.lineTo(50, sy + 2);
    sctx.stroke();
    sctx.fillText(STORY.branch, 74, sy + 1);
    sctx.fillText("0", 168, sy + 1);
    sctx.fillText("0", 208, sy + 1);
    // Error and warning marks, so the two zeros are legible as counts.
    sctx.strokeStyle = C.statusText;
    sctx.beginPath();
    sctx.arc(154, sy, 5.5, 0, Math.PI * 2);
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(194, sy + 5);
    sctx.lineTo(200, sy - 5);
    sctx.lineTo(206, sy + 5);
    sctx.closePath();
    sctx.stroke();

    // Right to left from the far edge, so the list reads in page order.
    sctx.textAlign = "right";
    let rx = W - 22;
    for (let i = STORY.statusRight.length - 1; i >= 0; i--) {
      const item = STORY.statusRight[i];
      sctx.fillText(item, rx, sy + 1);
      rx -= sctx.measureText(item).width + 26;
    }
    sctx.textAlign = "left";

    // An edge. Without it the dark body of the window dissolved into the dark
    // page and the screen had no shape of its own between the title bar and
    // the status bar.
    sctx.strokeStyle = "rgba(237,234,245,0.14)";
    sctx.lineWidth = 2;
    round(sctx, 1, 1, W - 2, H - 2, 18);
    sctx.stroke();

    sctx.restore();
  };

  /* ---------------------------------------------------------------- frame */

  /**
   * Paints the file as far as `chars`. Lines that have not been reached yet do
   * not get a line number either, because the file does not have those lines
   * yet; that is what makes it read as typing rather than as a reveal mask
   * sliding down finished text.
   */
  const draw = (chars: number, caretOn: boolean) => {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(shell, 0, 0);

    let budget = Math.max(0, Math.min(chars, total));
    let caretLine = 0;
    let caretCol = 0;

    // How much of each line is visible, and where that leaves the caret.
    const cut: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const len = lines[i].length;
      if (budget <= 0) {
        cut.push(-1);
        continue;
      }
      const shown = Math.min(len, budget);
      cut.push(shown);
      caretLine = i;
      caretCol = shown;
      budget -= shown + 1;
    }

    // Follows the caret once the file grows past the window, which it only
    // does on a short viewport, but the seam would be obvious if it did not.
    const first = Math.max(0, caretLine - VISIBLE_LINES + 3);

    ctx.save();
    ctx.beginPath();
    ctx.rect(ACTIVITY_W + SIDEBAR_W, CODE_TOP, W - ACTIVITY_W - SIDEBAR_W, CODE_BOTTOM - CODE_TOP);
    ctx.clip();

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    for (let i = first; i < lines.length; i++) {
      const shown = cut[i];
      if (shown < 0) break;
      const row = i - first;
      const y = CODE_TOP + row * LINE_H + LINE_H / 2;
      if (y > CODE_BOTTOM) break;

      if (i === caretLine) {
        ctx.fillStyle = C.lineHi;
        ctx.fillRect(ACTIVITY_W + SIDEBAR_W, y - LINE_H / 2, CODE_RIGHT - ACTIVITY_W - SIDEBAR_W, LINE_H);
      }

      ctx.font = `${FONT_SIZE - 2}px ${mono}`;
      ctx.fillStyle = i === caretLine ? C.gutterOn : C.faint;
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), CODE_X - 20, y);
      ctx.textAlign = "left";

      // Indent guides, one per two spaces of leading whitespace.
      const indent = lines[i].length - lines[i].trimStart().length;
      ctx.fillStyle = C.indent;
      for (let g = 2; g < indent; g += 2) {
        ctx.fillRect(CODE_X + g * charW, y - LINE_H / 2, 1, LINE_H);
      }

      ctx.font = `${FONT_SIZE}px ${mono}`;
      let x = CODE_X;
      let left = shown;
      for (const token of coloured[i]) {
        if (left <= 0) break;
        const text = token.text.length > left ? token.text.slice(0, left) : token.text;
        if (text.trim()) {
          ctx.fillStyle = token.color;
          ctx.fillText(text, x, y);
        }
        x += token.text.length * charW;
        left -= text.length;
      }

      // Minimap: the same runs again, two pixels tall, which is exactly what
      // VS Code's is.
      let mx = CODE_RIGHT + 6;
      let mleft = shown;
      ctx.globalAlpha = 0.55;
      for (const token of coloured[i]) {
        if (mleft <= 0) break;
        const take = Math.min(token.text.length, mleft);
        const wide = take * 0.9;
        if (token.text.trim()) {
          ctx.fillStyle = token.color;
          ctx.fillRect(mx, CODE_TOP + row * 6 + 2, wide, 2);
        }
        mx += token.text.length * 0.9;
        mleft -= take;
      }
      ctx.globalAlpha = 1;
    }

    if (caretOn) {
      const cx = CODE_X + caretCol * charW;
      const cy = CODE_TOP + (caretLine - first) * LINE_H;
      ctx.fillStyle = C.text;
      ctx.fillRect(cx, cy + 3, 2, LINE_H - 6);
    }

    ctx.restore();

    // Cursor position, repainted over its own patch of the status bar. It sits
    // left of the fixed items, which is where VS Code puts it, and the patch
    // is sized to clear the longest reading it can take.
    //
    // Clipped to the same rounded rect the shell was drawn through. Painted
    // straight onto the board the patch covered the antialiased bottom row of
    // the window with a fully opaque one, and that showed up as a bright step
    // running along the base of the status bar wherever the patch reached.
    ctx.save();
    round(ctx, 0, 0, W, H, 18);
    ctx.clip();
    ctx.fillStyle = C.status;
    ctx.fillRect(W - 540, H - STATUS_H, 220, STATUS_H);
    ctx.fillStyle = C.statusText;
    ctx.font = `12.5px ${sans}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`Ln ${caretLine + 1}, Col ${caretCol + 1}`, W - 330, H - STATUS_H / 2 + 1);
    ctx.textAlign = "left";
    ctx.restore();
  };

  /**
   * Reads the empty window back as points for the assembly.
   *
   * Every cell of the grid is kept, including the ones over the dark body of
   * the editor and the ones outside its rounded corners, because these points
   * spend the first part of the prologue as a landscape and a landscape with
   * holes in it is not a landscape. What varies is where each one ends up:
   * corners land at zero alpha and disappear into the page, the body lands
   * dim, and the lit pixels land at the colour they carry here.
   *
   * Sampling well below the texture's own resolution is deliberate. At this
   * density the text blurs into the rows and edges that give a screen its
   * shape, which is what should arrive as dots. The words arrive later, typed.
   */
  const sample = (cols: number, rows: number) => {
    const small = document.createElement("canvas");
    small.width = cols;
    small.height = rows;
    const sc = small.getContext("2d", { willReadFrequently: true })!;
    sc.drawImage(shell, 0, 0, cols, rows);
    const { data } = sc.getImageData(0, 0, cols, rows);

    const count = cols * rows;
    const tint = new Float32Array(count * 3);
    const alpha = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const px = i * 4;
      const a = data[px + 3] / 255;
      const r = data[px] / 255;
      const g = data[px + 1] / 255;
      const b = data[px + 2] / 255;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (a < 0.35) {
        // Outside the window. Violet on the ground, gone by the time the
        // screen has formed.
        tint[i * 3] = 0.46;
        tint[i * 3 + 1] = 0.33;
        tint[i * 3 + 2] = 0.84;
        alpha[i] = 0;
      } else if (luma > 0.12) {
        const boost = 1 / Math.max(0.35, luma + 0.45);
        tint[i * 3] = Math.min(1, r * boost);
        tint[i * 3 + 1] = Math.min(1, g * boost);
        tint[i * 3 + 2] = Math.min(1, b * boost);
        alpha[i] = Math.min(1, 0.35 + luma * 1.35);
      } else {
        tint[i * 3] = 0.46;
        tint[i * 3 + 1] = 0.33;
        tint[i * 3 + 2] = 0.84;
        alpha[i] = 0.22;
      }
    }

    return { cols, rows, count, tint, alpha };
  };

  drawShell();
  draw(0, false);

  return {
    canvas: frame,
    width: W,
    height: H,
    /** 16:10, so the plane and the laptop lid can be sized off one number. */
    aspect: W / H,
    total,
    draw,
    sample,
  };
}

export { SYNTAX };
