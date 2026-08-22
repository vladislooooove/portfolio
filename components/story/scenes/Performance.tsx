"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { measure, settled } from "../laptop";
import { WOUND, boxShell, cellOf, modelOf, shellSlots, spinOf, windAbout } from "../system";
import { createDashboard } from "../dashboard";
import Platform from "./Platform";

/**
 * Scene 5. The system comes apart and rebuilds as the thing you watch a system
 * with: a monitor on a plate, and columns that rise in front of it one after
 * another.
 *
 * The cubes do not have to be worked out again. Every one of them is parked on
 * a shell cell of one of the seven volumes, and that set is exactly where this
 * scene starts from, so the model comes apart into the pieces it was built out
 * of rather than into a fresh cloud that merely resembles them.
 *
 * The columns are the one thing the cubes do not build. Arriving with
 * everything else, growing would be a second animation played over an object
 * that is already there; rising out of an empty plate is the measurement
 * happening. They go up in order, and the chart on the screen behind them
 * fills in step.
 */

const BOUNCE = /* glsl */ `
  float bounceOut(float t) {
    const float n = 7.5625;
    const float d = 2.75;
    if (t < 1.0 / d) return n * t * t;
    if (t < 2.0 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
    if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
    t -= 2.625 / d;
    return n * t * t + 0.984375;
  }

  mat3 spin(vec3 axis, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    float k = 1.0 - c;
    vec3 a = normalize(axis);
    return mat3(
      a.x * a.x * k + c,       a.y * a.x * k + a.z * s, a.z * a.x * k - a.y * s,
      a.x * a.y * k - a.z * s, a.y * a.y * k + c,       a.z * a.y * k + a.x * s,
      a.x * a.z * k + a.y * s, a.y * a.z * k - a.x * s, a.z * a.z * k + c
    );
  }
`;

const CUBE_VERT = /* glsl */ `
  ${BOUNCE}

  uniform float uPhase;

  attribute vec3  aFrom;
  attribute vec3  aLand;
  attribute vec3  aSlot;
  attribute float aSeed;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float drop = clamp((uPhase - 0.04 - aSeed * 0.14) / 0.26, 0.0, 1.0);
    vec3 down = mix(aFrom, aLand, drop * drop * (3.0 - 2.0 * drop));
    down.y = aLand.y + (aFrom.y - aLand.y) * (1.0 - bounceOut(drop));

    float rise = clamp((uPhase - 0.34 - aSeed * 0.12) / 0.24, 0.0, 1.0);
    float re = rise * rise * (3.0 - 2.0 * rise);
    vec3 centre = mix(down, aSlot, re);
    centre.y += sin(re * 3.14159) * (0.5 + aSeed * 1.1);

    float angle = drop * (2.4 + aSeed * 4.0) * (1.0 - re);
    mat3 turn = spin(vec3(aSeed - 0.5, 0.4, 0.75 - aSeed), angle);

    vec3 world = centre + turn * position;
    vec3 n = turn * normal;
    float lit = 0.34 + 0.58 * clamp(dot(n, normalize(vec3(-0.42, 0.86, 0.48))), 0.0, 1.0);

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vec3 nv = normalize(normalMatrix * n);
    float rim = pow(1.0 - abs(dot(nv, normalize(-mv.xyz))), 2.5);
    vColor = vec3(0.34, 0.13, 0.74) * lit + vec3(0.72, 0.24, 1.0) * rim * 0.95;

    vAlpha = smoothstep(0.0, 0.04, uPhase) * (1.0 - smoothstep(0.70, 0.80, uPhase));
    gl_Position = projectionMatrix * mv;
  }
`;

const CUBE_FRAG = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.004) discard;
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;

