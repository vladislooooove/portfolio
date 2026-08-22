"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { measure, settled } from "../laptop";
import type { EditorSurface } from "../editor-surface";

/**
 * Scene 4. The laptop comes apart into the cubes it was made of, they fall to
 * the ground, and they gather back up into a system: one core with six
 * services around it, wired together and passing signals.
 *
 * The cubes are the laptop before they are anything else. Every one of them is
 * a cell of the lid or the base, at the size and place it occupied, and the
 * ones on the face of the lid carry the pixels of the file that was typed into
 * it. So the object is seen to be made of parts before it is seen to come
 * apart, which is the same move the editor made in scene 1 and the reason the
 * shatter reads as the thing itself rather than as an effect played over it.
 *
 * What it means: the core is the shell, the six around it are the domain
 * front ends, and the signals are the contract between them. The scene is a
 * sentence about architecture, not a pattern that happens to look technical.
 *
 * Every position is a pure function of scroll, including the bounce, so
 * scrubbing backwards runs it backwards. Only the signals and the slow turn of
 * the cubes are on the clock, because those carry on while the reader sits
 * still.
 */

/** Standard ease-out bounce, which is the whole of the landing. */
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
  attribute vec3  aTint;
  attribute float aSeed;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // Falling, staggered, and landing on a bounce.
    float drop = clamp((uPhase - 0.10 - aSeed * 0.16) / 0.30, 0.0, 1.0);
    vec3 down = mix(aFrom, aLand, drop * drop * (3.0 - 2.0 * drop));
    down.y = aLand.y + (aFrom.y - aLand.y) * (1.0 - bounceOut(drop));

    // Gathering, staggered the other way so the core fills first.
    float rise = clamp((uPhase - 0.46 - aSeed * 0.14) / 0.28, 0.0, 1.0);
    float re = rise * rise * (3.0 - 2.0 * rise);
    vec3 centre = mix(down, aSlot, re);
    centre.y += sin(re * 3.14159) * (0.5 + aSeed * 1.1);

    // Tumbling on the way down, and squared up again as it takes its place.
    float angle = drop * (2.4 + aSeed * 4.0) * (1.0 - re);
    mat3 turn = spin(vec3(aSeed - 0.5, 0.4, 0.75 - aSeed), angle);

    vec3 local = turn * position;
    vec3 world = centre + local;

    vec3 n = turn * normal;
    float lit = 0.34 + 0.58 * clamp(dot(n, normalize(vec3(-0.42, 0.86, 0.48))), 0.0, 1.0);

    // A rim that lights up as a face turns away, which at this size is what
    // makes a chip of a laptop read as a lit piece of glass rather than as a
    // grey speck.
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vec3 nv = normalize(normalMatrix * n);
    float rim = pow(1.0 - abs(dot(nv, normalize(-mv.xyz))), 2.5);
    vColor = aTint * lit + vec3(0.72, 0.24, 1.0) * rim * 0.95;

    // In as the laptop goes, out as the glass comes up through them.
    vAlpha = smoothstep(0.0, 0.07, uPhase) * (1.0 - smoothstep(0.72, 0.88, uPhase));

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

/**
 * The glass.
 *
 * Shaded off the face normal rather than off the view: a cube in an isometric
 * reads as a cube because its top is bright, one side is mid and the other is
 * dark, and nothing else does that job. Lit only at the rim, which is what
 * this was, every volume came out as an outline with nothing inside it and
 * seven of them together came out as wire.
 */
