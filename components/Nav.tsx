"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { List, X } from "@phosphor-icons/react/dist/ssr";
import Button from "./Button";
import { NAV, PERSON } from "@/lib/content";

/**
 * The bar sits on a progressive blur rather than a flat translucent fill, so
 * the page does not end on a hard line under it. See `.curtain` in
 * globals.css for how the falloff is built.
 *
 * The tint and the hairline are driven from scroll as motion values, never as
 * state, so scrolling does not re-render the tree. The bar itself stays put:
 * it is the one thing on the page that is always reachable.
 *
 * Section links live on the rail down the left edge now, so all this carries
 * is who the page belongs to and the one thing to do about it. The mobile
 * menu still holds the full list, because a rail is no use on a phone.
 */

const MONOGRAM = PERSON.name
  .split(" ")
  .map((part) => part[0])
  .join("");

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [reachable, setReachable] = useState<string[]>([]);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  // Parked sections are not offered. A link that scrolls nowhere is worse
  // than no link.
  useEffect(() => {
    setReachable(NAV.filter((i) => document.querySelector(i.href)).map((i) => i.href));
  }, []);

  // Nothing at the top of the page, full weight once content is behind it.
  const tint = useTransform(scrollY, [0, 140], [0.55, 1]);
  const hairline = useTransform(scrollY, [40, 160], [0, 1]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-[72px]">
        <div className="curtain" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <motion.div className="curtain-tint" style={{ opacity: tint }} aria-hidden="true" />
        <motion.div
          aria-hidden="true"
          style={{ opacity: hairline }}
          className="absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent_0,var(--color-line)_14%,var(--color-line)_86%,transparent_100%)]"
        />

        <nav className="relative mx-auto flex h-full max-w-[1400px] items-center justify-between px-6 md:px-10">
          <a href="#top" className="group flex items-center gap-3">
            <span
              aria-hidden="true"
              className="font-display flex h-9 w-9 items-center justify-center border border-line-control text-[13px] leading-none font-bold tracking-tight transition-colors duration-300 group-hover:border-accent group-hover:bg-accent group-hover:text-void"
            >
              {MONOGRAM}
            </span>
            <span className="font-display hidden text-[15px] font-bold tracking-tight sm:block">
              {PERSON.name}
            </span>
          </a>

          <div className="hidden items-center gap-6 lg:flex">
            {/* A real availability flag, and the only status dot on the page. */}
            <span className="hidden items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-muted uppercase xl:flex">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-glow" />
              Open to senior roles
            </span>
            <Button href="#contact" label="Get in touch" size="sm" magnetic={0.22} />
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center border border-line-control text-text transition-colors duration-300 hover:border-accent hover:bg-accent hover:text-void lg:hidden"
          >
            <List size={20} weight="regular" />
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[55] flex flex-col bg-void px-6 lg:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex h-[72px] shrink-0 items-center justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center border border-line-control text-text"
              >
                <X size={20} weight="regular" />
              </button>
            </div>

            <div className="mt-10 flex flex-col gap-7">
              {NAV.filter((item) => reachable.includes(item.href)).map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="link-wipe font-display text-4xl font-bold tracking-tight"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="mt-auto pb-10">
              <span className="mb-5 flex items-center gap-2.5 font-mono text-[11px] tracking-[0.14em] text-muted uppercase">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 bg-glow" />
                Open to senior roles
              </span>
              <Button
                href="#contact"
                label="Get in touch"
                onClick={() => setOpen(false)}
                magnetic={false}
                full
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
