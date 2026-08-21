/**
 * The prologue's timeline, written in viewport heights rather than in
 * fractions of the section.
 *
 * Fractions were fine while there was one scene. They stop being fine the
 * moment a scene is appended: every number in the list means something
 * different because the denominator moved, and re-deriving eleven of them by
 * hand is how a sequence that was tuned by eye quietly drifts. These are
 * absolute distances down the page, so adding a scene extends the section and
 * leaves every beat before it exactly where it was.
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
} as const;

/** In viewport heights. The section is this tall. */
export const STORY_HEIGHT = 600;

export type Beat = keyof typeof BEATS;

/** A beat as the pair of scroll fractions a useTransform wants. */
export const beat = (name: Beat): [number, number] => [
  BEATS[name][0] / STORY_HEIGHT,
  BEATS[name][1] / STORY_HEIGHT,
];

/**
 * What the rail names. Each one starts where the reader can first see the
 * thing it is named after, which is why they are not evenly spaced.
 */
export const CHAPTERS = [
  { at: 0, label: "Terrain" },
  { at: BEATS.reveal[0] / STORY_HEIGHT, label: "Editor" },
  { at: BEATS.type[0] / STORY_HEIGHT, label: "Code" },
  { at: BEATS.pull[0] / STORY_HEIGHT, label: "Laptop" },
  { at: BEATS.turn[0] / STORY_HEIGHT, label: "Desk" },
] as const;
