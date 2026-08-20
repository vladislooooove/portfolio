"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useReducedMotionSafe } from "../useReducedMotionSafe";

/* Storytelling: one field runs behind all three projects and changes its
   turbulence as each one takes the screen, so the section reads as a single
   place you move through. Hue stays fixed, since the page has one accent. */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uTurb;
  uniform float uSeed;
  uniform float uAspect;
  uniform int   uOctaves;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

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
    for (int i = 0; i < 5; i++) {
      if (i >= uOctaves) break;
      v += a * noise(p);
      p *= 2.04;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
    vec2 q = uv * 1.7 + uSeed;
    float t = uTime * 0.05;

    vec2 warp = vec2(fbm(q + t), fbm(q + vec2(4.7, 1.9) - t));
    float f = fbm(q + warp * (0.85 + uTurb));

    float bands = sin((f * 6.5 + uv.x * 1.1 + t * 2.2) * 3.14159);
    float m = smoothstep(0.16, 0.94, f);

    vec3 deep = vec3(0.039, 0.027, 0.063);
    vec3 mid  = vec3(0.278, 0.149, 0.596);
    vec3 hot  = vec3(0.655, 0.545, 0.996);

    vec3 col = mix(deep, mid, m);
    col = mix(col, hot, smoothstep(0.58, 1.0, m) * 0.5 * (0.5 + 0.5 * bands));

    float vignette = smoothstep(1.3, 0.28, length(uv));
    col *= 0.34 + 0.66 * vignette;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function Quad({ turb, seed }: { turb: number; seed: number }) {
  const { viewport, size } = useThree();
  const material = useRef<THREE.ShaderMaterial>(null);
  const current = useRef({ turb, seed });

  const compact = size.width < 768;

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uTurb: { value: turb },
      uSeed: { value: seed },
      uAspect: { value: 1 },
      uOctaves: { value: 5 },
    }),
    // Uniform object is created once on purpose; values are driven per frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state, delta) => {
    const m = material.current;
    if (!m) return;
    const k = Math.min(1, delta * 1.6);
    current.current.turb += (turb - current.current.turb) * k;
    current.current.seed += (seed - current.current.seed) * k;

    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uTurb.value = current.current.turb;
    m.uniforms.uSeed.value = current.current.seed;
    m.uniforms.uAspect.value = size.width / Math.max(1, size.height);
    m.uniforms.uOctaves.value = compact ? 3 : 5;
  });

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </mesh>
  );
}

export default function ProjectField({ turb, seed }: { turb: number; seed: number }) {
  const reduce = useReducedMotionSafe();
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState(true);
  const host = useRef<HTMLDivElement>(null);

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
      rootMargin: "100px",
    });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} className="webgl-inert absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_30%_35%,rgba(139,92,246,0.26),rgba(10,7,16,1)_70%)]" />
      {ready && !reduce && (
        <Canvas
          frameloop={live ? "always" : "never"}
          dpr={[1, 1.35]}
          gl={{ antialias: false, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 5], fov: 45 }}
        >
          <Quad turb={turb} seed={seed} />
        </Canvas>
      )}
    </div>
  );
}
