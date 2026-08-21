"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { heroExit } from "@/lib/stage";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

const PcbField = dynamic(() => import("./PcbField"), { ssr: false });

/**
 * The board arriving underneath the hero.
 *
 * Fixed rather than absolute on purpose: it has to be on screen while the
 * hero is still pinned above it, which an element inside this section's own
 * box cannot be. It reads `heroExit` for that, published by the hero, and its
 * own section's progress for leaving again.
 *
 * It comes in out of focus and sharpens. The canvas is held still until it is
 * mostly resolved, because a full screen blur that re-rasterises an animating
 * canvas on every frame is the most expensive thing that could happen here,
 * and nothing of the motion is legible through 24px of blur anyway.
 */
export default function PcbBackdrop({
  leave,
  drift,
}: {
  leave: MotionValue<number>;
  drift: MotionValue<number>;
}) {
  const reduce = useReducedMotionSafe();
  const [running, setRunning] = useState(false);

  // Starts while the points are still in the air, lands before the pin ends.
  const arrive = useTransform(heroExit, [0, 0.64, 0.93, 1], [0, 0, 1, 1]);
  const blur = useTransform(arrive, (v) => `blur(${(1 - v) * 20}px)`);
  const opacity = useTransform([arrive, leave], ([a, l]: number[]) => a * (1 - l));
  /*
   * Travels a fraction of the distance the page does, which is the parallax.
   * The layer is taller than the frame so the ends never come into view.
   *
   * Composed from both scroll sources because neither covers the whole time
   * the board is on screen: it appears while the hero is still pinned, and
   * the section it belongs to has not started measuring yet. The hero's share
   * ends exactly where the section's begins, so the two meet without a step.
   */
  const travel = useTransform(
    [heroExit, drift],
    ([h, d]: number[]) => h * 0.3 + d * 0.7,
  );
  const y = useTransform(travel, [0, 1], ["7%", "-7%"]);

  /*
   * Turning the whole time, not just on the way in: roughly +19 degrees as it
   * lands through to -30 by the time the section is done. Two earlier versions
   * put most of the angle into the arrival, which happens behind 20px of blur,
   * so the board looked flat every moment it was actually legible and settled
   * into a fixed angle the moment it sharpened.
   *
   * The plane is oversized in layout rather than scaled by transform. Under
   * perspective the far edge shrinks and needs covering either way, but a
   * bigger box gives the canvas more pixels to draw into, where a scale just
   * magnifies the ones it already has and softens every trace.
   */
  const rotateX = useTransform(
    [arrive, travel],
    ([a, t]: number[]) => `${(1 - a) * 12 + (0.42 - t) * 52}deg`,
  );

  useMotionValueEvent(arrive, "change", (v) => {
    const should = v > 0.55;
    setRunning((current) => (current === should ? current : should));
  });

  if (reduce) {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-[20%] -right-[18%] -left-[18%] h-[140%]">
          <PcbField running={false} />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity, filter: blur }}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <motion.div
        style={{ y, rotateX, scale: 1.06, transformPerspective: 1250 }}
        className="absolute -top-[20%] -right-[18%] -left-[18%] h-[140%]"
      >
        <PcbField running={running} />
      </motion.div>
    </motion.div>
  );
}
