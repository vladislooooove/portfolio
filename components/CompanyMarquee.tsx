"use client";

import { COMPANIES } from "@/lib/content";

/**
 * The company marquee, lifted whole out of the section that used to carry it.
 *
 * Nothing renders this at the moment. It is kept intact, styling and all, so
 * the strip can go back on the page wherever it earns a place: drop it into a
 * section and it works, no wiring.
 *
 * The track is duplicated because the CSS translates it by exactly -50%, so
 * the second run is what the first one loops into. The `.ticker` and
 * `.ticker-track` rules live in globals.css and pause the run on hover.
 *
 * `edge` should match whatever the section's ground is, or the fades at the
 * two ends will show as bands.
 */
function Run({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {COMPANIES.map((name, i) => (
        <li
          key={name}
          className={`font-display px-6 text-[clamp(2.5rem,7vw,7rem)] leading-none font-bold tracking-tight whitespace-nowrap md:px-12 ${
            i % 2 === 1 ? "stroked" : "text-text"
          }`}
        >
          {name}
        </li>
      ))}
    </ul>
  );
}

export default function CompanyMarquee({
  edge = "from-void",
}: {
  /** Tailwind gradient stop for the fades, matching the ground behind it. */
  edge?: string;
}) {
  return (
    <div className="ticker relative overflow-hidden py-4">
      <div className="ticker-track flex w-max">
        <Run />
        <Run hidden />
      </div>
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r ${edge} to-transparent md:w-52`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l ${edge} to-transparent md:w-52`}
      />
    </div>
  );
}
