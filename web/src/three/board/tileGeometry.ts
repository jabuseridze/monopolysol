import * as THREE from "three";
import { TileRegion } from "./atlasLayout";

/**
 * Flat quad (in the XZ plane, facing +Y) sized to the tile's world footprint,
 * with UVs pinned to the tile's region of the shared board atlas so the painted
 * art lines up exactly. Corners map so world -Z is the atlas top (v0).
 */
export function makeTileTop(r: TileRegion): THREE.BufferGeometry {
  const hw = r.ww / 2;
  const hd = r.wd / 2;
  const g = new THREE.BufferGeometry();

  // A(-x,-z) B(+x,-z) C(+x,+z) D(-x,+z)
  const pos = new Float32Array([
    -hw, 0, -hd,
    hw, 0, -hd,
    hw, 0, hd,
    -hw, 0, hd,
  ]);
  const uv = new Float32Array([
    r.u0, r.v0,
    r.u1, r.v0,
    r.u1, r.v1,
    r.u0, r.v1,
  ]);
  const idx = [0, 2, 1, 0, 3, 2]; // upward-facing winding

  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
