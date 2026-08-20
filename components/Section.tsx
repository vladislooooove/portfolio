"use client";

import type { ReactNode } from "react";

/**
 * A full viewport-height block. Sections no longer animate their own arrival;
 * the only section transition on the page is the hero tear.
 */
export type Tone = "void" | "surf" | "surf-2" | "none";

const TONES: Record<Tone, string> = {
  void: "bg-void",
  surf: "bg-surf",
  "surf-2": "bg-surf-2",
  none: "",
};

export default function Section({
  id,
  children,
  tone = "void",
  texture,
  className = "",
  contentClassName = "",
  bleed = false,
}: {
  id?: string;
  children: ReactNode;
  tone?: Tone;
  texture?: ReactNode;
  className?: string;
  contentClassName?: string;
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative flex min-h-[100dvh] w-full items-center overflow-hidden ${TONES[tone]} ${className}`}
    >
      {texture ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {texture}
        </div>
      ) : null}

      <div
        className={`relative z-10 w-full ${
          bleed ? "" : "mx-auto max-w-[1400px] px-6 py-24 md:px-10"
        } ${contentClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
