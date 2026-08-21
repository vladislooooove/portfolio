"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { cssFont } from "../editor-surface";
import { TERRAIN } from "../terrain";

/**
 * The cue that says the page is scrolled, built out of the same points as
 * everything else here.
 *
 * The prologue opens on a landscape and nothing else: no copy, no controls,
 * nothing that says the sequence is driven by the scrollbar. That is the one
 * case where a scroll cue is doing work rather than decorating, so it gets one.
 * It leaves the moment it has been obeyed. The first scroll drops it out of the
 * air and every point of it lands on the terrain and stays there, which is both
 * the cue getting out of the way and the first thing the reader does having a
 * visible consequence.
 *
 * The word is sampled out of a canvas at dot-matrix resolution, and the
 * chevrons are walked along their own strokes, which is why they can pulse
 * one after another: each one knows which chevron it belongs to.
 */

const VERT = /* glsl */ `
  ${TERRAIN}

  uniform float uFall;
  uniform float uFade;
  uniform float uRest;
  uniform float uSize;
  uniform vec3  uCool;
  uniform vec3  uHot;

  attribute vec2  aLand;
  attribute float aSeed;
  attribute float aPart;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // Idle. The label breathes, and the chevrons take it in turn from the top
    // down, which is the direction the reader is being asked to go.
    float lit;
    if (aPart < 0.5) {
      lit = 0.95 + 0.16 * sin(uTime * 1.15 + position.x * 2.0);
    } else {
      float cycle = fract(uTime * 0.42);
      float slot = (aPart - 1.0) * 0.11;
      lit = 0.34 + 1.0 * max(0.0, 1.0 - abs(cycle - slot) * 7.5);
    }

    // Falling. Staggered, and accelerating hard rather than eased out, because
    // the point of the move is that the cue drops. Every point is headed for a
    // different spot on the ground, so it comes apart the instant it starts
    // moving; a gentler curve pulled the word to pieces while it was still
    // more or less where it had been, which read as it dissolving rather than
    // as it falling.
    float delay = aSeed * 0.34;
    float t = clamp((uFall - delay) / (1.0 - delay), 0.0, 1.0);
    float e = t * t * t;

    float height;
    float shade;
    // Placed against the ground as it is now, not as it was. The landscape
    // starts gathering on the same scroll that drops the cue, so a landing
    // spot fixed to the untouched ground would leave every point of it
    // hanging in the air a moment after it arrived.
    vec3 land = place(vec3(aLand, 0.0), uForm, height, shade);

    vec3 rest = position;
    rest.y += sin(uTime * 0.9 + aSeed * 6.28) * 0.006;

    vec3 pos = mix(rest, land, e);
    // A little sideways drift on the way down, so a hundred points do not fall
    // as a hundred parallel lines.
    pos.x += sin(aSeed * 39.0) * 0.30 * e * (1.0 - e);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float depth = max(-mv.z, 0.0001);

    // Landed, it is terrain: the colour and the weight of the field it joined,
    // and gone by the time that field starts gathering into the window.
    float merged = smoothstep(0.55, 1.0, e);
    vec3 violet = mix(uHot, uCool, merged * 0.85);
    vColor = violet;
    vAlpha = mix(lit, 0.34 + max(height, 0.0) * 0.3, merged)
           * uFade
           * (1.0 - smoothstep(0.10, 0.34, uForm));

    gl_PointSize = mix(uRest, uSize * 0.78 / depth, merged);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float mask = smoothstep(0.5, 0.06, length(c));
    if (mask < 0.01) discard;
    gl_FragColor = vec4(vColor, mask * vAlpha);
  }
`;

/** Screen sizes, in CSS pixels. Converted to world units once measured. */
const LABEL = "SCROLL";
const FONT = 54;
const TRACK = 0.28;
const STEP = 5;
const GAP = 38;
const CHEVRON_W = 72;
const CHEVRON_H = 23;
const CHEVRON_GAP = 18;
const CHEVRONS = 3;
const WEIGHT = 2.5;

