"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "motion/react";
import { ArrowDownRight } from "@phosphor-icons/react/dist/ssr";
import dynamic from "next/dynamic";
import Button from "./Button";
import SplitLines from "./SplitLines";
import { useReducedMotionSafe } from "./useReducedMotionSafe";
import { onLoaderDone } from "@/lib/boot";
import { heroExit } from "@/lib/stage";
import { HERO, PERSON } from "@/lib/content";

// three.js stays out of the first-load bundle.
const Lattice = dynamic(() => import("./webgl/Lattice"), { ssr: false });

const EASE = [0.16, 1, 0.3, 1] as const;
const STATIC = { opacity: 1, y: 0 };

/**
 * Entrance happens once the loader hands over, not on scroll: headline, then
 * the role caption, then subtext, then actions. The loader now hands over
 * only after the rain has finished uncovering the page, so these delays are
 * measured from a page the reader is already looking at. They are short on
 * purpose: anything longer reads as the hero being late rather than as a
 * sequence.
 *
 * The role caption sits with the subtext at the foot of the block, not above
 * the headline. Above the headline it was the first thing to be pushed off
 * the top of a short viewport, and the fixed bar covered it.
 *
 * Exit is scroll driven across a 200dvh pin. The copy leaves first, then the
 * field takes the whole rest of the range and hands the page to the next
 * section by itself:
 *   0.06 - 0.16   headline leaves
 *   0.14 - 0.24   subtext
 *   0.22 - 0.32   actions
 *   0.05 - 0.50   the lattice comes apart underneath
 *   0.26 - 0.58   it lies back, so the field falls into perspective
 *   0.50 - 0.94   the points leave the plane and stream past the reader
 *   0.72 - 0.97   the board underneath resolves out of blur while they are
 *                 still in the air, and they fade out into it
 *
 * Entrance and exit sit on separate elements. Sharing one would mean the
 * scroll style overwriting the entrance mid-animation.
 */
