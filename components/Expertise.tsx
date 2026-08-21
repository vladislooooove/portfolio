"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import Reveal from "./Reveal";
import { useReducedMotionSafe } from "./useReducedMotionSafe";
import { EXPERTISE } from "@/lib/content";

const PcbBackdrop = dynamic(() => import("./PcbBackdrop"), { ssr: false });

/**
 * The cards ride a ring, not a rail.
 *
 * Each one sits at an angle on a circle laid flat in the XZ plane and the
 * whole ring turns as you scroll, so a card enters from the right, swings
 * forward through the middle, and leaves to the left. Its own facing follows
 * the tangent, which is where the turn comes from: nothing is animated
 * separately, it all falls out of one angle.
 *
 * STEP is the gap between neighbours in radians and EDGE is where a card has
 * gone. Together they decide how many are on screen at once, which is about
 * four. RADIUS sets how hard the path bows around the processor.
 *
 * The ring rides low in the frame on purpose. The arc bows toward the reader,
 * so whatever is dead centre is also nearest, and at the height the cards
 * started at that card sat straight on top of the processor and buried it.
 */
const STEP = 0.55;
const EDGE = 1.05;
const RADIUS = 1020;
const DEPTH = 0.62;

const CARD_W = 460;
const CARD_H = 320;

/** Head is the index sitting dead centre. It runs past both ends. */
const HEAD_FROM = -(EDGE / STEP) - 0.3;
const HEAD_TO = EXPERTISE.length - 1 + EDGE / STEP + 0.3;

type Item = (typeof EXPERTISE)[number];

function CardFace({ item }: { item: Item }) {
  return (
    <>
      <h3 className="font-display text-[1.6rem] leading-[1.08] font-bold tracking-tight md:text-[1.9rem]">
        {item.title}
      </h3>
      <p className="mt-5 text-[0.95rem] leading-relaxed text-text/85 md:text-base">
        {item.body}
      </p>

      {/* The proof sits on the floor of the card behind its own rule, so it
          reads as the record rather than as another sentence. */}
      <div className="mt-auto border-t border-line-control/40 pt-5">
        <p className="font-mono text-[11px] tracking-[0.16em] text-glow uppercase">
          {item.proof}
        </p>
      </div>

      <span aria-hidden="true" className="bracket bracket-l" />
      <span aria-hidden="true" className="bracket bracket-r" />
    </>
  );
}

function ArcCard({
  item,
  index,
  head,
}: {
  item: Item;
  index: number;
  head: MotionValue<number>;
}) {
  const theta = useTransform(head, (h) => (index - h) * STEP);

  const x = useTransform(theta, (t) => Math.sin(t) * RADIUS);
  const z = useTransform(theta, (t) => (Math.cos(t) - 1) * RADIUS * DEPTH);
  const rotateY = useTransform(theta, (t) => (-t * 180) / Math.PI);

  // Both fall off with the square of the angle, so the middle of the arc
  // holds its focus and the ends give way quickly rather than sitting there
  // half legible.
  const opacity = useTransform(theta, (t) => {
    const k = Math.min(1, Math.abs(t) / EDGE);
    return Math.max(0, 1 - k * k * 1.2);
  });
  const filter = useTransform(theta, (t) => {
    const k = Math.min(1, Math.abs(t) / EDGE);
    const blur = k * k * 10;
    // A filter of blur(0) still puts the element on its own layer. Below a
    // pixel it is not worth the raster, so it comes off entirely.
    return blur < 0.4 ? "none" : `blur(${blur.toFixed(1)}px)`;
  });
  const pointerEvents = useTransform(theta, (t) =>
    Math.abs(t) < STEP * 0.6 ? "auto" : "none",
  );

  // Hover tilt. Motion values rather than state: this runs on every pointer
  // move and re-rendering the ring on each one would collapse it.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 220, damping: 22, mass: 0.4 };
  const tiltX = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), spring);
  const tiltY = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), spring);
  const lift = useMotionValue(0);
  const liftZ = useSpring(lift, spring);
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionValue(0);
  const glareOn = useSpring(glare, { stiffness: 180, damping: 26 });
  const glareImage = useTransform(
    [glareX, glareY],
    ([gx, gy]: string[]) =>
      `radial-gradient(38% 46% at ${gx} ${gy}, rgb(203 184 255 / 0.24), transparent 70%)`,
  );

  return (
    <motion.div
      style={{
        x,
        z,
        rotateY,
        opacity,
        filter,
        pointerEvents,
        width: CARD_W,
        height: CARD_H,
        marginLeft: -CARD_W / 2,
        marginTop: -CARD_H / 2,
        transformStyle: "preserve-3d",
      }}
      className="absolute top-0 left-0"
    >
      <motion.article
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          px.set((event.clientX - box.left) / box.width - 0.5);
          py.set((event.clientY - box.top) / box.height - 0.5);
        }}
        onPointerEnter={() => {
          lift.set(46);
          glare.set(1);
        }}
        onPointerLeave={() => {
          px.set(0);
          py.set(0);
          lift.set(0);
          glare.set(0);
        }}
        style={{
          rotateX: tiltX,
          rotateY: tiltY,
          z: liftZ,
          transformPerspective: 780,
          transformStyle: "preserve-3d",
        }}
        className="card-lux relative flex h-full w-full flex-col overflow-hidden p-8 backdrop-blur-[3px] md:p-9"
      >
        <CardFace item={item} />

        {/* The light the tilt is catching. Follows the pointer, so the card
            reads as a surface with an angle rather than a picture of one. */}
        <motion.span
          aria-hidden="true"
          style={{ opacity: glareOn, background: glareImage }}
          className="pointer-events-none absolute inset-0"
        />
      </motion.article>
    </motion.div>
  );
}

