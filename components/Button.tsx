"use client";

import type { ReactNode } from "react";
import Magnetic from "./Magnetic";

type Common = {
  label: string;
  variant?: "solid" | "ghost";
  icon?: ReactNode;
  className?: string;
  magnetic?: number | false;
  full?: boolean;
  size?: "sm" | "md";
};

type AsLink = Common & { href: string; onClick?: () => void; external?: boolean };
type AsButton = Common & {
  type: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * One label, printed twice. The first copy carries the accessible name and
 * the duplicate is hidden from assistive tech, so the roll never reads twice.
 */
function Face({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <>
      <span className="btn-roll">
        <span className="btn-roll-track">
          <span className="btn-roll-item">{label}</span>
          <span className="btn-roll-item" aria-hidden="true">
            {label}
          </span>
        </span>
      </span>
      {icon ? <span className="btn-icon inline-flex">{icon}</span> : null}
    </>
  );
}

const SIZING = {
  sm: "px-5 py-2.5 text-sm font-medium",
  md: "px-7 py-4 text-sm font-medium",
} as const;

const SHARED = "active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70";

export default function Button(props: AsLink | AsButton) {
  const {
    label,
    variant = "solid",
    icon,
    className = "",
    magnetic = 0.24,
    full = false,
    size = "md",
  } = props;

  const classes = [
    "btn",
    variant === "solid" ? "btn-solid" : "btn-ghost",
    SIZING[size],
    SHARED,
    full ? "w-full justify-center" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const node =
    "href" in props ? (
      <a
        href={props.href}
        onClick={props.onClick}
        className={classes}
        {...(props.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
      >
        <Face label={label} icon={icon} />
      </a>
    ) : (
      <button
        type={props.type}
        onClick={props.onClick}
        disabled={props.disabled}
        className={classes}
      >
        <Face label={label} icon={icon} />
      </button>
    );

  if (magnetic === false) return node;
  return (
    <Magnetic strength={magnetic} className={full ? "w-full" : "inline-block"}>
      {node}
    </Magnetic>
  );
}