const GLASS_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vLocal;

  void main() {
    vNormal = normal;
    vLocal = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const GLASS_FRAG = /* glsl */ `
  uniform vec3  uColor;
  uniform vec3  uHot;
  uniform float uFade;
  uniform float uCore;
  uniform float uHalf;
  uniform float uAlpha;

  varying vec3 vNormal;
  varying vec3 vLocal;

  void main() {
    vec3 n = normalize(vNormal);
    float top = max(n.y, 0.0);
    float lit = max(dot(n, normalize(vec3(-0.75, 0.0, 0.66))), 0.0);
    float tone = 0.30 + top * 0.66 + lit * 0.24;

    // Light gathered at the top corner nearest the lens, which is the one
    // thing in the reference that says these are lit and not painted.
    vec3 corner = vec3(-uHalf, uHalf, uHalf);
    float d = distance(vLocal, corner) / uHalf;
    float flare = exp(-d * d * 2.8);

    vec3 col = uColor * tone + uHot * flare * (0.34 + uCore * 0.72);
    gl_FragColor = vec4(col, uAlpha);
  }
`;

const SIGNAL_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uSize;

  attribute vec3  aTail;
  attribute vec3  aHead;
  attribute float aOffset;
  attribute float aRate;

  varying float vAlpha;

  void main() {
    float t = fract(uTime * aRate + aOffset);
    vec3 p = mix(aTail, aHead, t);

    // Fades in off the pad and out as it arrives, so the run has ends.
    vAlpha = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.86, 1.0, t)) * uFade;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize / max(-mv.z, 0.0001);
    gl_Position = projectionMatrix * mv;
  }
`;

const SIGNAL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float mask = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
    if (mask * vAlpha < 0.01) discard;
    gl_FragColor = vec4(uColor, mask * vAlpha);
  }
`;

