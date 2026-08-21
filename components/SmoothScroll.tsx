"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotionSafe } from "./useReducedMotionSafe";

gsap.registerPlugin(ScrollTrigger);

/** Clears the fixed bar, so a target's heading is not left underneath it. */
const BAR = 72;

/**
 * Feedback: scrolling gets weight, so pinned sections settle instead of
 * snapping. Driven off the GSAP ticker so ScrollTrigger and Lenis agree on a
 * single clock. Off entirely under reduced motion.
 *
 * In-page links are handled here rather than through Lenis's own `anchors`
 * option. That option scrolls to the right place but never calls
 * preventDefault, so the browser performs its native hash jump first and
 * Lenis then animates from where it thought it was: measured as a jump to
 * 3200, a snap back to 1855, and only then a smooth ride to the target.
 * Taking the click ourselves is one listener and leaves nothing to chance.
 */
export default function SmoothScroll() {
  const reduce = useReducedMotionSafe();

  useEffect(() => {
    if (reduce) return;

    const lenis = new Lenis({ duration: 1.25, smoothWheel: true });
    const raf = (time: number) => lenis.raf(time * 1000);

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a");
      if (!link) return;

      // Same document only. A link out to another page keeps its own job.
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== window.location.pathname ||
        !url.hash ||
        url.hash === "#"
      ) {
        return;
      }

      const destination = document.querySelector(decodeURIComponent(url.hash));
      if (!destination) return;

      event.preventDefault();
      lenis.scrollTo(destination as HTMLElement, {
        offset: -BAR,
        duration: 1.6,
      });
      // The address bar should still say where we are, without the jump that
      // setting location.hash would cause.
      window.history.pushState(null, "", url.hash);
    };

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [reduce]);

  return null;
}
