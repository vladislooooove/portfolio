/**
 * The prologue's timeline, written in viewport heights rather than in
 * fractions of the section.
 *
 * Fractions were fine while there was one scene. They stop being fine the
 * moment a scene is appended: every number in the list means something
 * different because the denominator moved, and re-deriving them by hand is how
 * a sequence that was tuned by eye quietly drifts. These are absolute
 * distances down the page, so adding a scene extends the section and leaves
 * every beat before it exactly where it was.
 */
const BEATS = {
  /** The scroll cue drops out of the air onto the ground. */
  fall: [0, 27],
  /** The landscape flattens and swings up into the shape of the window. */
  gather: [0, 150],
  /** The window resolves into a screen and the dots hand over. */
  reveal: [136, 177],
  /** The file is typed. */
  type: [170, 320],
  /** The camera pulls back off the screen onto the laptop it is part of. */
  pull: [340, 480],
  /** It orbits around the laptop and rises, onto the three quarter view. */
  turn: [480, 600],
  /** The laptop comes apart into cubes and rebuilds as the system diagram. */
  architecture: [600, 840],
} as const;

/** In viewport heights. The section is this tall. */
export const STORY_HEIGHT = 840;

export type Beat = keyof typeof BEATS;

/** A beat as the pair of scroll fractions a useTransform wants. */
export const beat = (name: Beat): [number, number] => [
  BEATS[name][0] / STORY_HEIGHT,
  BEATS[name][1] / STORY_HEIGHT,
];

/**
 * The four things the sequence is about, which is what the rail shows.
 *
 * The rail draws them as four equal steps rather than at their true distances
 * down the page. They are nowhere near equal in length, and a rail drawn to
 * scale would crowd three ticks into its last quarter and leave two of them
 * marking nothing at all. What the reader wants off it is which chapter they
 * are in and how far through, not how many pixels each one costs.
 *
 * A chapter with no range has not been built yet. It still gets a tick and a
 * label, dimmed, because the shape of the whole is worth showing.
 */
export const CHAPTERS: { label: string; from?: number; to?: number }[] = [
  { label: "Code", from: 0, to: 600 },
  { label: "Architecture", from: 600, to: 840 },
  { label: "Performance" },
  { label: "Build" },
];

/** Which chapter a scroll fraction is in, and how far through it. */
export const chapterAt = (progress: number) => {
  const at = progress * STORY_HEIGHT;
  for (let i = CHAPTERS.length - 1; i >= 0; i--) {
    const { from, to } = CHAPTERS[i];
    if (from === undefined || to === undefined) continue;
    if (at >= from || i === 0) {
      return { index: i, local: Math.min(1, Math.max(0, (at - from) / (to - from))) };
    }
  }
  return { index: 0, local: 0 };
};
