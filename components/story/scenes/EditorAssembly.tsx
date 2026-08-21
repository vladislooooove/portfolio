"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";
import { createEditorSurface } from "../editor-surface";
import { TERRAIN } from "../terrain";
import ScrollCue from "./ScrollCue";
import { markSceneReady } from "@/lib/boot";

/* Scene 1 of the prologue. A dot landscape stands up into a VS Code window,
   the window resolves into a real screen, and the file is typed into it as the
   reader keeps scrolling.

   The landscape and the window are the same points. Every dot is a pixel of
   the empty editor, read back off the canvas the screen is later drawn with,
   and the ground is that same sheet scaled out, pushed into relief and laid
   flat. So the move is one sheet swinging up on its own axis rather than one
   set of particles being swapped for another: nothing crosses, nothing has to
   find its place, and the window is implied in the terrain the whole time.

   Three stages, three uniforms, because they overlap: the screen is already
   resolving while the last of the relief is flattening out. */

const POINT_VERT = /* glsl */ `
  ${TERRAIN}

  uniform float uFade;
  uniform float uSize;
  uniform vec3  uCool;
  uniform vec3  uHot;

  attribute vec3  aTint;
  attribute float aSeed;
  attribute float aAlpha;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // A small stagger only. The sheet is rotating, so a wide one would tear it
    // into rows at different angles instead of reading as one surface lifting.
    float delay = aSeed * 0.14;
    float t = clamp((uForm - delay) / (1.0 - delay), 0.0, 1.0);
    float inv = 1.0 - t;
    float e = 1.0 - inv * inv * inv;

    float height;
    float shade;
    vec3 pos = place(position, e, height, shade);

    // Crests catch the light and lit faces carry more of it than the faces
    // turned away, which between them are what give the relief its shape while
    // it is still a landscape.
    float ridge = clamp(height * 0.42 + 0.4, 0.0, 1.0) * (0.42 + shade * 0.78);
    vec3 violet = mix(uCool, uHot, ridge * 0.75 + aSeed * 0.25);

    // A scattering of the dots burn brighter and drift in and out, so the
    // ground has something happening on it while the reader is still reading.
    float spark = step(0.985, fract(aSeed * 37.0));
    float twinkle = spark * (0.5 + 0.5 * sin(uTime * 2.1 + aSeed * 61.0));

    // Both handovers are held until the sheet is nearly square on. Letting the
    // colour settle early cost the surface the dots that carry its body at
    // exactly the moment it should be reading as one.
    // Both handovers are held until the sheet is square on and the real screen
    // is already arriving underneath. An empty editor is mostly dark, so a dot
    // that takes its pixel's brightness early simply goes out, and the window
    // dimmed away in the frames where it should have been at its clearest.
    vColor = mix(violet + twinkle * 0.7, aTint, smoothstep(0.74, 0.99, e));
    float ground = (0.20 + ridge * 0.78 + aSeed * 0.16) + twinkle * 0.5;
    vAlpha = mix(ground, aAlpha, smoothstep(0.80, 1.0, e)) * uFade;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float depth = max(-mv.z, 0.0001);

    // The far end of the ground runs out rather than stopping at an edge.
    vAlpha *= smoothstep(30.0, 6.0, depth);

    gl_PointSize = min(uSize * (0.78 + twinkle * 0.8) / depth, 60.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float mask = smoothstep(0.5, 0.06, length(c));
    if (mask < 0.01) discard;
    gl_FragColor = vec4(vColor, mask * vAlpha);
  }
`;

const LINE_VERT = /* glsl */ `
  ${TERRAIN}

  uniform float uFade;

  attribute float aAlpha;
  attribute float aRise;

  varying float vAlpha;

  void main() {
    float height;
    float shade;
    vec3 pos = place(position, uForm, height, shade);
    // Streaks stand off the surface. They belong to the landscape, so they go
    // down with it rather than following the sheet up.
    pos.y += aRise * (1.0 - uForm);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float depth = max(-mv.z, 0.0001);
    // Crests and lit faces catch the line as well as the dots, which is what
    // draws the ridges out of the mesh instead of leaving it an even net.
    vAlpha = aAlpha * uFade * smoothstep(30.0, 6.0, depth)
           * (0.30 + max(height, 0.0) * 0.5 + shade * 0.75);
    gl_Position = projectionMatrix * mv;
  }
`;

const LINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.004) discard;
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;

