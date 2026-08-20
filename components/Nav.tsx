"use client";

import { useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "motion/react";
import { List, X } from "@phosphor-icons/react/dist/ssr";
import Button from "./Button";
import { NAV, PERSON } from "@/lib/content";

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => setSolid(v > 24));

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 h-[72px] transition-colors duration-300 ${
          solid ? "border-b border-line bg-void/80 backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <nav className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6 md:px-10">
          <a href="#top" className="font-display text-lg font-bold tracking-tight">
            {PERSON.name}
          </a>

          <div className="hidden items-center gap-9 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="link-wipe text-sm text-muted hover:text-text"
              >
                {item.label}
              </a>
            ))}
            <Button href="#contact" label="Get in touch" size="sm" magnetic={0.22} />
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="text-text md:hidden"
          >
            <List size={26} weight="regular" />
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[55] bg-void px-6 md:hidden"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -18 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex h-[72px] items-center justify-end">
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu">
                <X size={26} weight="regular" />
              </button>
            </div>
            <div className="mt-10 flex flex-col gap-7">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="link-wipe font-display text-4xl font-bold tracking-tight"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-4">
                <Button
                  href="#contact"
                  label="Get in touch"
                  onClick={() => setOpen(false)}
                  magnetic={false}
                  full
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