export default function ScrollCue({
  fall,
  form,
  tilt,
  plane,
}: {
  /** 0 to 1 across the first stretch of scroll: the cue dropping. */
  fall: MotionValue<number>;
  /** The landscape's own progress, which is what finally clears the cue. */
  form: MotionValue<number>;
  tilt: React.RefObject<THREE.Vector2>;
  plane: { w: number; h: number };
}) {
  const viewport = useThree((state) => state.viewport);
  const material = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const unit = 1 / viewport.factor;
    const mono = cssFont("--font-geist-mono", "ui-monospace, SFMono-Regular, Menlo, monospace");

    const px: number[] = [];
    const py: number[] = [];
    const part: number[] = [];

    // The word, read off a canvas at a spacing coarse enough that it stays a
    // constellation rather than resolving into solid strokes.
    const SUP = 2;
    const canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const face = `600 ${FONT * SUP}px ${mono}`;
    ctx.font = face;
    const chars = LABEL.split("");
    const widths = chars.map((c) => ctx.measureText(c).width);
    const track = FONT * TRACK * SUP;
    const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);

    canvas.width = Math.ceil(total) + 8;
    canvas.height = Math.ceil(FONT * SUP * 1.5);
    ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.font = face;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    let pen = 4;
    chars.forEach((c, i) => {
      ctx.fillText(c, pen, canvas.height / 2);
      pen += widths[i] + track;
    });

    const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Rounded, and it has to be. A fractional step indexes the pixel array
    // between elements, every read comes back undefined, every alpha test
    // compares against NaN and passes, and the word samples as a solid block.
    const grid = Math.max(2, Math.round(STEP * SUP));
    for (let y = 0; y < canvas.height; y += grid) {
      for (let x = 0; x < canvas.width; x += grid) {
        if (image[(y * canvas.width + x) * 4 + 3] / 255 < 0.45) continue;
        px.push((x - canvas.width / 2) / SUP);
        py.push(-(y - canvas.height / 2) / SUP);
        part.push(0);
      }
    }

    // The chevrons, walked along their own two strokes so each point knows
    // which chevron it is in and can take its turn.
    const top = -(FONT * 0.75) - GAP;
    for (let c = 0; c < CHEVRONS; c++) {
      const head = top - c * (CHEVRON_H + CHEVRON_GAP);
      const steps = Math.max(3, Math.round(Math.hypot(CHEVRON_W / 2, CHEVRON_H) / STEP));
      for (const side of [-1, 1]) {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          for (const w of [-WEIGHT, WEIGHT]) {
            px.push(side * (CHEVRON_W / 2) * (1 - t));
            py.push(head - CHEVRON_H * t + w);
            part.push(c + 1);
          }
        }
      }
    }

    const count = part.length;
    const position = new Float32Array(count * 3);
    const land = new Float32Array(count * 2);
    const seed = new Float32Array(count);

    // Sits high in the frame, clear of the fixed bar and of the ground, and
    // points down into what it is about to fall into.
    const lift = viewport.height * 0.22;

    for (let i = 0; i < count; i++) {
      position[i * 3] = px[i] * unit;
      position[i * 3 + 1] = py[i] * unit + lift;
      // A shade in front of the ground, so the cue is never inside a hill.
      position[i * 3 + 2] = 0.3;

      // Where it ends up: a spread across the middle distance of the sheet,
      // which place() turns into a spot on the actual surface.
      land[i * 2] = (Math.random() - 0.5) * plane.w * 0.86;
      land[i * 2 + 1] = (0.06 + Math.random() * 0.34) * plane.h;
      seed[i] = Math.random();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aLand", new THREE.BufferAttribute(land, 2));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(part), 1));
    return g;
  }, [viewport.factor, viewport.height, plane.w, plane.h]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uForm: { value: 0 },
      uTilt: { value: new THREE.Vector2(0, 0) },
      uFall: { value: 0 },
      uFade: { value: 1 },
      uRest: { value: 6.0 },
      uSize: { value: 14 },
      uCool: { value: new THREE.Color("#7c3aed") },
      uHot: { value: new THREE.Color("#e9d5ff") },
    }),
    [],
  );

  useFrame((state) => {
    const m = material.current;
    if (!m) return;
    m.uniforms.uTime.value = state.clock.elapsedTime;
    m.uniforms.uForm.value = form.get();
    m.uniforms.uFall.value = fall.get();
    if (tilt.current) m.uniforms.uTilt.value.copy(tilt.current);
    m.uniforms.uRest.value = 6.0 * state.viewport.dpr;
    m.uniforms.uSize.value = 20 * state.viewport.dpr;
  });

  return (
    <points geometry={geometry} frustumCulled={false} renderOrder={4}>
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
