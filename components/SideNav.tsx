"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, motionValue, useMotionValueEvent, useScroll } from "motion/react";
import { NAV } from "@/lib/content";

/**
 * Section rail down the left edge, in place of links across the top.
 *
 * Each mark fills as its section passes, which is the whole point of putting
 * it here: the bar across the top could say where you can go, and this says
 * where you are as well.
 *
 * The labels are always up, so the rail needs room of its own. The page
 * containers carry a matching left pad from lg, which is the width this
 * reserves. Below lg the rail is gone and the menu carries the list.
 *
 * Section offsets are measured once and on resize, never per frame. The fills
 * are motion values written from a single scroll handler, so a rail of six
 * items costs one subscription and no re-renders; only the active index is
 * state, and it changes a handful of times per page.
 */
const clamp = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export default function SideNav() {
  const [live, setLive] = useState<typeof NAV>([]);
  const [active, setActive] = useState(0);
  const bounds = useRef<{ top: number; height: number }[]>([]);
  const { scrollY } = useScroll();

  const fills = useMemo(() => NAV.map(() => motionValue(0)), []);

  const settleFills = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;
    bounds.current.forEach((b, i) => {
      if (!b.height) return;
      fills[i]?.set(clamp((y + vh - b.top) / (b.height + vh)));
    });
  };

  useEffect(() => {
    const present = NAV.filter((item) => document.querySelector(item.href));
    setLive(present);

    const measure = () => {
      bounds.current = present.map((item) => {
        const el = document.querySelector<HTMLElement>(item.href);
        if (!el) return { top: 0, height: 0 };
        const box = el.getBoundingClientRect();
        return { top: box.top + window.scrollY, height: box.height };
      });
    };
    measure();
    settleFills();

    // Layout settles after fonts and the hero canvas, so measure again once
    // things have stopped moving rather than trusting the first pass.
    const settle = window.setTimeout(() => {
      measure();
      settleFills();
    }, 1200);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useMotionValueEvent(scrollY, "change", (y) => {
    const vh = window.innerHeight;
    let nearest = 0;
    let best = Infinity;

    bounds.current.forEach((b, i) => {
      if (!b.height) return;
      fills[i]?.set(clamp((y + vh - b.top) / (b.height + vh)));
      const centre = b.top + b.height / 2 - (y + vh / 2);
      if (Math.abs(centre) < best) {
        best = Math.abs(centre);
        nearest = i;
      }
    });

    setActive((current) => (current === nearest ? current : nearest));
  });

  if (live.length === 0) return null;

  return (
    <nav
      aria-label="Sections"
      className="fixed top-0 left-0 z-40 hidden h-full flex-col justify-center gap-1 pl-6 lg:flex"
    >
      {live.map((item, i) => {
        const on = i === active;
        return (
          <a
            key={item.href}
            href={item.href}
            className="group flex h-11 items-center gap-3"
            aria-current={on ? "true" : undefined}
          >
            {/* A dot until it is the section you are in, then a track with
                the progress through it. One element, so the change is a
                height and a radius rather than a swap. */}
            <span
              aria-hidden="true"
              className={`relative block w-[3px] shrink-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                on
                  ? "h-10 rounded-none bg-line-control"
                  : "h-[3px] rounded-full bg-muted group-hover:bg-text"
              }`}
            >
              <motion.span
                style={{ scaleY: fills[i] }}
                className={`absolute inset-0 block origin-top bg-glow transition-opacity duration-300 ${
                  on ? "opacity-100" : "opacity-0"
                }`}
              />
            </span>

            <span
              className={`font-mono text-[11px] tracking-[0.16em] whitespace-nowrap uppercase transition-colors duration-300 ${
                on ? "text-text" : "text-muted group-hover:text-text"
              }`}
            >
              {item.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
