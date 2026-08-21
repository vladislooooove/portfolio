import { motionValue } from "motion/react";

/**
 * How far through its exit the hero is, 0 to 1, published so the section
 * underneath can start arriving before the hero has finished leaving.
 *
 * Module level for the same reason as the boot signals: the two are nowhere
 * near each other in the tree, and threading a value through the page would
 * mean making the page a client component to hold it.
 */
export const heroExit = motionValue(0);