/** Cheap radial falloff for the light the screen throws behind itself. */
function makeGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(139,92,246,0.55)");
  g.addColorStop(0.45, "rgba(109,77,224,0.20)");
  g.addColorStop(1, "rgba(109,77,224,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export default function EditorAssembly({
  assemble,
  fall,
  reveal,
  type,
  exit,
  mx,
  my,
}: {
  /** 0 to 1: the landscape standing up into the shape of the window. */
  assemble: MotionValue<number>;
  /** 0 to 1 over the first stretch of scroll: the scroll cue dropping. */
  fall: MotionValue<number>;
  /** 0 to 1: the dots handing over to the real screen. */
  reveal: MotionValue<number>;
  /** 0 to 1: how much of the file has been typed. */
  type: MotionValue<number>;
  /** Temporary. Scene 2 takes this range and zooms out to the laptop. */
  exit: MotionValue<number>;
  mx: MotionValue<number>;
  my: MotionValue<number>;
}) {
  const viewport = useThree((state) => state.viewport);
  const gl = useThree((state) => state.gl);

  const dots = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.ShaderMaterial>(null);
  const screen = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const tilt = useRef(new THREE.Vector2(0, 0));
  const painted = useRef(-1);
  const blink = useRef(true);
  const announced = useRef(false);

  const compact = viewport.width < 6;

  /**
   * The window is measured in the real mono face, so nothing is built until
   * that face has loaded. Building early meant sampling a fallback metric and
   * landing every dot a few pixels off the text it belongs to.
   */
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);

  const surface = useMemo(() => (fontsReady ? createEditorSurface() : null), [fontsReady]);

  const texture = useMemo(() => {
    if (!surface) return null;
    const t = new THREE.CanvasTexture(surface.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    // Regenerating mip chains on every typed character is not worth it while
    // the screen faces the reader. Scene 3 turns it away; that is when it is.
    t.generateMipmaps = false;
    t.anisotropy = gl.capabilities.getMaxAnisotropy();
    return t;
  }, [surface, gl]);

  useEffect(() => () => texture?.dispose(), [texture]);

  const glowMap = useMemo(() => makeGlow(), []);
  useEffect(() => () => glowMap.dispose(), [glowMap]);

  /**
   * Big enough to be read, short of the edges so the room is still visible and
   * so the top of the window clears the fixed bar rather than sliding under
   * it. The camera pulls back off this in scene 2, so that margin is headroom
   * for the laptop as much as it is composition.
   */
  const plane = useMemo(() => {
    const aspect = surface?.aspect ?? 1.6;
    const w = Math.min(viewport.width * 0.82, viewport.height * 0.8 * aspect);
    return { w, h: w / aspect };
  }, [surface, viewport.width, viewport.height]);

  const geometry = useMemo(() => {
    if (!surface) return null;

    const cols = compact ? 160 : 256;
    const shot = surface.sample(cols, Math.round(cols / surface.aspect));
    const count = shot.count;

    const position = new Float32Array(count * 3);
    const seed = new Float32Array(count);

    // Every point holds the place it will end up, on the screen plane. The
    // ground is that same sheet put through place(), so there is no second set
    // of coordinates to keep in step.
    for (let i = 0; i < count; i++) {
      const col = i % shot.cols;
      const row = Math.floor(i / shot.cols);
      position[i * 3] = ((col + 0.5) / shot.cols - 0.5) * plane.w;
      position[i * 3 + 1] = (0.5 - (row + 0.5) / shot.rows) * plane.h;
      position[i * 3 + 2] = 0;
      seed[i] = Math.random();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(position, 3));
    g.setAttribute("aTint", new THREE.BufferAttribute(shot.tint, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(shot.alpha, 1));
    return g;
  }, [surface, compact, plane.w, plane.h]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  /**
   * The wireframe over the ground, plus the streaks standing off it. Drawn on
   * a much coarser grid than the dots: it is there to read the relief, and one
   * line per dot would be a solid sheet. Both go before the sheet is halfway
   * up, since a screen does not have a mesh across it.
   */
  const wire = useMemo(() => {
    const GX = 84;
    const GY = 54;
    const position: number[] = [];
    const alpha: number[] = [];
    const rise: number[] = [];

    const at = (i: number, j: number) => [
      (i / (GX - 1) - 0.5) * plane.w,
      (0.5 - j / (GY - 1)) * plane.h,
    ];
    // The far end of the ground is the top edge of the sheet, so the lines
    // there are the ones running out to the horizon.
    const near = (j: number) => 0.07 + 0.42 * (j / (GY - 1));

    const edge = (i: number, j: number, i2: number, j2: number) => {
      const a = at(i, j);
      const b = at(i2, j2);
      position.push(a[0], a[1], 0, b[0], b[1], 0);
      alpha.push(near(j), near(j2));
      rise.push(0, 0);
    };

    for (let j = 0; j < GY; j++) for (let i = 0; i < GX - 1; i++) edge(i, j, i + 1, j);
    for (let i = 0; i < GX; i++) for (let j = 0; j < GY - 1; j++) edge(i, j, i, j + 1);

    // Light standing off the surface, brightest at the tip. Enough of them to
    // read as weather over the landscape rather than as a handful of markers,
    // and varied in height and brightness so no two draw the eye equally.
    for (let s = 0; s < 88; s++) {
      const [x, y] = at(Math.random() * (GX - 1), 3 + Math.random() * (GY - 5));
      const tall = Math.random() ** 2.2;
      position.push(x, y, 0, x, y, 0);
      alpha.push(0, 0.24 + tall * 0.62);
      rise.push(0, 0.6 + tall * 3.4);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(alpha), 1));
    g.setAttribute("aRise", new THREE.BufferAttribute(new Float32Array(rise), 1));
    return g;
  }, [plane.w, plane.h]);

  useEffect(() => () => wire.dispose(), [wire]);

  const pointUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uForm: { value: 0 },
      uTilt: { value: new THREE.Vector2(0, 0) },
      uFade: { value: 1 },
      uSize: { value: 14 },
      uCool: { value: new THREE.Color("#7c3aed") },
      uHot: { value: new THREE.Color("#d8b4fe") },
    }),
    [],
  );

  const lineUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uForm: { value: 0 },
      uTilt: { value: new THREE.Vector2(0, 0) },
      uFade: { value: 1 },
      uColor: { value: new THREE.Color("#a855f7") },
    }),
    [],
  );

  useFrame((state, delta) => {
    const m = dots.current;
    if (!m || !surface || !texture) return;

    if (!announced.current) {
      announced.current = true;
      markSceneReady();
    }

    const gone = 1 - exit.get();
    const form = assemble.get();
    const shown = reveal.get();
    const time = state.clock.elapsedTime;

    // Eased, or the ground snaps to a new angle the instant the pointer moves.
    const k = Math.min(1, delta * 3.2);
    tilt.current.x += (clamp1(mx.get()) * 0.09 - tilt.current.x) * k;
    tilt.current.y += (clamp1(my.get()) * 0.11 - tilt.current.y) * k;

    m.uniforms.uTime.value = time;
    m.uniforms.uForm.value = form;
    m.uniforms.uTilt.value.copy(tilt.current);
    m.uniforms.uFade.value = (1 - shown) * gone;
    m.uniforms.uSize.value = (compact ? 14 : 20) * state.viewport.dpr;

    const w = mesh.current;
    if (w) {
      w.uniforms.uTime.value = time;
      w.uniforms.uForm.value = form;
      w.uniforms.uTilt.value.copy(tilt.current);
      w.uniforms.uFade.value = (1 - THREE.MathUtils.smoothstep(form, 0.02, 0.44)) * gone;
    }

    if (screen.current) screen.current.opacity = shown * gone;
    if (glow.current) glow.current.opacity = shown * gone * 0.9;

    // The caret keeps its own clock, so the file looks like it is being
    // written rather than scrubbed. Both it and the character count only
    // trigger a repaint when they actually change.
    const on = Math.floor(time / 0.53) % 2 === 0;
    const chars = Math.round(type.get() * surface.total);
    if (chars !== painted.current || on !== blink.current) {
      painted.current = chars;
      blink.current = on;
      surface.draw(chars, on);
      texture.needsUpdate = true;
    }
  });

  if (!geometry || !texture) return null;

  return (
    <group>
      <mesh position={[0, 0, -0.35]} renderOrder={0}>
        <planeGeometry args={[plane.w * 1.7, plane.h * 1.9]} />
        <meshBasicMaterial
          ref={glow}
          map={glowMap}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh renderOrder={1}>
        <planeGeometry args={[plane.w, plane.h]} />
        <meshBasicMaterial ref={screen} map={texture} transparent opacity={0} depthWrite={false} />
      </mesh>

      <lineSegments geometry={wire} frustumCulled={false} renderOrder={2}>
        <shaderMaterial
          ref={mesh}
          uniforms={lineUniforms}
          vertexShader={LINE_VERT}
          fragmentShader={LINE_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>

      <ScrollCue fall={fall} form={assemble} tilt={tilt} plane={plane} />

      <points geometry={geometry} frustumCulled={false} renderOrder={3}>
        <shaderMaterial
          ref={dots}
          uniforms={pointUniforms}
          vertexShader={POINT_VERT}
          fragmentShader={POINT_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
