"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import Assembly from "../scenes/Assembly";

const smoother = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/**
 * How far round and how far up the turn goes, once the pull is done.
 *
 * Round to the laptop's front left, not its front right. From there the lid
 * falls to the upper left of the frame and the rows of keys run up to the
 * right, which is the isometric the reference is drawn on. Coming round the
 * other way mirrors it, and the deck reads back to front.
 */
const AZIMUTH = THREE.MathUtils.degToRad(42);
const RISE = THREE.MathUtils.degToRad(22);
/** And again to close the chapter: the other way round, and a little lower. */
const SWING = THREE.MathUtils.degToRad(-58);
const DROP = THREE.MathUtils.degToRad(-6);

/**
 * The camera, which is the whole of scenes 2 and 3. It goes back far enough to
 * see what the screen was part of, then swings round the laptop and rises onto
 * the three quarter view. Nothing in the scene moves to meet it: the laptop is
 * planted on the desk and the room comes around it.
 *
 * The turn is applied to the pull's own result rather than being a second path
 * of its own. Converting that offset to spherical, adding the angles and
 * converting back is an identity transform at turn = 0, so the last frame of
 * one scene and the first frame of the next are the same picture by
 * construction rather than by two sets of numbers agreeing.
 *
 * Driven straight onto the camera inside the frame loop rather than through
 * r3f's state, which would recompute the viewport and rebuild every buffer
 * measured against it partway down the page.
 */
function Rig({
  pull,
  turn,
  arch,
  swing,
  perf,
}: {
  pull: MotionValue<number>;
  turn: MotionValue<number>;
  arch: MotionValue<number>;
  swing: MotionValue<number>;
  perf: MotionValue<number>;
}) {
  const camera = useThree((state) => state.camera);
  const aim = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const orbit = useRef(new THREE.Spherical());

  useFrame(() => {
    const p = smoother(pull.get());
    const t = smoother(turn.get());
    const a = smoother(arch.get());
    const w = smoother(swing.get());
    const f = smoother(perf.get());

    aim.current.set(0, -0.68 * p, 0);
    offset.current.set(0, 1.5 * p, 6 + 5.2 * p).sub(aim.current);

    if (t > 0) {
      orbit.current.setFromVector3(offset.current);
      orbit.current.theta -= AZIMUTH * t + SWING * w;
      orbit.current.phi -= RISE * t + DROP * w;
      // Backs off on the way round. Turned on the spot the object grows into
      // the frame as it opens out, and the base runs off two edges at once.
      orbit.current.radius *= (1 + 0.2 * t) * (1 - 0.05 * w);
      offset.current.setFromSpherical(orbit.current);

      // And the aim walks from the screen to the middle of the whole object,
      // which is well forward of it once the deck is in view.
      aim.current.y -= 0.34 * t;
      aim.current.z += 1.3 * t;
    }

    // The model stands where the laptop stood, so the view only rides up onto
    // it. Backing off as well made the handover read as a cut to a wider shot
    // rather than as one object replacing another in the same frame.
    if (a > 0) aim.current.y += 1.85 * a;

    // The dashboard sits on the deck rather than floating over it, so the view
    // comes back down off the system it replaced. It does not also back off:
    // that left the whole chapter reading as a wide shot of a small object.
    // Down as the cubes fall, not after they have landed. Held high through
    // the drop, the camera watched the system's empty airspace while the whole
    // shatter piled up off the bottom of the frame.
    if (f > 0) aim.current.y -= 1.85 * smoother(Math.min(1, perf.get() / 0.4));

    camera.position.copy(aim.current).add(offset.current);
    camera.lookAt(aim.current);
  });

  return null;
}

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
  pull,
  turn,
  arch,
  swing,
  perf,
  reveal,
  type,
  exit,
  mx,
  my,
}: {
  assemble: MotionValue<number>;
  fall: MotionValue<number>;
  pull: MotionValue<number>;
  turn: MotionValue<number>;
  arch: MotionValue<number>;
  swing: MotionValue<number>;
  perf: MotionValue<number>;
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
        <Rig pull={pull} turn={turn} arch={arch} swing={swing} perf={perf} />
        <Assembly
          assemble={assemble}
          fall={fall}
          pull={pull}
          arch={arch}
          perf={perf}
          swing={swing}
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
