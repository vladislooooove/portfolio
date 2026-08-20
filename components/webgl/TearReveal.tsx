"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMotionValueEvent } from "motion/react";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { useReducedMotionSafe } from "../useReducedMotionSafe";

/**
 * Storytelling: the hero holds, then the ground of the next section rises
 * through a torn opening rather than a ruled edge.
 *
 * This paints inside a pinned, viewport-sized stage. Living inside the
 * incoming section's own box is what clipped the mask at the section seam.
 *
 * Technique: a scroll-driven threshold compared against a gradient plus fBm
 * noise, resolved with a very tight smoothstep so the edge stays hard and
 * ragged. Written for this page; no shader source was copied.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uProgress;
  uniform float uTime;
  uniform float uAspect;
  uniform vec3 uColor;
  uniform vec3 uAccent;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 q = vec2(vUv.x * uAspect, vUv.y);

    // High frequency keeps the edge papery. Low frequency turns it into a blob.
    float coarse = fbm(q * 6.5 + vec2(uTime * 0.02, 0.0));
    float mid = fbm(q * 15.0 - vec2(0.0, uTime * 0.018));
    // Plain noise rather than a fourth octave stack. At this frequency the
    // extra octaves are below a pixel and only cost fill rate.
    float fine = noise(q * 34.0 + vec2(uTime * 0.01, uTime * 0.006));
    float n = clamp(
      0.5 + (coarse - 0.5) * 0.62 + (mid - 0.5) * 0.34 + (fine - 0.5) * 0.16,
      0.0, 1.0
    );

    float g = clamp(vUv.y + (vUv.x - 0.5) * 0.16, 0.0, 1.1);

    const float W = 1.45;
    float v = uProgress * (W * 1.1 + 1.15) - g * W - n - 0.04;

    float alpha = smoothstep(-0.010, 0.010, v);
    float edge = smoothstep(0.0, 0.012, v) - smoothstep(0.012, 0.055, v);

    // The bloom hugs the edge. A wide falloff trails so far behind the tear
    // that the incoming section's top can cut through the middle of it.
    float bloom = smoothstep(0.13, 0.01, v) * 0.20;
    vec3 col = mix(uColor, uAccent, clamp(edge, 0.0, 1.0) * 0.7 + bloom);
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * Raw ShaderMaterial output skips three's colour-space conversion, so a
 * THREE.Color (which is stored linear) lands on screen far too dark. These
 * colours have to reach the shader as plain sRGB components, or the painted
 * ground will not match the same hex in CSS.
 */
function srgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function Quad({ progress, color, accent }: { progress: MotionValue<number>; color: string; accent: string }) {
  const { viewport, size } = useThree();
  const material = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uColor: { value: srgb(color) },
      uAccent: { value: srgb(accent) },
    }),
    [color, accent],
  );

  useFrame((state) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uProgress.value = progress.get();
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uAspect.value = size.width / Math.max(1, size.height);
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export default function TearReveal({
  progress,
  color = "#14101f",
  accent = "#8b5cf6",
}: {
  progress: MotionValue<number>;
  color?: string;
  accent?: string;
}) {
  const reduce = useReducedMotionSafe();
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  /*
   * The shader is the most expensive thing on the page, and it only has to
   * draw while the tear is actually moving. At rest either nothing is painted
   * or the ground is flat, and the last drawn frame already says so, so the
   * loop can stop. This is worth roughly two thirds of the hero's dropped
   * frames.
   */
  useMotionValueEvent(progress, "change", (v) => {
    const should = v > 0.0005 && v < 0.9995;
    setBusy((current) => (current === should ? current : should));
  });

  useEffect(() => {
    try {
      const probe = document.createElement("canvas");
      setReady(Boolean(probe.getContext("webgl2") || probe.getContext("webgl")));
    } catch {
      setReady(false);
    }
  }, []);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const io = new IntersectionObserver(([entry]) => setLive(entry.isIntersecting), {
      rootMargin: "220px",
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // The host div always renders so the observer can attach on the first pass.
  // Returning early here left frameloop pinned to "never" and the canvas blank.
  return (
    <div ref={host} className="webgl-inert absolute inset-0">
      {reduce || !ready ? null : (
        <Canvas
          frameloop={live && busy ? "always" : "never"}
          dpr={1}
          gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
          camera={{ position: [0, 0, 5], fov: 45 }}
        >
          <Quad progress={progress} color={color} accent={accent} />
        </Canvas>
      )}
    </div>
  );
}
