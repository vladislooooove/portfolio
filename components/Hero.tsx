"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "motion/react";
import { ArrowDownRight } from "@phosphor-icons/react/dist/ssr";
import dynamic from "next/dynamic";
import Button from "./Button";
import SplitLines from "./SplitLines";
import { useReducedMotionSafe } from "./useReducedMotionSafe";
import { isLoaderDone, onLoaderDone } from "@/lib/boot";
import { HERO, PERSON } from "@/lib/content";

// three.js stays out of the first-load bundle.
const Lattice = dynamic(() => import("./webgl/Lattice"), { ssr: false });
const TearReveal = dynamic(() => import("./webgl/TearReveal"), { ssr: false });

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Entrance happens once the loader hands over, not on scroll: headline, then
 * subtext, then actions. The delays are set so the sequence is visible as the
 * loader slides away rather than finishing underneath it.
 *
 * Exit is scroll driven across a 200dvh pin, in the order asked for:
 *   0.06 - 0.16   headline leaves
 *   0.14 - 0.24   subtext
 *   0.22 - 0.32   actions
 *   0.05 - 0.88   the field comes apart underneath, throughout
 *   0.38 - 0.90   tear
 *   0.50 - 1.00   next section slides up behind it
 *
 * Entrance and exit sit on separate elements. Sharing one would mean the
 * scroll style overwriting the entrance mid-animation.
 */
export default function Hero() {
  const host = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoaderDone()) {
      setReady(true);
      return;
    }
    return onLoaderDone(() => setReady(true));
  }, []);

  const mx = useMotionValue(2.4);
  const my = useMotionValue(2.4);

  const { scrollYProgress } = useScroll({
    target: host,
    offset: ["start start", "end end"],
  });

  // Reduced motion flattens the ranges. Dropping the style prop instead would
  // leave whatever Motion last wrote inline, and the copy would never return.
  const hold = reduce ? [1, 1, 1, 1] : [1, 1, 0, 0];
  const still = reduce ? [0, 0, 0, 0] : [0, 0, -70, -70];

  const titleOut = useTransform(scrollYProgress, [0, 0.06, 0.16, 1], hold);
  const titleY = useTransform(scrollYProgress, [0, 0.06, 0.16, 1], still);
  const subOut = useTransform(scrollYProgress, [0, 0.14, 0.24, 1], hold);
  const subY = useTransform(scrollYProgress, [0, 0.14, 0.24, 1], still);
  const ctaOut = useTransform(scrollYProgress, [0, 0.22, 0.32, 1], hold);
  const ctaY = useTransform(scrollYProgress, [0, 0.22, 0.32, 1], still);

  const scatter = useTransform(scrollYProgress, [0, 0.05, 0.88, 1], [0, 0, 1, 1]);
  const tear = useTransform(scrollYProgress, [0, 0.38, 0.9, 1], [0, 0, 1, 1]);

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
        <Lattice mx={mx} my={my} progress={scatter} />

        <div className="relative z-10 mx-auto flex h-[100dvh] max-w-[1400px] flex-col justify-end px-6 pt-24 pb-14 md:px-10 md:pb-20">
          <motion.p
            className="mb-10 font-mono text-xs text-text md:mb-14 md:text-sm"
            style={{ opacity: titleOut, y: titleY }}
          >
            <motion.span
              className="block"
              initial={{ opacity: 0 }}
              animate={{ opacity: ready ? 1 : 0 }}
              transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.28, ease: EASE }}
            >
              {PERSON.role}
            </motion.span>
          </motion.p>

          <motion.h1
            className="font-display text-[clamp(3rem,12vw,13rem)] leading-[0.9] font-bold tracking-[-0.03em]"
            style={{ opacity: titleOut, y: titleY }}
          >
            <SplitLines lines={HERO.lines} delay={reduce ? 0 : 0.4} play={ready} />
          </motion.h1>

          <div className="mt-10 grid grid-cols-1 gap-8 md:mt-14 md:grid-cols-12 md:items-end">
            <motion.div
              className="md:col-span-6"
              style={{ opacity: subOut, y: subY }}
            >
              <motion.p
                className="max-w-[54ch] text-base leading-relaxed text-text md:text-lg"
                initial={{ opacity: 0, y: 24 }}
                animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 0.86, ease: EASE }}
              >
                {HERO.sub}
              </motion.p>
            </motion.div>

            <motion.div
              className="md:col-span-5 md:col-start-8"
              style={{ opacity: ctaOut, y: ctaY }}
            >
              <motion.div
                className="flex flex-wrap items-center gap-3 md:justify-end"
                initial={{ opacity: 0, y: 24 }}
                animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 1.14, ease: EASE }}
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

        {!reduce && (
          <div className="pointer-events-none absolute inset-0 z-20">
            <TearReveal progress={tear} color="#1e1830" accent="#8b5cf6" />
          </div>
        )}
      </div>
    </section>
  );
}
