"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MotionValue } from "motion/react";

/**
 * Scene 2. The camera pulls back off the screen and the thing the screen is
 * part of resolves around it: a laptop, open, on a desk.
 *
 * The screen never moves. It is built into the lid at the exact size and place
 * scene 1 left it, and everything else is measured off it, so the first frame
 * of this scene and the last frame of the one before it are the same picture.
 * All that happens is that the camera goes back far enough to see what else is
 * there.
 *
 * The body resolves early in the move and the frame keeps widening around it,
 * so what the reader sees is a camera finding the rest of an object rather
 * than an object being assembled for them. Scene 1 does the assembling out of
 * dots; doing it a second time here made the same point twice.
 *
 * Local space here is the lid standing upright with the screen centred on the
 * origin and facing the lens. The resting pose of a laptop is not that: the
 * base is flat and the lid leans back off it. So the whole assembly is rigid
 * and correct in local space, and the group carrying it turns by that lean
 * over the scene, settling the object into the world at the same time as the
 * world appears around it.
 */

/** How far the lid opens off the base. A laptop in use sits near this. */
const OPEN = THREE.MathUtils.degToRad(105);
/** What that leaves between the lid and vertical, and so what the group turns by. */
const LEAN = OPEN - Math.PI / 2;

const roundedShape = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};

/**
 * A slab standing in the xy plane with its front face on z = 0, its thickness
 * running back along -z, and that thickness being exactly what was asked for.
 *
 * Both halves of that matter, and both are about the bevel. Extrusion puts the
 * bevel outside the range it was given, at both ends, so a slab asked for at
 * depth d comes back d + 2 * bevel thick and sitting proud of z = 0 at the
 * front. Left alone, the lid covers the screen it is supposed to frame, and
 * every offset measured off half the stated thickness lands inside the body
 * rather than on it: the trackpad went in under the deck and stayed there.
 * The bevel is taken out of the depth, not added to it.
 */
const panel = (w: number, h: number, r: number, thick: number) => {
  const bevel = thick * 0.11;
  const depth = Math.max(thick - bevel * 2, thick * 0.2);
  const g = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 8,
  });
  g.translate(0, 0, -(depth + bevel));
  return g;
};

/** The same slab, laid flat: thickness in y, the shape's own y running back. */
const slab = (w: number, d: number, r: number, thick: number) => {
  const g = panel(w, d, r, thick);
  g.rotateX(-Math.PI / 2);
  g.center();
  return g;
};

const smoother = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const span = (v: number, a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));

/** One key. Width and advance are in key units; height is a fraction of a row. */
type Key = { w: number; h: number; dy: number; adv: number };
const K = (w = 1, h = 1, dy = 0, adv = w): Key => ({ w, h, dy, adv });

/**
 * The real layout, because the wrong one is obvious. A stepped left edge down
 * the modifiers, a return key that is two rows of nothing beside it, and an
 * inverted T of arrows at the bottom right are what a reader recognises; an
 * even grid of squares reads as a texture of a keyboard.
 */
const ROWS: Key[][] = [
  [K(1.5), ...Array.from({ length: 12 }, () => K(1, 0.62)), K(1.5, 0.62)],
  [...Array.from({ length: 13 }, () => K()), K(2)],
  [K(1.5), ...Array.from({ length: 12 }, () => K()), K(1.5)],
  [K(1.75), ...Array.from({ length: 11 }, () => K()), K(2.25)],
  [K(2.25), ...Array.from({ length: 10 }, () => K()), K(2.75)],
  [
    K(1),
    K(1),
    K(1),
    K(1.25),
    K(5.5),
    K(1.25),
    K(1),
    K(1),
    K(1, 0.46, -0.26, 0),
    K(1, 0.46, 0.26),
    K(1),
  ],
];

