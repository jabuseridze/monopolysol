import * as THREE from "three";

/** Pip layout (row, col in a 3x3 grid) per face value, standard die-face
 * patterns. */
const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

const FACE_PX = 128;

function pipTexture(value: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = FACE_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f1e8";
  ctx.fillRect(0, 0, FACE_PX, FACE_PX);
  ctx.strokeStyle = "#c9c3ae";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, FACE_PX - 4, FACE_PX - 4);

  ctx.fillStyle = "#181418";
  const cell = FACE_PX / 3;
  const r = cell * 0.24;
  for (const [row, col] of PIP_LAYOUTS[value] ?? []) {
    ctx.beginPath();
    ctx.arc(cell * col + cell / 2, cell * row + cell / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Face normal, in the cube's rest frame, that carries each die value --
 * standard Western die convention, opposite faces sum to 7. Must stay in
 * sync with `FACE_MATERIAL_ORDER` below. */
const FACE_NORMALS: Record<number, THREE.Vector3> = {
  1: new THREE.Vector3(0, 1, 0),
  6: new THREE.Vector3(0, -1, 0),
  3: new THREE.Vector3(1, 0, 0),
  4: new THREE.Vector3(-1, 0, 0),
  2: new THREE.Vector3(0, 0, 1),
  5: new THREE.Vector3(0, 0, -1),
};

/** `BoxGeometry`'s material-group order is [+X, -X, +Y, -Y, +Z, -Z]. */
const FACE_MATERIAL_ORDER = [3, 4, 1, 6, 2, 5];

let cachedMaterials: THREE.MeshStandardMaterial[] | null = null;

/** Six face materials shared by every `Die` instance -- both dice show the
 * same six faces; only their orientation (see `landingQuaternion`) differs. */
export function dieFaceMaterials(): THREE.MeshStandardMaterial[] {
  if (!cachedMaterials) {
    cachedMaterials = FACE_MATERIAL_ORDER.map(
      (v) => new THREE.MeshStandardMaterial({ map: pipTexture(v), roughness: 0.45 }),
    );
  }
  return cachedMaterials;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Quaternion that rotates the die so the face carrying `value` (1-6) points
 * straight up -- the exact orientation the tumble must snap to. Built from
 * `FACE_NORMALS`, so it's exact by construction rather than eyeballed.
 */
export function landingQuaternion(value: number): THREE.Quaternion {
  const normal = FACE_NORMALS[value];
  if (!normal) throw new Error(`invalid die value ${value}`);
  return new THREE.Quaternion().setFromUnitVectors(normal, UP);
}
