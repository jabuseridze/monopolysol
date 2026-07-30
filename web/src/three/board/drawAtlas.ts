import { COLOR_HEX, TILES, Tile } from "@monopoly-sol/shared";
import { PALETTE } from "../palette";
import { ATLAS_PX, TileRegion, tileRegion } from "./atlasLayout";

const ANGLE: Record<TileRegion["side"], number> = {
  bottom: 0,
  top: Math.PI,
  left: Math.PI / 2,
  right: -Math.PI / 2,
};

const TYPE_ACCENT: Partial<Record<Tile["type"], string>> = {
  railroad: "#1b1f2a",
  utility: "#e8a800",
  tax: "#c9a227",
  chance: "#f7941d",
  vault: "#3aa3ff",
};

/** Paint the whole board atlas (all 40 tiles) into a 2D context. */
export function drawBoardAtlas(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, ATLAS_PX, ATLAS_PX);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const tile of TILES) drawTile(ctx, tile, tileRegion(tile.index));
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, r: TileRegion) {
  const pad = 3;
  ctx.fillStyle = PALETTE.tile;
  roundRect(ctx, r.px + pad, r.py + pad, r.pw - pad * 2, r.ph - pad * 2, 10);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#00000022";
  ctx.stroke();

  const bandColor = tile.colorGroup ? COLOR_HEX[tile.colorGroup] : TYPE_ACCENT[tile.type];
  if (bandColor) drawBand(ctx, r, bandColor);

  // Text runs along the tile, reading from outside the board.
  ctx.save();
  ctx.translate(r.px + r.pw / 2, r.py + r.ph / 2);
  ctx.rotate(ANGLE[r.side]);
  const horiz = r.side === "bottom" || r.side === "top";
  const lineW = (horiz ? r.pw : r.ph) - 22;
  const short = horiz ? r.ph : r.pw;

  ctx.fillStyle = PALETTE.tileText;
  const big = r.isCorner ? 40 : 27;
  ctx.font = `800 ${big}px system-ui, sans-serif`;
  const lines = wrap(ctx, tile.name.toUpperCase(), lineW);
  const lh = big + 4;
  const yStart = -((lines.length - 1) * lh) / 2 - (tile.price ? short * 0.13 : 0);
  lines.forEach((ln, i) => ctx.fillText(ln, 0, yStart + i * lh, lineW));

  if (tile.price) {
    ctx.font = `700 ${big - 5}px system-ui, sans-serif`;
    ctx.fillStyle = "#4b5566";
    ctx.fillText(`$${tile.price}`, 0, yStart + lines.length * lh + 2, lineW);
  }
  ctx.restore();
}

function drawBand(ctx: CanvasRenderingContext2D, r: TileRegion, color: string) {
  const t = 0.26;
  ctx.fillStyle = color;
  if (r.side === "bottom") ctx.fillRect(r.px, r.py, r.pw, r.ph * t);
  else if (r.side === "top") ctx.fillRect(r.px, r.py + r.ph * (1 - t), r.pw, r.ph * t);
  else if (r.side === "left") ctx.fillRect(r.px + r.pw * (1 - t), r.py, r.pw * t, r.ph);
  else ctx.fillRect(r.px, r.py, r.pw * t, r.ph);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