/** Same face shading as the system's volumes, so the two chapters match. */
const SOLID_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocal;

  void main() {
    vNormal = normal;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SOLID_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform vec3  uHot;
  uniform float uLift;
  uniform float uFade;

  varying vec3 vNormal;
  varying vec3 vLocal;

  void main() {
    vec3 n = normalize(vNormal);
    float top = max(n.y, 0.0);
    float lit = max(dot(n, normalize(vec3(-0.75, 0.0, 0.66))), 0.0);
    vec3 col = uColor * (0.42 + top * 0.72 + lit * 0.3) + uHot * top * uLift;
    gl_FragColor = vec4(col, uFade);
  }
`;

const span = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
const smoother = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** The four, and how tall each one gets. Unlabelled: see dashboard.ts. */
const BARS = [0.34, 0.52, 0.72, 1];

export default function Performance({
  plane,
  perf,
}: {
  plane: { w: number; h: number };
  /** 0 to 1 across scene 5. */
  perf: MotionValue<number>;
}) {
  const shell = useRef<THREE.Group>(null);
  const cubes = useRef<THREE.ShaderMaterial>(null);
  const bars = useRef<(THREE.Group | null)[]>([]);
  const rig = useRef<THREE.Group>(null);
  const painted = useRef(-1);

  const M = useMemo(() => measure(plane.w, plane.h), [plane.w, plane.h]);
  const frame = useMemo(() => settled(M), [M]);
  const cell = useMemo(() => cellOf(M), [M]);

  /**
   * Everything on the deck, in world units off the laptop's own scale. The
   * deck is the same size as the system's, because it is the same deck.
   *
   * A monitor is a bezel with a panel inset in it, a neck and a foot. Built as
   * one slab with a picture stuck to the front it reads as a signboard, which
   * is what the first pass was.
   */
  const rigSpec = useMemo(() => {
    const U = M.lidW;
    const y = frame.groundY;
    const z = frame.base.z;
    const bezel = U * 0.014;
    const screenW = U * 0.46;
    const screenH = screenW / 1.6;
    return {
      plate: { w: U * 0.98, h: U * 0.024, d: U * 0.84, at: new THREE.Vector3(0, y + U * 0.012, z) },
      case: {
        w: screenW + bezel * 2,
        h: screenH + bezel * 2 + U * 0.016,
        d: U * 0.02,
        at: new THREE.Vector3(0, y + U * 0.31, z - U * 0.2),
      },
      screen: { w: screenW, h: screenH, at: new THREE.Vector3(0, y + U * 0.318, z - U * 0.2) },
      neck: { w: U * 0.042, h: U * 0.09, d: U * 0.026, at: new THREE.Vector3(0, y + U * 0.13, z - U * 0.2) },
      foot: { w: U * 0.17, d: U * 0.085, h: U * 0.014, at: new THREE.Vector3(0, y + U * 0.031, z - U * 0.2) },
      bar: { w: U * 0.062, d: U * 0.062, tall: U * 0.34, gap: U * 0.092, z: z + U * 0.14, x: -U * 0.138 },
    };
  }, [M, frame]);

  /** The cubes: from the system's shell cells, onto the new one's. */
  const build = useMemo(() => {
    /**
     * Where the cubes start: the cells of the system, turned by however far
     * each of its volumes had turned by the time this chapter takes over.
     *
     * With the z the system was standing at, too. Without it the cubes started
     * a laptop's depth away from the model they were supposed to be leaving,
     * and the two sat side by side for the whole handover.
     */
    const system = modelOf(M, frame.groundY, frame.base.z);
    const shell = shellSlots(system.nodes, cell);
    const count = shell.slots.length / 3;
    const from = new Float32Array(count * 3);
    const cell3 = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      cell3.set(shell.slots[i * 3], shell.slots[i * 3 + 1], shell.slots[i * 3 + 2]);
      const owner = shell.owner[i];
      windAbout(cell3, system.nodes[owner].at, WOUND * spinOf(owner));
      from[i * 3] = cell3.x;
      from[i * 3 + 1] = cell3.y;
      from[i * 3 + 2] = cell3.z;
    }

    const targets: number[] = [];
    const { plate, case: shellCase, neck, foot } = rigSpec;
    boxShell(plate.w, plate.h, plate.d, cell, targets, plate.at, true);
    boxShell(shellCase.w, shellCase.h, shellCase.d, cell, targets, shellCase.at);
    boxShell(neck.w, neck.h, neck.d, cell, targets, neck.at);
    boxShell(foot.w, foot.h, foot.d, cell, targets, foot.at);

    const land = new Float32Array(count * 3);
    const slot = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const total = targets.length / 3;

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * M.lidW * 0.9;
      land[i * 3] = Math.cos(a) * r;
      land[i * 3 + 1] = frame.groundY + cell * 0.5;
      land[i * 3 + 2] = Math.sin(a) * r + frame.base.z;
      seed[i] = Math.random();

      const t = (i % total) * 3;
      slot[i * 3] = targets[t];
      slot[i * 3 + 1] = targets[t + 1];
      slot[i * 3 + 2] = targets[t + 2];
    }

    const box = new THREE.BoxGeometry(cell * 0.82, cell * 0.82, cell * 0.82);
    const g = new THREE.InstancedBufferGeometry();
    g.index = box.index;
    g.setAttribute("position", box.getAttribute("position"));
    g.setAttribute("normal", box.getAttribute("normal"));
    g.setAttribute("aFrom", new THREE.InstancedBufferAttribute(from, 3));
    g.setAttribute("aLand", new THREE.InstancedBufferAttribute(land, 3));
    g.setAttribute("aSlot", new THREE.InstancedBufferAttribute(slot, 3));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.instanceCount = count;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), M.lidW * 3);
    return g;
  }, [M, frame, cell, rigSpec]);

  useEffect(() => () => build.dispose(), [build]);

  /** Anchored at its foot, so scaling y grows it out of the plate. */
  const column = useMemo(() => {
    const g = new THREE.BoxGeometry(rigSpec.bar.w, rigSpec.bar.tall, rigSpec.bar.d);
    g.translate(0, rigSpec.bar.tall / 2, 0);
    return g;
  }, [rigSpec]);

  useEffect(() => () => column.dispose(), [column]);

  const board = useMemo(() => createDashboard(), []);
  const screen = useMemo(() => {
    const t = new THREE.CanvasTexture(board.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [board]);

  useEffect(() => () => screen.dispose(), [screen]);

  useFrame(() => {
    const p = perf.get();
    if (cubes.current) cubes.current.uniforms.uPhase.value = p;

    // Not before the swarm has finished arriving. Coming up while cubes were
    // still on the floor, the model looked like a second, smaller scene
    // growing out from under the first.
    const solid = smoother(span(p, 0.72, 0.82));
    if (rig.current) {
      rig.current.visible = solid > 0.002;
      rig.current.traverse((object) => {
        const material = (object as THREE.Mesh).material as
          | (THREE.Material & { uniforms?: Record<string, { value: number }> })
          | undefined;
        const weight = material?.userData?.fade;
        if (!material || Array.isArray(material) || weight === undefined) return;
        if (material.uniforms?.uFade) material.uniforms.uFade.value = solid * weight;
        else material.opacity = solid * weight;
        if (material.userData.solid) material.depthWrite = solid > 0.5;
      });
    }
    if (shell.current) shell.current.visible = p > 0.0005;

    // One after another, left to right, each on its own slice of the run.
    const grown = span(p, 0.82, 0.98);
    bars.current.forEach((group, i) => {
      if (!group) return;
      const share = smoother(span(grown, i * 0.19, i * 0.19 + 0.43));
      group.scale.y = Math.max(0.0001, share * BARS[i]);
    });

    // The chart behind them keeps step. Quantised, so a scroll frame that
    // moves nothing does not repaint the canvas.
    const step = Math.round(grown * 90);
    if (step !== painted.current) {
      painted.current = step;
      board.draw(step / 90);
      screen.needsUpdate = true;
    }
  });

  const solidMat = (colour: string, hot: string, lift: number) => (
    <shaderMaterial
      uniforms={{
        uColor: { value: new THREE.Color(colour) },
        uHot: { value: new THREE.Color(hot) },
        uLift: { value: lift },
        uFade: { value: 0 },
      }}
      vertexShader={SOLID_VERT}
      fragmentShader={SOLID_FRAG}
      transparent
      depthWrite={false}
      userData={{ fade: 1, solid: true }}
    />
  );

  return (
    <group ref={shell} visible={false}>
      <mesh geometry={build} frustumCulled={false}>
        <shaderMaterial
          ref={cubes}
          uniforms={{ uPhase: { value: 0 } }}
          vertexShader={CUBE_VERT}
          fragmentShader={CUBE_FRAG}
          transparent
          depthWrite={false}
        />
      </mesh>

      <group ref={rig} visible={false}>
        <Platform
          at={rigSpec.plate.at.toArray() as [number, number, number]}
          w={rigSpec.plate.w}
          d={rigSpec.plate.d}
          thick={rigSpec.plate.h}
        />

        <mesh position={rigSpec.case.at.toArray()}>
          <boxGeometry args={[rigSpec.case.w, rigSpec.case.h, rigSpec.case.d]} />
          {solidMat("#191430", "#6d4ec7", 0.14)}
        </mesh>
        <mesh
          position={[
            rigSpec.screen.at.x,
            rigSpec.screen.at.y,
            rigSpec.screen.at.z + rigSpec.case.d / 2 + 0.004,
          ]}
        >
          <planeGeometry args={[rigSpec.screen.w, rigSpec.screen.h]} />
          <meshBasicMaterial
            map={screen}
            toneMapped={false}
            transparent
            opacity={0}
            depthWrite={false}
            userData={{ fade: 1 }}
          />
        </mesh>

        <mesh position={rigSpec.neck.at.toArray()}>
          <boxGeometry args={[rigSpec.neck.w, rigSpec.neck.h, rigSpec.neck.d]} />
          {solidMat("#241d3d", "#7c5cf0", 0.24)}
        </mesh>
        <mesh position={rigSpec.foot.at.toArray()}>
          <boxGeometry args={[rigSpec.foot.w, rigSpec.foot.h, rigSpec.foot.d]} />
          {solidMat("#241d3d", "#7c5cf0", 0.3)}
        </mesh>

        {BARS.map((_, i) => (
          <group
            key={i}
            position={[
              rigSpec.bar.x + i * rigSpec.bar.gap,
              rigSpec.plate.at.y + rigSpec.plate.h / 2,
              rigSpec.bar.z,
            ]}
            ref={(g) => {
              bars.current[i] = g;
            }}
          >
            <mesh geometry={column}>{solidMat("#8b5cf6", "#f0dcff", 0.6)}</mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
