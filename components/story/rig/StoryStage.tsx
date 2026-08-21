"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import EditorAssembly from "../scenes/EditorAssembly";

/**
 * The prologue's canvas and camera.
 *
 * One stage for the whole story rather than one per scene: the scenes that
 * follow zoom this camera out to a laptop and then turn it, and a handover
 * between two canvases in the middle of that move would be a cut. Scene 1
 * leaves the camera still, square on to the screen.
 *
 * Frames stop when the section is off screen, and the whole thing is gated on
 * a real WebGL context upstream, in Story.
 */
export default function StoryStage({
  assemble,
  fall,
  reveal,
  type,
  exit,
  mx,
  my,
}: {
  assemble: MotionValue<number>;
  fall: MotionValue<number>;
  reveal: MotionValue<number>;
  type: MotionValue<number>;
  exit: MotionValue<number>;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(true);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => setLive(entry.isIntersecting), {
      rootMargin: "120px",
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={host}
      className="webgl-inert pointer-events-none absolute inset-0 -z-10"
      aria-hidden="true"
    >
      {/* Sits under the canvas, so the prologue is never a bare rectangle. Far
          dimmer than the hero's, and with no flat grid over it: the landscape
          is the structure here, and a second grid printed across the glass
          both fought it and lifted the whole frame off black. */}
      <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_50%_72%,rgba(139,92,246,0.10),transparent_66%)]" />
      <Canvas
        frameloop={live ? "always" : "never"}
        dpr={[1, 1.75]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 6], fov: 45 }}
      >
        <EditorAssembly
          assemble={assemble}
          fall={fall}
          reveal={reveal}
          type={type}
          exit={exit}
          mx={mx}
          my={my}
        />
      </Canvas>
    </div>
  );
}
