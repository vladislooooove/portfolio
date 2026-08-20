"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { useReducedMotionSafe } from "../useReducedMotionSafe";
import { markSceneReady } from "@/lib/boot";

/* Storytelling: the field starts as a regular lattice and comes apart as you
   scroll, which is the same move the work section is about. Hierarchy: it
   brightens and parts around the pointer, so the hero answers to the reader. */

const VERT = /* glsl */ `
  uniform float uTime;
  uniform vec2  uMouse;
  uniform float uScatter;
  uniform float uSize;
  uniform float uRadius;
  attribute float aSeed;
  varying float vHeat;

  void main() {
    vec3 pos = position;

    float n1 = sin(pos.x * 1.35 + uTime * 0.42 + aSeed * 6.2831);
    float n2 = cos(pos.y * 1.72 - uTime * 0.36 + aSeed * 3.1415);

    pos.x += n1 * 0.30 * uScatter;
    pos.y += n2 * 0.30 * uScatter;
    pos.z += (n1 + n2) * 0.55 * uScatter;

    vec2 away = pos.xy - uMouse;
    float dist = length(away);
    float push = smoothstep(uRadius, 0.0, dist);
    pos.xy += normalize(away + vec2(0.0001)) * push * uRadius * 0.42;
    pos.z += push * 0.55;

    // A slow wave crosses the lattice so it is alive before anyone touches it.
    float w1 = 0.5 + 0.5 * sin(pos.x * 0.40 + pos.y * 0.24 - uTime * 0.7);
    float w2 = 0.5 + 0.5 * sin(pos.x * 0.13 - pos.y * 0.19 + uTime * 0.32);
    float wave = pow(w1 * 0.65 + w2 * 0.35, 2.0);
    vHeat = clamp(push * 1.2 + uScatter * 0.4 + wave * 0.95 + abs(n1) * 0.08, 0.0, 1.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * (0.55 + vHeat * 0.9 + push * 2.0) * (1.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uHot;
  varying float vHeat;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float mask = smoothstep(0.5, 0.08, d);
    if (mask < 0.01) discard;
    vec3 col = mix(uCool, uHot, vHeat);
    gl_FragColor = vec4(col, mask * (0.20 + vHeat * 0.80));
  }
`;

function Field({
  mx,
  my,
  progress,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  progress: MotionValue<number>;
}) {
  const { viewport } = useThree();
  const material = useRef<THREE.ShaderMaterial>(null);
  const eased = useRef(new THREE.Vector2(40, 40));

  const compact = viewport.width < 6;

  const geometry = useMemo(() => {
    const w = viewport.width * 1.35;
    const h = viewport.height * 1.35;
    const target = compact ? 3600 : 8200;
    const cols = Math.max(2, Math.round(Math.sqrt((target * w) / h)));
    const rows = Math.max(2, Math.round(target / cols));

    const position = new Float32Array(cols * rows * 3);
    const seed = new Float32Array(cols * rows);

    let i = 0;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        position[i * 3] = (x / (cols - 1) - 0.5) * w;
        position[i * 3 + 1] = (y / (rows - 1) - 0.5) * h;
        position[i * 3 + 2] = 0;
        seed[i] = Math.random();
        i++;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [viewport.width, viewport.height, compact]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(40, 40) },
      uScatter: { value: 0 },
      uSize: { value: 10 },
      uRadius: { value: 1.15 },
      uCool: { value: new THREE.Color("#6d4de0") },
      uHot: { value: new THREE.Color("#cbb8ff") },
    }),
    [],
  );

  const announced = useRef(false);

  useFrame((state, delta) => {
    const m = material.current;
    if (!m) return;

    if (!announced.current) {
      announced.current = true;
      markSceneReady();
    }

    const targetX = (mx.get() * viewport.width) / 2;
    const targetY = (my.get() * viewport.height) / 2;
    const k = Math.min(1, delta * 3.6);
    eased.current.x += (targetX - eased.current.x) * k;
    eased.current.y += (targetY - eased.current.y) * k;

    m.uniforms.uMouse.value.copy(eased.current);
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uScatter.value = progress.get();
    m.uniforms.uSize.value = (compact ? 16 : 24) * state.viewport.dpr;
    m.uniforms.uRadius.value = compact ? 0.8 : 1.25;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function Lattice({
  mx,
  my,
  progress,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  progress: MotionValue<number>;
}) {
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

  // Stop rendering frames once the hero leaves the screen.
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
    <div ref={host} className="webgl-inert pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      {/* Fallback that also sits under the canvas, so the hero never renders bare. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_18%,rgba(139,92,246,0.30),transparent_62%)]" />
      <div className="lattice absolute inset-0 opacity-40" />
      {ready && !reduce && (
        <Canvas
          frameloop={live ? "always" : "never"}
          dpr={[1, 1.75]}
          gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: [0, 0, 6], fov: 45 }}
        >
          <Field mx={mx} my={my} progress={progress} />
        </Canvas>
      )}
      {/* Clears the ground under the small copy at the foot of the hero so
          16px text is not competing with the field. */}
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(10_7_16)_0%,rgb(10_7_16/0.86)_14%,rgb(10_7_16/0.38)_42%,transparent_72%)]" />
    </div>
  );
}
