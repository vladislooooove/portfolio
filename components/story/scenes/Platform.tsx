"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { roundedSlab, slabGlow, slabOutline } from "../system";

/**
 * The deck both models stand on: a pane of dark glass with a purple neon line
 * inset into its face. Shared, because the two chapters are the same room seen
 * twice and a different platform under each would say otherwise.
 *
 * Half transparent on purpose. The dot field carries on underneath it, which
 * is what stops the deck reading as a lid dropped over the ground.
 *
 * The line is a ribbon rather than a line. A GL line is one pixel wide whatever
 * width it is given, and one pixel of colour is a line, not a light; the glow
 * needs width to fall off across. A hard loop still runs down the middle of it
 * for the filament.
 *
 * It carries no animation of its own. Its materials are tagged for whichever
 * scene mounts it to fade, along with everything else that scene is fading.
 */

const GLOW_VERT = /* glsl */ `
  attribute float aCross;
  varying float vCross;

  void main() {
    vCross = aCross;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform vec3  uHot;
  uniform float uFade;

  varying float vCross;

  void main() {
    float across = 1.0 - abs(vCross);
    float halo = pow(across, 2.2);
    float core = pow(across, 9.0);
    gl_FragColor = vec4(mix(uColor, uHot, core), (halo * 0.55 + core * 0.9) * uFade);
  }
`;

export default function Platform({
  at,
  w,
  d,
  thick,
}: {
  at: [number, number, number];
  w: number;
  d: number;
  thick: number;
}) {
  const r = Math.min(w, d) * 0.1;
  const inset = Math.min(w, d) * 0.08;

  const slab = useMemo(() => roundedSlab(w, d, r, thick), [w, d, r, thick]);
  const glow = useMemo(() => slabGlow(w * 0.8, d * 0.76, inset, Math.min(w, d) * 0.022), [w, d, inset]);
  const filament = useMemo(() => slabOutline(w * 0.8, d * 0.76, inset), [w, d, inset]);

  useEffect(
    () => () => {
      slab.dispose();
      glow.dispose();
      filament.dispose();
    },
    [slab, glow, filament],
  );

  return (
    <group position={at}>
      <mesh geometry={slab}>
        <meshBasicMaterial
          color="#241c44"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          userData={{ fade: 0.55 }}
        />
      </mesh>

      <mesh geometry={glow} position={[0, thick / 2 + 0.005, 0]}>
        <shaderMaterial
          uniforms={{
            uColor: { value: new THREE.Color("#9333ea") },
            uHot: { value: new THREE.Color("#e9d5ff") },
            uFade: { value: 0 },
          }}
          vertexShader={GLOW_VERT}
          fragmentShader={GLOW_FRAG}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          userData={{ fade: 1 }}
        />
      </mesh>

      <lineLoop geometry={filament} position={[0, thick / 2 + 0.007, 0]}>
        <lineBasicMaterial
          color="#f0d5ff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          userData={{ fade: 0.85 }}
        />
      </lineLoop>
    </group>
  );
}