export default function Hero() {
  const host = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const [ready, setReady] = useState(false);

  /**
   * The entrance waits for the reader, not for the clock. The prologue runs
   * above this section now, so firing on the loader's handover would spend the
   * whole sequence on an empty screen and leave the hero already arrived by
   * the time anyone scrolled to it.
   *
   * The observer is only attached once the loader has gone. Attached earlier
   * it would measure the layout that exists before the prologue has mounted,
   * where this section is the top of the page, and latch immediately.
   */
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let io: IntersectionObserver | undefined;

    const release = onLoaderDone(() => {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setReady(true);
          io?.disconnect();
        },
        // Fires when the section reaches the middle band of the viewport,
        // which for a pinned section this tall means it has taken the screen.
        { rootMargin: "-30% 0px -30% 0px" },
      );
      io.observe(node);
    });

    return () => {
      release();
      io?.disconnect();
    };
  }, []);

  const mx = useMotionValue(2.4);
  const my = useMotionValue(2.4);

  const { scrollYProgress } = useScroll({
    target: host,
    offset: ["start start", "end end"],
  });

  const HOLD = [1, 1, 0, 0];
  const LIFT = [0, 0, -70, -70];

  const titleOut = useTransform(scrollYProgress, [0, 0.06, 0.16, 1], HOLD);
  const titleY = useTransform(scrollYProgress, [0, 0.06, 0.16, 1], LIFT);
  const subOut = useTransform(scrollYProgress, [0, 0.14, 0.24, 1], HOLD);
  const subY = useTransform(scrollYProgress, [0, 0.14, 0.24, 1], LIFT);
  const ctaOut = useTransform(scrollYProgress, [0, 0.22, 0.32, 1], HOLD);
  const ctaY = useTransform(scrollYProgress, [0, 0.22, 0.32, 1], LIFT);

  /**
   * Two separate reasons nothing scroll driven is bound until the loader has
   * handed over and the media query has been read.
   *
   * Flattening the output ranges for reduced motion did not work: Motion
   * compiles a scroll linked transform into a hardware animation whose
   * keyframes are baked on the first client render, before the query has been
   * read, so they are always baked as the moving ones. The reduced motion hero
   * is one viewport tall, which makes its scroll range degenerate, and the
   * animation then parks on its last keyframe.
   *
   * The same parking happens during load for a different reason: the page is
   * held at the top, so the timeline has nothing to measure. The headline sat
   * at opacity 0 for the whole load and snapped back one frame after the
   * loader left. That snap was the swap.
   */
  const live = ready && !reduce;
  const titleStyle = live ? { opacity: titleOut, y: titleY } : STATIC;
  const subStyle = live ? { opacity: subOut, y: subY } : STATIC;
  const ctaStyle = live ? { opacity: ctaOut, y: ctaY } : STATIC;

  // Read by the section below, which starts arriving before this one is done.
  useMotionValueEvent(scrollYProgress, "change", (v) => heroExit.set(v));

  const scatter = useTransform(scrollYProgress, [0, 0.05, 0.5, 1], [0, 0, 1, 1]);
  const tilt = useTransform(scrollYProgress, [0, 0.26, 0.58, 1], [0, 0, 1, 1]);
  const fly = useTransform(scrollYProgress, [0, 0.5, 0.94, 1], [0, 0, 1, 1]);
  const scrim = useTransform(scrollYProgress, [0, 0.18, 0.42, 1], [1, 1, 0, 0]);

  /**
   * The arriving point. Held at nothing until it is due, then grown on an
   * accelerating ramp so it reads as closing distance rather than as a circle
   * being scaled. It ends flat surf-2, which is the ground the next section
   * is painted on, so there is no seam to hide when the pin releases.
   *
   * A div rather than a point in the field: gl_PointSize is capped by the
   * driver well below full screen, and a point sprite is a square.
   */
  return (
    <section
      id="top"
      ref={host}
      className="relative h-[300dvh] w-full motion-reduce:h-[100dvh]"
    >
      <div
        className="sticky top-0 h-[100dvh] w-full overflow-hidden"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          mx.set(((event.clientX - box.left) / box.width) * 2 - 1);
          my.set(-(((event.clientY - box.top) / box.height) * 2 - 1));
        }}
      >
        <Lattice
          mx={mx}
          my={my}
          progress={scatter}
          tilt={tilt}
          fly={fly}
          scrim={scrim}
        />

        <div className="relative z-10 mx-auto flex h-[100dvh] max-w-[1400px] flex-col justify-end px-6 pt-24 pb-14 md:px-10 md:pb-20 lg:pl-[132px]">
          <motion.h1
            className="font-display text-[clamp(2.75rem,10.5vw,11rem)] leading-[0.9] font-bold tracking-[-0.03em]"
            style={titleStyle}
          >
            <SplitLines
              lines={HERO.lines}
              delay={reduce ? 0 : 0.16}
              stagger={0.16}
              duration={1.25}
              play={ready}
            />
          </motion.h1>

          <div className="mt-8 grid grid-cols-1 gap-8 md:mt-12 md:grid-cols-12 md:items-end">
            <motion.div
              className="md:col-span-6"
              style={subStyle}
            >
              <motion.p
                className="mb-4 flex items-center gap-3 font-mono text-xs tracking-[0.14em] text-glow uppercase md:mb-5 md:text-[13px]"
                initial={{ opacity: 0, y: 16 }}
                animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : 0.72, ease: EASE }}
              >
                <span aria-hidden="true" className="h-px w-8 shrink-0 bg-accent" />
                {PERSON.role}
              </motion.p>

              <motion.p
                className="max-w-[54ch] text-base leading-relaxed text-text md:text-lg"
                initial={{ opacity: 0, y: 24 }}
                animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: reduce ? 0 : 1.15, delay: reduce ? 0 : 0.95, ease: EASE }}
              >
                {HERO.sub}
              </motion.p>
            </motion.div>

            <motion.div
              className="md:col-span-5 md:col-start-8"
              style={ctaStyle}
            >
              <motion.div
                className="flex flex-wrap items-center gap-3 md:justify-end"
                initial={{ opacity: 0, y: 24 }}
                animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: reduce ? 0 : 1.15, delay: reduce ? 0 : 1.2, ease: EASE }}
              >
                <Button
                  href={HERO.primary.href}
                  label={HERO.primary.label}
                  icon={<ArrowDownRight size={16} weight="regular" />}
                  magnetic={0.28}
                />
                <Button
                  href={HERO.secondary.href}
                  label={HERO.secondary.label}
                  variant="ghost"
                  className="bg-void/50 backdrop-blur-sm"
                  magnetic={0.2}
                />
              </motion.div>
            </motion.div>
          </div>
        </div>

      </div>
    </section>
  );
}
