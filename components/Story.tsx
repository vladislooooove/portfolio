"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMotionValue, useScroll, useTransform } from "motion/react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";
import SceneRail from "./story/SceneRail";

// three.js stays out of the first-load bundle, same as the hero's field.
const StoryStage = dynamic(() => import("./story/rig/StoryStage"), { ssr: false });

/**
 * The prologue. Before the hero says anything, a landscape of violet dots
 * stands up into an editor, which then writes the component the hero is made
 * of.
 *
 * Scene 1, which is what this range currently covers:
 *   0.00 - 0.08   the scroll cue drops out of the air onto the ground
 *   0.00 - 0.44   the landscape flattens and swings up into the shape of the
 *                 window. It starts on the same scroll that takes the cue
 *                 away, so obeying the cue is what moves the landscape
 *   0.40 - 0.52   the window resolves into a screen and the dots hand over
 *   0.50 - 0.94   the file is typed
 *   0.94 - 1.00   held, then faded out
 *
 * The fade at the end is temporary. Scene 2 pulls the camera back off this
 * screen to the laptop it is standing on and takes that range for itself.
 *
 * Everything is a motion value read inside the render loop. Nothing here holds
 * scroll position in React state, so scrolling the prologue costs no renders.
 */
function Prologue() {
  const host = useRef<HTMLElement>(null);

  const mx = useMotionValue(2.4);
  const my = useMotionValue(2.4);

  const { scrollYProgress } = useScroll({
    target: host,
    offset: ["start start", "end end"],
  });

  const fall = useTransform(scrollYProgress, [0, 0.08], [0, 1]);
  const assemble = useTransform(scrollYProgress, [0, 0.44], [0, 1]);
  const reveal = useTransform(scrollYProgress, [0.4, 0.52], [0, 1]);
  const type = useTransform(scrollYProgress, [0.5, 0.94], [0, 1]);
  const exit = useTransform(scrollYProgress, [0.96, 1], [0, 1]);

  return (
    <section ref={host} className="relative h-[340dvh] w-full">
      <div
        className="sticky top-0 h-[100dvh] w-full overflow-hidden"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          mx.set(((event.clientX - box.left) / box.width) * 2 - 1);
          my.set(-(((event.clientY - box.top) / box.height) * 2 - 1));
        }}
      >
        <StoryStage
          assemble={assemble}
          fall={fall}
          reveal={reveal}
          type={type}
          exit={exit}
          mx={mx}
          my={my}
        />

        <SceneRail progress={scrollYProgress} />
      </div>
    </section>
  );
}

/**
 * The decision is kept out of the section above so that useScroll is never
 * bound to a ref that has nothing behind it. Without a context or with reduced
 * motion there is no prologue at all: the page opens on the hero, which is
 * what it did before this existed.
 */
export default function Story() {
  const reduce = useReducedMotionSafe();
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const probe = document.createElement("canvas");
      setSupported(Boolean(probe.getContext("webgl2") || probe.getContext("webgl")));
    } catch {
      setSupported(false);
    }
  }, []);

  if (reduce || !supported) return null;
  return <Prologue />;
}
