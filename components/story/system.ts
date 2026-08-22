import * as THREE from "three";
import type { Laptop } from "./laptop";

/**
 * The system diagram, and the cells it is built out of, in one place.
 *
 * Two scenes need the same answer here: the one that assembles the model and
 * the one that takes it apart again. The second scene's cubes start exactly
 * where the first scene's cubes stopped, so the shuffle that decides which
 * cell is which cannot be Math.random. It is seeded, and both callers get the
 * identical array without having to pass one to the other.
 */

/** One cube. Everything downstream is measured in these. */
export const cellOf = (M: Laptop) => M.lidW / 68;

/**
 * How far a volume turns per unit of scroll through its chapter, and where it
 * has got to by the end of one.
 *
 * Shared, because the cubes that make a volume have to turn with it. They are
 * placed in world space, so a volume that spins on its own leaves its own
 * cells behind, and the solid and the swarm come apart during the one moment
 * they are both on screen.
 */
export const WIND = 0.55;
export const WOUND = WIND * 2;

/** Which way each volume turns. The core does not. */
export const spinOf = (i: number) => (i === 0 ? 0 : i % 2 ? 1 : -1);

/** Rotation about Y, matching Object3D.rotation.y. */
export function windAbout(out: THREE.Vector3, pivot: THREE.Vector3, angle: number) {
  const x = out.x - pivot.x;
  const z = out.z - pivot.z;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out.x = pivot.x + x * c + z * s;
  out.z = pivot.z - x * s + z * c;
  return out;
}

/** Mulberry32: small, fast, and the same sequence every time. */
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export type Volume = { at: THREE.Vector3; size: number; core: boolean };

/**
 * A core with one neighbour out along each axis. Six is what an octahedron
 * gives you and what the arrangement reads as at this angle: one behind each
 * shoulder, one over and one under.
 */
export function modelOf(M: Laptop, groundY: number, z = 0) {
  const edge = M.lidW * 0.28;
  const sat = edge * 0.6;
  // Clear of the core by more than half its own width. Closer than this and
  // the two on the vertical axis sit behind it at this angle and read as
  // slivers rather than as neighbours.
  const reach = edge * 1.5;
  // Standing where the laptop stood, and resting on the platform rather than
  // floating over it: the lowest volume clears the deck by a hair.
  const origin = new THREE.Vector3(0, groundY + reach + sat / 2 + edge * 0.12, z);
  const dirs: [number, number, number][] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  const nodes: Volume[] = [
    { at: origin.clone(), size: edge, core: true },
    ...dirs.map((d) => ({
      at: origin.clone().add(new THREE.Vector3(...d).multiplyScalar(reach)),
      size: sat,
      core: false,
    })),
  ];

  return { origin, edge, sat, nodes };
}

/**
 * Shells, not solids. A cube packed all the way through spends most of its
 * cells where nobody can see them, and there are only so many cells to spend:
 * the same count laid over the six faces reads as a cube built out of blocks
 * rather than as a cloud that is roughly cubic.
 */
export function shellSlots(nodes: Volume[], cell: number) {
  const out: number[] = [];
  const owner: number[] = [];

  nodes.forEach((node, index) => {
    const n = Math.max(3, Math.round(node.size / cell));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        for (let k = 0; k < n; k++) {
          if (i > 0 && i < n - 1 && j > 0 && j < n - 1 && k > 0 && k < n - 1) continue;
          out.push(
            node.at.x + (i + 0.5 - n / 2) * cell,
            node.at.y + (j + 0.5 - n / 2) * cell,
            node.at.z + (k + 0.5 - n / 2) * cell,
          );
          owner.push(index);
        }
      }
    }
  });

  const random = seeded(0x5eed);
  for (let i = out.length / 3 - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    for (let c = 0; c < 3; c++) {
      const t = out[i * 3 + c];
      out[i * 3 + c] = out[j * 3 + c];
      out[j * 3 + c] = t;
    }
    const o = owner[i];
    owner[i] = owner[j];
    owner[j] = o;
  }

  return { slots: new Float32Array(out), owner: new Uint8Array(owner) };
}

/** Cells over the surface of a box, in the box's own frame. */
export function boxShell(
  w: number,
  h: number,
  d: number,
  cell: number,
  into: number[],
  at: THREE.Vector3,
  topOnly = false,
) {
  const nx = Math.max(1, Math.round(w / cell));
  const ny = Math.max(1, Math.round(h / cell));
  const nz = Math.max(1, Math.round(d / cell));

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        if (topOnly ? j !== ny - 1 : i > 0 && i < nx - 1 && j > 0 && j < ny - 1 && k > 0 && k < nz - 1)
          continue;
        into.push(
          at.x + (i + 0.5 - nx / 2) * cell,
          at.y + (j + 0.5 - ny / 2) * cell,
          at.z + (k + 0.5 - nz / 2) * cell,
        );
      }
    }
  }
}

/** A rounded slab lying flat, thickness in y, centred on its own origin. */
export function roundedSlab(w: number, d: number, r: number, thick: number) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const bevel = thick * 0.12;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(thick - bevel * 2, thick * 0.2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.center();
  return g;
}

/** The rounded rectangle both the deck and its line are cut from. */
function outline(w: number, d: number, r: number, steps = 96) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape.getPoints(steps);
}

/** The outline inset into the deck, as a closed loop of points. */
export function slabOutline(w: number, d: number, r: number) {
  return new THREE.BufferGeometry().setFromPoints(
    outline(w, d, r).map((p) => new THREE.Vector3(p.x, 0, p.y)),
  );
}

/**
 * The same loop as a flat ribbon, so it can be lit like a tube rather than
 * drawn like a line.
 *
 * A GL line is one pixel wide whatever you ask of it, and one pixel of colour
 * is a line, not a light. The glow has to have width to fall off across, so
 * the loop is widened into a strip and every vertex carries how far across it
 * sits; the shader does the rest.
 */
export function slabGlow(w: number, d: number, r: number, width: number) {
  const pts = outline(w, d, r);
  const n = pts.length;
  const position: number[] = [];
  const cross: number[] = [];
  const index: number[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    position.push(pts[i].x + nx * width, 0, pts[i].y + ny * width);
    position.push(pts[i].x - nx * width, 0, pts[i].y - ny * width);
    cross.push(1, -1);
  }

  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = (((i + 1) % n) * 2) % (n * 2);
    index.push(a, b, c, b, c + 1, c);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(position), 3));
  g.setAttribute("aCross", new THREE.BufferAttribute(new Float32Array(cross), 1));
  g.setIndex(index);
  return g;
}
