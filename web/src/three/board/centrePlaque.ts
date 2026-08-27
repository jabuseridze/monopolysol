import * as THREE from "three";

/** The board's name, in one place. Everything user-facing reads it from here so
 * the plaque, the page title and the landing screen cannot drift apart. */
export const BOARD_NAME = "MONOPOLYSOL";

/**
 * Repaint the board's centre plaque.
 *
 * The wordmark is not text in the scene and not data anywhere -- it is pixels
 * baked into `board-art.png`, a hand-authored texture with no generator. Rather
 * than ship a second large binary that nobody can grep or diff, this paints a
 * replacement plaque over the original at load time, which keeps the name a
 * constant in code.
 *
 * The new plaque is deliberately larger than the old one in both dimensions so
 * it covers it completely. That avoids having to clear the area first, which
 * would mean matching the field's subtle gradient and would leave a visible
 * seam if the match were even slightly off.
 *
 * All coordinates are in the texture's own 1024x1024 space, measured off the
 * source image: the original plaque spans roughly x 352-676, y 449-517, centred
 * at (512, 482) and axis-aligned. (It looks diagonal in game only because the
 * board is viewed at an angle.)
 */
const ATLAS = 1024;
const CENTRE_X = 512;
const CENTRE_Y = 482;
/** Comfortably wider and taller than the original 322x68 plaque. */
const PLAQUE_W = 430;
const PLAQUE_H = 88;

/** Sampled from the source art: the deep plaque purple, its lime keyline, and
 * the lime the wordmark is set in. */
const PLAQUE_FILL = "#3c0f8f";
const PLAQUE_EDGE = "#cdf537";
const TEXT_FILL = "#cdf537";
const TEXT_STROKE = "#280858";

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Composite the board texture with a fresh centre plaque.
 *
 * Returns a `CanvasTexture`; the caller owns disposing it. `document.fonts.ready`
 * should be awaited first, or the canvas silently falls back to a default face
 * and the wordmark looks nothing like the rest of the UI.
 */
export function compositeBoardTexture(source: CanvasImageSource): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(source, 0, 0, ATLAS, ATLAS);

  const x = CENTRE_X - PLAQUE_W / 2;
  const y = CENTRE_Y - PLAQUE_H / 2;

  // Soft drop shadow, matching the original plaque's lift off the field.
  ctx.save();
  ctx.shadowColor = "rgba(20, 6, 48, 0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  roundedRect(ctx, x, y, PLAQUE_W, PLAQUE_H, 22);
  ctx.fillStyle = PLAQUE_FILL;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, x, y, PLAQUE_W, PLAQUE_H, 22);
  ctx.lineWidth = 5;
  ctx.strokeStyle = PLAQUE_EDGE;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Fredoka if the document has it, else a heavy fallback. Sized to fit the
  // longer name inside the plaque with breathing room at both ends.
  ctx.font = `700 52px Fredoka, ui-sans-serif, system-ui, sans-serif`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = TEXT_STROKE;
  ctx.strokeText(BOARD_NAME, CENTRE_X, CENTRE_Y + 2);
  ctx.fillStyle = TEXT_FILL;
  ctx.fillText(BOARD_NAME, CENTRE_X, CENTRE_Y + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
