"use client";

import { useEffect, useState } from "react";

/**
 * Reads the media query after mount so server and client markup agree.
 * Motion's own hook is used inside motion props; this one is for the
 * cases where the DOM or a class list depends on the answer.
 */
export function useReducedMotionSafe() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduce;
}
