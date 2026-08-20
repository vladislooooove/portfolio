"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

gsap.registerPlugin(ScrollTrigger);

/**
 * Feedback: scrolling gets weight, so pinned sections settle instead of
 * snapping. Driven off the GSAP ticker so ScrollTrigger and Lenis agree
 * on a single clock. Off entirely under reduced motion.
 */
export default function SmoothScroll() {
  const reduce = useReducedMotionSafe();

  useEffect(() => {
    if (reduce) return;

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    const raf = (time: number) => lenis.raf(time * 1000);

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [reduce]);

  return null;
}
