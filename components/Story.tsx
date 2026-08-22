"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useMotionValue, useScroll, useTransform } from "motion/react";
import { useReducedMotionSafe } from "./useReducedMotionSafe";
import { beat, STORY_HEIGHT } from "@/lib/story";
import SceneRail from "./story/SceneRail";

// three.js stays out of the first-load bundle, same as the hero's field.
const StoryStage = dynamic(() => import("./story/rig/StoryStage"), { ssr: false });

/**
 * The prologue. Before the hero says anything, a landscape of violet dots
 * stands up into an editor, which then writes the component the hero is made
 * of.
 *
 * The beats are named in lib/story, in viewport heights rather than fractions
 * of the section, so a scene can be appended without moving the ones before
 * it. In order: the cue drops onto the ground, the landscape flattens and
 * swings up into the shape of the window, the window resolves into a screen,
 * the file is typed, and the camera pulls back onto the laptop the screen
 * turns out to be part of, the room swings around it onto the three
 * quarter view, and the laptop comes apart into the system it was built with. The gather starts on the same scroll that takes the
 * cue away, so obeying the cue is what moves the landscape.
 *
 * The fade at the very end is temporary. Scene 3 turns the laptop and takes
 * that range for itself.
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

  const fall = useTransform(scrollYProgress, beat("fall"), [0, 1]);
  const assemble = useTransform(scrollYProgress, beat("gather"), [0, 1]);
  const reveal = useTransform(scrollYProgress, beat("reveal"), [0, 1]);
  const type = useTransform(scrollYProgress, beat("type"), [0, 1]);
  const pull = useTransform(scrollYProgress, beat("pull"), [0, 1]);
  const turn = useTransform(scrollYProgress, beat("turn"), [0, 1]);
  const arch = useTransform(scrollYProgress, beat("architecture"), [0, 1]);
  const swing = useTransform(scrollYProgress, beat("swing"), [0, 1]);
  const perf = useTransform(scrollYProgress, beat("performance"), [0, 1]);
  const exit = useTransform(scrollYProgress, [0.988, 1], [0, 1]);

  return (
    <section
      ref={host}
      style={{ height: `${STORY_HEIGHT}dvh` }}
      className="relative w-full"
    >
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
          pull={pull}
          turn={turn}
          arch={arch}
          swing={swing}
          perf={perf}
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