export default function Expertise() {
  const host = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const read = () => setWide(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  // The ring needs the room to turn in. Without it the section is only as
  // tall as the stack it falls back to.
  const arc = wide && !reduce;

  const { scrollYProgress } = useScroll({
    target: host,
    offset: ["start start", "end end"],
  });
  const { scrollYProgress: drift } = useScroll({
    target: host,
    offset: ["start end", "end start"],
  });
  /*
   * The board is meant to go out with the tear, so the work section does not
   * arrive over a lit circuit. Both are parked together: with the tear off,
   * this fade left the last viewport of the section standing on bare void.
   * Restore it to [0, 0.4, 0.82, 1] -> [0, 0, 1, 1] when Selected work is back.
   */
  const leave = useTransform(scrollYProgress, [0, 1], [0, 0]);

  // The heading rises into place and holds there for the rest of the section.
  // Every range here runs 0 to 1: a scroll transform that only covers part of
  // the track gets compiled into keyframes that do not hold their ends.
  const titleY = useTransform(scrollYProgress, [0, 0.09, 1], ["24vh", "0vh", "0vh"]);
  const head = useTransform(
    scrollYProgress,
    [0, 0.13, 0.97, 1],
    [HEAD_FROM, HEAD_FROM, HEAD_TO, HEAD_TO],
  );

  return (
    <section
      id="expertise"
      ref={host}
      className={`relative w-full bg-void ${arc ? "h-[420dvh]" : ""}`}
    >
      <PcbBackdrop leave={leave} drift={drift} />

      {arc ? (
        <div className="sticky top-0 h-[100dvh] w-full overflow-hidden">
          <motion.div
            style={{ y: titleY }}
            className="absolute inset-x-0 top-[28dvh] z-10 mx-auto w-full max-w-[1400px] px-6 md:px-10 lg:pl-[132px]"
          >
            <h2 className="font-display text-[clamp(2.75rem,7.5vw,6.5rem)] leading-[0.96] font-bold tracking-[-0.02em]">
              Areas of expertise
            </h2>
          </motion.div>

          {/* The stage the ring turns inside. Perspective belongs here, on the
              parent, or every card would get its own vanishing point and the
              arc would read as eight unrelated rotations. */}
          <div
            className="absolute inset-0 z-10"
            style={{ perspective: 1500, perspectiveOrigin: "50% 70%" }}
          >
            <div
              className="absolute top-[70dvh] left-1/2"
              style={{ transformStyle: "preserve-3d" }}
            >
              {EXPERTISE.map((item, i) => (
                <ArcCard key={item.title} item={item} index={i} head={head} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 py-28 md:px-10 md:py-40">
          <Reveal>
            <h2 className="font-display text-[clamp(2.5rem,9vw,4rem)] leading-[0.98] font-bold tracking-[-0.02em]">
              Areas of expertise
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-5 md:mt-16 md:grid-cols-2">
            {EXPERTISE.map((item, i) => (
              <Reveal key={item.title} delay={(i % 2) * 0.06}>
                <article className="card-lux relative flex h-full min-h-[300px] flex-col p-8 backdrop-blur-[3px] md:p-9">
                  <CardFace item={item} />
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
