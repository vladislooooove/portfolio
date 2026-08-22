import * as THREE from "three";

/**
 * The laptop's measurements, in one place, because two scenes need to agree on
 * them exactly: the one that draws the object and the one that takes it apart.
 *
 * Everything is derived from the screen, which is the one thing that was fixed
 * before the object existed. Local space is the lid standing upright with the
 * screen centred on the origin and facing the lens; the group carrying it
 * turns by LEAN to settle the base flat.
 */

/** How far the lid opens off the base. A laptop in use sits near this. */
export const OPEN = THREE.MathUtils.degToRad(105);
/** What that leaves between the lid and vertical, and so what the group turns by. */
export const LEAN = OPEN - Math.PI / 2;

export type Laptop = ReturnType<typeof measure>;

export function measure(w: number, h: number) {
  const side = w * 0.016;
  const chin = w * 0.032;
  const lidW = w + side * 2;
  const lidH = h + side + chin;
  const lidT = w * 0.012;
  const lidCY = (side - chin) / 2;
  const hingeY = lidCY - lidH / 2;
  const baseD = lidH * 0.98;
  const baseT = w * 0.026;
  const basePos = new THREE.Vector3(
    0,
    hingeY + Math.cos(OPEN) * (baseD / 2) - Math.cos(LEAN) * (baseT / 2),
    -lidT / 2 + Math.sin(OPEN) * (baseD / 2) - Math.sin(LEAN) * (baseT / 2),
  );
  return { W: w, H: h, side, chin, lidW, lidH, lidT, lidCY, hingeY, baseD, baseT, basePos };
}

/**
 * The same object once it has settled, in the coordinates a scene outside the
 * settling group works in. By the time the laptop comes apart the lean is done
 * and the base is flat, so this frame is axis aligned: y is up, the ground is
 * a height, and none of the arithmetic downstream has to carry a rotation.
 */
export function settled(M: Laptop) {
  const turn = new THREE.Matrix4().makeRotationX(-LEAN);
  const base = M.basePos.clone().applyMatrix4(turn);
  return { turn, base, groundY: base.y - M.baseT / 2 };
}
