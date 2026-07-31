import * as THREE from "three";

/**
 * Flat rectangular picture-frame (outer rect minus a smaller inner-rect
 * hole), so a "brighter edge glow" renders as a solid, cleanly anti-aliased
 * mesh rather than a native WebGL line -- 1px GL_LINES render unreliably
 * (dashed, patchy) at the oblique angles the board is viewed from.
 */
export function frameGeometry(w: number, d: number, thickness: number): THREE.ShapeGeometry {
  const iw = Math.max(w - thickness * 2, 0.05);
  const id = Math.max(d - thickness * 2, 0.05);
  const shape = new THREE.Shape()
    .moveTo(-w / 2, -d / 2)
    .lineTo(w / 2, -d / 2)
    .lineTo(w / 2, d / 2)
    .lineTo(-w / 2, d / 2)
    .lineTo(-w / 2, -d / 2);
  shape.holes.push(
    new THREE.Path()
      .moveTo(-iw / 2, -id / 2)
      .lineTo(iw / 2, -id / 2)
      .lineTo(iw / 2, id / 2)
      .lineTo(-iw / 2, id / 2)
      .lineTo(-iw / 2, -id / 2),
  );
  return new THREE.ShapeGeometry(shape);
}