export default function Desk({
  texture,
  plane,
  reveal,
  pull,
  exit,
}: {
  texture: THREE.Texture;
  plane: { w: number; h: number };
  /** Scene 1's handover: what fades the screen up out of the dots. */
  reveal: MotionValue<number>;
  /** 0 to 1 across scene 2. */
  pull: MotionValue<number>;
  exit: MotionValue<number>;
}) {
  const glowMap = useGlow();
  const settle = useRef<THREE.Group>(null);
  const screen = useRef<THREE.MeshBasicMaterial>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const keys = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.Group>(null);

  /** Every measurement on the object comes off the screen it is built around. */
  const M = useMemo(() => {
    const W = plane.w;
    const H = plane.h;
    const side = W * 0.016;
    const chin = W * 0.032;
    const lidW = W + side * 2;
    const lidH = H + side + chin;
    const lidT = W * 0.012;
    const lidCY = (side - chin) / 2;
    const hingeY = lidCY - lidH / 2;
    const baseD = lidH * 0.98;
    const baseT = W * 0.026;
    const basePos = new THREE.Vector3(
      0,
      hingeY + Math.cos(OPEN) * (baseD / 2) - Math.cos(LEAN) * (baseT / 2),
      -lidT / 2 + Math.sin(OPEN) * (baseD / 2) - Math.sin(LEAN) * (baseT / 2),
    );
    return { W, H, side, chin, lidW, lidH, lidT, lidCY, hingeY, baseD, baseT, basePos };
  }, [plane.w, plane.h]);

  const lid = useMemo(() => panel(M.lidW, M.lidH, M.lidW * 0.022, M.lidT), [M]);
  const base = useMemo(() => slab(M.lidW, M.baseD, M.lidW * 0.020, M.baseT), [M]);
  const desk = useMemo(
    () => slab(M.lidW * 2.2, M.baseD * 2.4, M.lidW * 0.05, M.baseT * 0.5),
    [M],
  );

  /**
   * The deck, in the fractions of its own depth a laptop actually uses: a
   * small margin at the hinge, the keyboard, a gap, the trackpad, and a lip
   * left clear at the front. Sized off those rather than by eye, because
   * picking the trackpad's size and its position separately is how it ends up
   * reaching back under the last row of keys.
   */
  const deck = useMemo(() => {
    const areaW = M.lidW * 0.86;
    const keysD = M.baseD * 0.44;
    const back = -M.baseD * 0.5 + M.baseD * 0.06;
    const padD = M.baseD * 0.36;
    const padZ = back + keysD + M.baseD * 0.05 + padD / 2;
    return { areaW, back, rowD: keysD / ROWS.length, padW: padD * 1.62, padD, padZ };
  }, [M]);

  const pad = useMemo(
    () => slab(deck.padW, deck.padD, deck.padW * 0.045, M.baseT * 0.06),
    [deck, M],
  );
  /** The seam around the trackpad, which is how you know it is one. */
  const padSeam = useMemo(
    () => slab(deck.padW * 1.04, deck.padD * 1.06, deck.padW * 0.05, M.baseT * 0.05),
    [deck, M],
  );

  const layout = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = [];
    ROWS.forEach((row, r) => {
      const units = row.reduce((sum, key) => sum + key.adv, 0);
      const unit = deck.areaW / units;
      let x = -deck.areaW / 2;
      row.forEach((key) => {
        out.push({
          x: x + (key.w * unit) / 2,
          z: deck.back + deck.rowD * (r + 0.5 + key.dy),
          w: key.w * unit * 0.88,
          d: deck.rowD * key.h * 0.8,
        });
        x += key.adv * unit;
      });
    });
    return out;
  }, [deck]);

  useEffect(() => {
    const mesh = keys.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const height = M.baseT * 0.3;
    layout.forEach((key, i) => {
      m.makeScale(key.w, height, key.d);
      m.setPosition(key.x, M.baseT / 2 + height * 0.34, key.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [layout, M]);

  useEffect(
    () => () => {
      [lid, base, pad, padSeam, desk].forEach((g) => g.dispose());
    },
    [lid, base, pad, padSeam, desk],
  );

  useFrame(() => {
    const gone = 1 - exit.get();
    const p = pull.get();
    const shown = reveal.get();

    // Early, and quick. The camera keeps travelling long after the body is
    // there, so the reader reads the move as the frame opening rather than as
    // anything appearing.
    const solid = smoother(span(p, 0.03, 0.3)) * gone;
    const settled = smoother(span(p, 0.2, 1));

    if (settle.current) settle.current.rotation.x = -LEAN * settled;

    settle.current?.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.Material | undefined;
      if (!material || Array.isArray(material) || material.userData.own) return;
      material.opacity = solid;
      // Written only once it is solid enough to be occluding anything. A
      // transparent surface still writes depth, and an invisible one that does
      // punches a hole in the landscape behind it.
      material.depthWrite = solid > 0.04;
    });

    if (screen.current) {
      screen.current.opacity = shown * gone;
      screen.current.depthWrite = shown > 0.98;
    }
    if (glow.current) {
      glow.current.opacity = shown * gone * 0.9 * (1 - smoother(span(p, 0, 0.7)) * 0.72);
    }

    if (lights.current) {
      lights.current.children.forEach((light) => {
        const source = light as THREE.Light & { userData: { power?: number } };
        if (source.userData.power === undefined) return;
        source.intensity = source.userData.power * solid;
      });
    }
  });

  return (
    <group ref={settle}>
      {/* Lit only for the object. The landscape and the dots are unlit and do
          not care, and the screen is emissive, so nothing before this scene
          changes when these come up. */}
      <group ref={lights}>
        <ambientLight intensity={0} color="#b8a6ff" userData={{ power: 1.45 }} />
        <directionalLight
          position={[-M.lidW, M.lidH * 1.4, M.lidW * 1.2]}
          intensity={0}
          color="#efe9ff"
          userData={{ power: 5.4 }}
        />
        <directionalLight
          position={[M.lidW * 1.2, M.lidH * 0.3, -M.lidW]}
          intensity={0}
          color="#8b5cf6"
          userData={{ power: 2.3 }}
        />
        {/* What the screen throws on the deck in front of it. */}
        <pointLight
          position={[0, M.hingeY + M.lidH * 0.2, M.lidT + M.W * 0.18]}
          intensity={0}
          color="#a78bfa"
          distance={M.lidW * 2.6}
          decay={1.6}
          userData={{ power: 11 }}
        />
      </group>

      {/* Behind the lid: the light the screen throws into the room. */}
      <mesh position={[0, 0, -M.lidT - 0.5]} renderOrder={0}>
        <planeGeometry args={[plane.w * 1.8, plane.h * 2.0]} />
        <meshBasicMaterial
          ref={glow}
          map={glowMap}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          userData={{ own: true }}
        />
      </mesh>

      <mesh geometry={lid} position={[0, M.lidCY, 0]}>
        <meshStandardMaterial color="#3d3559" roughness={0.38} metalness={0.18} transparent opacity={0} />
      </mesh>

      {/* The light along the top edge of the lid, which is the line that says
          the body is metal and not a dark rectangle. */}
      <mesh position={[0, M.lidCY + M.lidH / 2 - M.lidT * 0.18, -M.lidT * 0.5]}>
        <boxGeometry args={[M.lidW * 0.985, M.lidT * 0.22, M.lidT * 1.05]} />
        <meshBasicMaterial color="#8f74e8" transparent opacity={0} />
      </mesh>

      {/* The camera above the screen, which is the detail that reads first. */}
      <mesh position={[0, M.H / 2 + M.side * 0.5, 0.004]}>
        <circleGeometry args={[M.W * 0.004, 12]} />
        <meshStandardMaterial color="#0b0912" roughness={0.2} transparent opacity={0} />
      </mesh>

      <mesh position={[0, 0, 0.004]} renderOrder={1}>
        <planeGeometry args={[plane.w, plane.h]} />
        <meshBasicMaterial
          ref={screen}
          map={texture}
          transparent
          opacity={0}
          depthWrite={false}
          userData={{ own: true }}
        />
      </mesh>

      {/* Everything from the hinge forward. Turned by the opening angle, so
          the group's own settle is all that is left to make it flat. */}
      <group position={M.basePos.toArray()} rotation={[LEAN, 0, 0]}>
        <mesh geometry={base}>
          <meshStandardMaterial color="#4a4169" roughness={0.42} metalness={0.12} transparent opacity={0} />
        </mesh>

        {/* The hinge, and the lip along the front edge that catches the light. */}
        <mesh position={[0, M.baseT * 0.18, -M.baseD / 2 + M.baseT * 0.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[M.baseT * 0.34, M.baseT * 0.34, M.lidW * 0.97, 14]} />
          <meshStandardMaterial color="#1d1830" roughness={0.55} metalness={0.3} transparent opacity={0} />
        </mesh>
        <mesh position={[0, M.baseT * 0.1, M.baseD / 2 - M.baseT * 0.1]}>
          <boxGeometry args={[M.lidW * 0.985, M.baseT * 0.2, M.baseT * 0.22]} />
          <meshBasicMaterial color="#8f74e8" transparent opacity={0} />
        </mesh>

        <instancedMesh ref={keys} args={[undefined, undefined, layout.length]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#1c1729" roughness={0.6} metalness={0.04} transparent opacity={0} />
        </instancedMesh>

        {/* The seam first, wider and much darker, then the pad itself standing
            a hair proud of it. The seam is the whole reason it reads as a
            trackpad: a panel the same tone as the deck around it, however
            carefully placed, is invisible. Rough, not glossy, because a low
            roughness surface with no environment to reflect renders as a dark
            patch with one specular dot on it. */}
        <mesh geometry={padSeam} position={[0, M.baseT * 0.525, deck.padZ]}>
          <meshStandardMaterial color="#100c1a" roughness={0.85} transparent opacity={0} />
        </mesh>
        <mesh geometry={pad} position={[0, M.baseT * 0.58, deck.padZ]}>
          <meshStandardMaterial color="#3a3358" roughness={0.55} metalness={0.06} transparent opacity={0} />
        </mesh>

        <mesh geometry={desk} position={[0, -M.baseT * 0.75, M.baseD * 0.18]}>
          <meshStandardMaterial color="#1b1628" roughness={0.9} metalness={0.0} transparent opacity={0} />
        </mesh>

        {/* The cup, on the right, the size a cup is next to a laptop. */}
        {/* Clear of the base's own footprint, and not so far forward that
            perspective throws it off the side of the frame. */}
        {/* Open at the top, with a wall you can see the inside of, coffee
            sitting below the rim, and a handle whose ends run into the body
            rather than floating beside it. A closed cylinder with a disc on
            top is a canister. */}
        <group position={[M.lidW * 0.58, -M.baseT * 0.5, M.baseD * 0.10]}>
          <mesh position={[0, M.W * 0.048, 0]}>
            <cylinderGeometry args={[M.W * 0.042, M.W * 0.036, M.W * 0.096, 28, 1, true]} />
            <meshStandardMaterial
              color="#6d4ec7"
              roughness={0.34}
              metalness={0.04}
              side={THREE.DoubleSide}
              transparent
              opacity={0}
            />
          </mesh>
          <mesh position={[0, M.W * 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[M.W * 0.036, 28]} />
            <meshStandardMaterial color="#4a3390" roughness={0.5} transparent opacity={0} />
          </mesh>
          <mesh position={[0, M.W * 0.082, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[M.W * 0.038, 28]} />
            <meshStandardMaterial color="#1a1020" roughness={0.18} metalness={0.1} transparent opacity={0} />
          </mesh>
          <mesh position={[0, M.W * 0.096, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[M.W * 0.042, M.W * 0.0022, 8, 28]} />
            <meshStandardMaterial color="#7d5cd8" roughness={0.34} transparent opacity={0} />
          </mesh>
          <mesh position={[M.W * 0.042, M.W * 0.052, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <torusGeometry args={[M.W * 0.023, M.W * 0.0062, 10, 24, Math.PI]} />
            <meshStandardMaterial color="#6d4ec7" roughness={0.34} metalness={0.04} transparent opacity={0} />
          </mesh>
        </group>

      </group>

    </group>
  );
}

/** Cheap radial falloff, built once and shared. */
let glowMap: THREE.CanvasTexture | null = null;
function useGlow() {
  return useMemo(() => {
    if (glowMap) return glowMap;
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
    glowMap = new THREE.CanvasTexture(canvas);
    glowMap.colorSpace = THREE.SRGBColorSpace;
    return glowMap;
  }, []);
}