const span = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
const smoother = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export default function Architecture({
  surface,
  plane,
  arch,
}: {
  surface: EditorSurface;
  plane: { w: number; h: number };
  /** 0 to 1 across scene 4. */
  arch: MotionValue<number>;
}) {
  const cubes = useRef<THREE.ShaderMaterial>(null);
  const signals = useRef<THREE.ShaderMaterial>(null);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  const wires = useRef<THREE.LineBasicMaterial>(null);
  const plate = useRef<THREE.LineBasicMaterial>(null);
  const tinted = useRef(false);
  const shell = useRef<THREE.Group>(null);

  const M = useMemo(() => measure(plane.w, plane.h), [plane.w, plane.h]);
  const frame = useMemo(() => settled(M), [M]);

  /**
   * The seven volumes: a core with one neighbour out along each axis. Six is
   * what an octahedron gives you and what the arrangement reads as at this
   * angle, one behind each shoulder and one over and under.
   */
  const model = useMemo(() => {
    const edge = M.lidW * 0.30;
    const sat = edge * 0.6;
    // Clear of the core by more than half its own width. Closer than this and
    // the two on the vertical axis sit behind it at this angle and read as
    // slivers rather than as neighbours.
    const reach = edge * 1.5;
    const origin = new THREE.Vector3(0, frame.groundY + M.lidW * 0.46, 0);
    const dirs = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    return {
      origin,
      edge,
      sat,
      nodes: [
        { at: origin.clone(), size: edge, core: true },
        ...dirs.map((d) => ({
          at: origin.clone().add(new THREE.Vector3(d[0], d[1], d[2]).multiplyScalar(reach)),
          size: sat,
          core: false,
        })),
      ],
    };
  }, [M, frame]);

  /**
   * Every cell of the lid and of the base, where it starts, where it lands and
   * which cell of which volume it ends up as. The two grids are built in their
   * own frames and brought into this one, which is cheaper and exact where a
   * grid over the whole bounding box plus an inside test would be neither.
   */
  const build = useMemo(() => {
    const cell = M.lidW / 68;
    const from: number[] = [];
    const uv: number[] = [];

    const lidX = Math.round(M.lidW / cell);
    const lidY = Math.round(M.lidH / cell);
    for (let i = 0; i < lidX; i++) {
      for (let j = 0; j < lidY; j++) {
        const x = (i + 0.5 - lidX / 2) * cell;
        const y = (j + 0.5 - lidY / 2) * cell;
        const p = new THREE.Vector3(x, M.lidCY + y, -M.lidT / 2).applyMatrix4(frame.turn);
        from.push(p.x, p.y, p.z);
        // Where this cell sits on the screen, if it sits on the screen at all.
        uv.push(x / plane.w + 0.5, 0.5 - y / plane.h);
      }
    }

    const baseX = Math.round(M.lidW / cell);
    const baseZ = Math.round(M.baseD / cell);
    for (let i = 0; i < baseX; i++) {
      for (let j = 0; j < baseZ; j++) {
        const x = (i + 0.5 - baseX / 2) * cell;
        const z = (j + 0.5 - baseZ / 2) * cell;
        from.push(frame.base.x + x, frame.base.y, frame.base.z + z);
        uv.push(-1, -1);
      }
    }

    const count = from.length / 3;

    // Where they land: scattered over the ground the laptop was standing on.
    const land = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * M.lidW * 0.95;
      land[i * 3] = Math.cos(a) * r;
      land[i * 3 + 1] = frame.groundY + cell * 0.5;
      land[i * 3 + 2] = Math.sin(a) * r + frame.base.z * 0.3;
      seed[i] = Math.random();
    }

    // And the cell of the model each one becomes.
    // Shells, not solids. A cube packed all the way through spends most of
    // its cells where nobody can see them, and there are only so many cells to
    // spend: the same count laid over the six faces reads as a cube built out
    // of blocks instead of as a cloud that is roughly cubic.
    const slots: number[] = [];
    for (const node of model.nodes) {
      const n = Math.max(3, Math.round(node.size / cell));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          for (let k = 0; k < n; k++) {
            const face =
              i === 0 || i === n - 1 || j === 0 || j === n - 1 || k === 0 || k === n - 1;
            if (!face) continue;
            slots.push(
              node.at.x + (i + 0.5 - n / 2) * cell,
              node.at.y + (j + 0.5 - n / 2) * cell,
              node.at.z + (k + 0.5 - n / 2) * cell,
            );
          }
        }
      }
    }
    for (let i = slots.length / 3 - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      for (let c = 0; c < 3; c++) {
        const t = slots[i * 3 + c];
        slots[i * 3 + c] = slots[j * 3 + c];
        slots[j * 3 + c] = t;
      }
    }

    const slot = new Float32Array(count * 3);
    const total = slots.length / 3;
    for (let i = 0; i < count; i++) {
      const s = (i % total) * 3;
      slot[i * 3] = slots[s];
      slot[i * 3 + 1] = slots[s + 1];
      slot[i * 3 + 2] = slots[s + 2];
    }

    const box = new THREE.BoxGeometry(cell * 0.82, cell * 0.82, cell * 0.82);
    const g = new THREE.InstancedBufferGeometry();
    g.index = box.index;
    g.setAttribute("position", box.getAttribute("position"));
    g.setAttribute("normal", box.getAttribute("normal"));
    g.setAttribute("aFrom", new THREE.InstancedBufferAttribute(new Float32Array(from), 3));
    g.setAttribute("aLand", new THREE.InstancedBufferAttribute(land, 3));
    g.setAttribute("aSlot", new THREE.InstancedBufferAttribute(slot, 3));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.setAttribute(
      "aTint",
      new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0.4), 3),
    );
    g.instanceCount = count;
    // The box is not disposed. Its position and normal attributes are the ones
    // just handed to the instanced geometry, and disposing it frees their GPU
    // buffers out from under the thing that borrowed them.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), M.lidW * 3);

    return { geometry: g, count, uv, cell };
  }, [M, frame, model, plane.w, plane.h]);

  useEffect(() => () => build.geometry.dispose(), [build]);

  /** The wires between the core and the rest, and the pulses that run them. */
  const links = useMemo(() => {
    const line: number[] = [];
    const tail: number[] = [];
    const head: number[] = [];
    const offset: number[] = [];
    const rate: number[] = [];

    model.nodes.slice(1).forEach((node) => {
      const a = model.nodes[0].at;
      const b = node.at;
      line.push(a.x, a.y, a.z, b.x, b.y, b.z);
      // Two pulses per wire, one each way, out of step with each other.
      for (let k = 0; k < 2; k++) {
        const out = k === 0;
        tail.push(out ? a.x : b.x, out ? a.y : b.y, out ? a.z : b.z);
        head.push(out ? b.x : a.x, out ? b.y : a.y, out ? b.z : a.z);
        offset.push(Math.random());
        rate.push(0.18 + Math.random() * 0.16);
      }
    });

    const wire = new THREE.BufferGeometry();
    wire.setAttribute("position", new THREE.BufferAttribute(new Float32Array(line), 3));

    const pulse = new THREE.BufferGeometry();
    pulse.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tail.length), 3));
    pulse.setAttribute("aTail", new THREE.BufferAttribute(new Float32Array(tail), 3));
    pulse.setAttribute("aHead", new THREE.BufferAttribute(new Float32Array(head), 3));
    pulse.setAttribute("aOffset", new THREE.BufferAttribute(new Float32Array(offset), 1));
    pulse.setAttribute("aRate", new THREE.BufferAttribute(new Float32Array(rate), 1));

    return { wire, pulse };
  }, [model]);

  useEffect(
    () => () => {
      links.wire.dispose();
      links.pulse.dispose();
    },
    [links],
  );

  /** The outline on the ground the whole thing stands over. */
  const plateGeometry = useMemo(() => {
    const half = M.lidW * 0.46;
    const r = half * 0.16;
    const shape = new THREE.Shape();
    shape.moveTo(-half + r, -half);
    shape.lineTo(half - r, -half);
    shape.quadraticCurveTo(half, -half, half, -half + r);
    shape.lineTo(half, half - r);
    shape.quadraticCurveTo(half, half, half - r, half);
    shape.lineTo(-half + r, half);
    shape.quadraticCurveTo(-half, half, -half, half - r);
    shape.lineTo(-half, -half + r);
    shape.quadraticCurveTo(-half, -half, -half + r, -half);
    const pts = shape.getPoints(64).map((p) => new THREE.Vector3(p.x, 0, p.y));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [M]);

  useEffect(() => () => plateGeometry.dispose(), [plateGeometry]);

  /**
   * What a volume is drawn with. The reference's look is carried by the edges
   * and the lit points at the corners far more than by the fill, so each one
   * gets its wireframe, a point at every vertex, and a star from the middle of
   * its top face out to that face's corners.
   */
  const parts = useMemo(() => {
    const bits = (size: number) => {
      const h = size / 2;
      const corners = [0, h, 0, 0, 0, h, -h, 0, 0, h, 0, 0, 0, 0, -h];

      const rays: number[] = [];
      for (const x of [-h, h]) for (const z of [-h, h]) rays.push(0, h, 0, x, h, z);

      const box = new THREE.BoxGeometry(size, size, size);
      const dots = new THREE.BufferGeometry();
      dots.setAttribute("position", new THREE.BufferAttribute(new Float32Array(corners), 3));
      const star = new THREE.BufferGeometry();
      star.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rays), 3));

      return { box, edges: new THREE.EdgesGeometry(box), dots, star };
    };
    const inner = new THREE.BoxGeometry(model.edge * 0.52, model.edge * 0.52, model.edge * 0.52);
    return {
      big: bits(model.edge),
      small: bits(model.sat),
      core: inner,
      coreEdges: new THREE.EdgesGeometry(inner),
    };
  }, [model]);

  useEffect(
    () => () => {
      [parts.big, parts.small].forEach((b) => {
        b.box.dispose();
        b.edges.dispose();
        b.dots.dispose();
        b.star.dispose();
      });
      parts.core.dispose();
      parts.coreEdges.dispose();
    },
    [parts],
  );

  const cubeUniforms = useMemo(() => ({ uPhase: { value: 0 } }), []);
  const signalUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uFade: { value: 0 },
      uSize: { value: 90 },
      uColor: { value: new THREE.Color("#e9d5ff") },
    }),
    [],
  );

  useFrame((state) => {
    const p = arch.get();

    // Through the material, not through the object the JSX was handed: r3f
    // does not keep that object, so mutating it writes to nothing. Every other
    // shader in this sequence reaches its uniforms the same way.
    if (cubes.current) cubes.current.uniforms.uPhase.value = p;

    /**
     * The cells on the face of the lid take the colour of the pixel they were
     * covering. Read once, the first time the scene is asked for, because by
     * then the file has finished being typed; reading at build time would
     * scatter an empty editor across the floor.
     */
    if (!tinted.current && p > 0.001) {
      tinted.current = true;
      const ctx = surface.canvas.getContext("2d");
      const tint = build.geometry.getAttribute("aTint") as THREE.InstancedBufferAttribute;
      if (ctx) {
        const image = ctx.getImageData(0, 0, surface.width, surface.height).data;
        for (let i = 0; i < build.count; i++) {
          const u = build.uv[i * 2];
          const v = build.uv[i * 2 + 1];
          if (u < 0 || u > 1 || v < 0 || v > 1) {
            tint.setXYZ(i, 0.34, 0.13, 0.74);
            continue;
          }
          const x = Math.min(surface.width - 1, Math.floor(u * surface.width));
          const y = Math.min(surface.height - 1, Math.floor(v * surface.height));
          const q = (y * surface.width + x) * 4;
          // Lifted off black, because a screen that is mostly dark scatters
          // mostly black cubes and the floor is already dark, but pulled well
          // back toward the violet the rest of the sequence is in. Straight
          // screen colour came out as pale grey confetti.
          tint.setXYZ(
            i,
            Math.min(1, 0.2 + (image[q] / 255) * 0.62),
            Math.min(1, 0.07 + (image[q + 1] / 255) * 0.44),
            Math.min(1, 0.46 + (image[q + 2] / 255) * 0.7),
          );
        }
      }
      tint.needsUpdate = true;
    }

    // Everything the model is made of carries its own weight in userData and
    // is driven in one sweep. Reaching each of thirty odd materials by its own
    // ref is how one of them ends up never being reached at all, which is
    // exactly what happened to the six outer wireframes.
    const shown = smoother(span(p, 0.74, 0.9));
    shell.current?.traverse((object) => {
      const material = (object as THREE.Mesh).material as
        | (THREE.Material & { uniforms?: Record<string, { value: number }> })
        | undefined;
      const weight = material?.userData?.fade;
      if (!material || Array.isArray(material) || weight === undefined) return;
      if (material.uniforms?.uFade) material.uniforms.uFade.value = shown * weight;
      else material.opacity = shown * weight;
    });
    if (plate.current) plate.current.opacity = smoother(span(p, 0.5, 0.8)) * 0.5;

    if (signals.current) {
      signals.current.uniforms.uTime.value = state.clock.elapsedTime;
      signals.current.uniforms.uFade.value = shown;
      signals.current.uniforms.uSize.value = 90 * state.viewport.dpr;
    }

    /**
     * The volumes grow into place rather than fading in, and they are opaque
     * while they do it.
     *
     * Seven translucent boxes overlapping each other is a sorting problem with
     * no good answer: whichever order the renderer picks, one of them ends up
     * drawn behind a neighbour that has already written depth and survives as
     * a sliver of itself hanging in the middle of the composition. Opaque
     * boxes sort by depth, exactly, for free. The scale is what carries the
     * arrival instead.
     */
    const t = state.clock.elapsedTime;
    nodes.current.forEach((group, i) => {
      if (!group) return;
      group.scale.setScalar(Math.max(0.0001, shown));
      if (i === 0) return;
      // The six turn where they stand once they have somewhere to stand. The
      // core does not: it is the thing the rest are arranged around.
      group.rotation.y = t * 0.05 * (i % 2 ? 1 : -1);
      group.position.y = model.nodes[i].at.y + Math.sin(t * 0.5 + i * 1.7) * model.sat * 0.05;
    });

    if (shell.current) shell.current.visible = p > 0.0005;
  });

  return (
    <group ref={shell} visible={false}>
      <mesh geometry={build.geometry} frustumCulled={false}>
        <shaderMaterial
          ref={cubes}
          uniforms={cubeUniforms}
          vertexShader={CUBE_VERT}
          fragmentShader={CUBE_FRAG}
          transparent
          depthWrite={false}
        />
      </mesh>

      {model.nodes.map((node, i) => {
        const bits = node.core ? parts.big : parts.small;
        return (
          <group
            key={i}
            position={node.at.toArray()}
            ref={(g) => {
              nodes.current[i] = g;
            }}
          >
            {/* The core is a shell with something inside it. Half transparent
                on its own it is only a dimmer cube; what makes it read as a
                shell is the second volume showing through. It is also the only
                transparent thing here, so it has nothing to sort against. */}
            <mesh geometry={bits.box}>
              <shaderMaterial
                uniforms={{
                  uColor: { value: new THREE.Color(node.core ? "#a855f7" : "#8f6ce4") },
                  uHot: { value: new THREE.Color(node.core ? "#f5c2ff" : "#dcb8ff") },
                  uFade: { value: 0 },
                  uCore: { value: node.core ? 1 : 0 },
                  uHalf: { value: (node.core ? model.edge : model.sat) / 2 },
                  uAlpha: { value: node.core ? 0.5 : 1 },
                }}
                vertexShader={GLASS_VERT}
                fragmentShader={GLASS_FRAG}
                transparent={node.core}
                depthWrite={!node.core}
              />
            </mesh>

            {node.core && (
              <>
                <mesh geometry={parts.core}>
                  <shaderMaterial
                    uniforms={{
                      uColor: { value: new THREE.Color("#c77dff") },
                      uHot: { value: new THREE.Color("#ffdcff") },
                      uFade: { value: 0 },
                      uCore: { value: 1 },
                      uHalf: { value: model.edge * 0.26 },
                      uAlpha: { value: 1 },
                    }}
                    vertexShader={GLASS_VERT}
                    fragmentShader={GLASS_FRAG}
                  />
                </mesh>
                <lineSegments geometry={parts.coreEdges}>
                  <lineBasicMaterial
                    color="#f7ddff"
                    transparent
                    opacity={0}
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                    userData={{ fade: 0.75 }}
                  />
                </lineSegments>
              </>
            )}

            <lineSegments geometry={bits.edges} renderOrder={4}>
              <lineBasicMaterial
                color={node.core ? "#f0d8ff" : "#a98cf5"}
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                userData={{ fade: node.core ? 0.55 : 0.4 }}
              />
            </lineSegments>

            <lineSegments geometry={bits.star} renderOrder={4}>
              <lineBasicMaterial
                color="#d8c4ff"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                userData={{ fade: 0.12 }}
              />
            </lineSegments>

            <points geometry={bits.dots} renderOrder={5}>
              <pointsMaterial
                color="#f5a8ff"
                size={node.core ? 4.5 : 3.2}
                sizeAttenuation={false}
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                userData={{ fade: 1 }}
              />
            </points>
          </group>
        );
      })}

      <lineSegments geometry={links.wire} renderOrder={2}>
        <lineBasicMaterial
          ref={wires}
          color="#8b5cf6"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          userData={{ fade: 0.5 }}
        />
      </lineSegments>

      <points geometry={links.pulse} frustumCulled={false} renderOrder={5}>
        <shaderMaterial
          ref={signals}
          uniforms={signalUniforms}
          vertexShader={SIGNAL_VERT}
          fragmentShader={SIGNAL_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      <lineLoop geometry={plateGeometry} position={[0, frame.groundY + 0.01, 0]}>
        <lineBasicMaterial
          ref={plate}
          color="#c084fc"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineLoop>
    </group>
  );
}
