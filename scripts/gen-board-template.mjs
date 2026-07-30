// Generates a proportion-accurate, top-down board template (SVG) that matches
// the exact tile geometry the app uses. Paint / AI-generate art on top of it,
// then export a 2048x2048 PNG and drop it in as the board texture.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CORNER_SIZE = 2.4;
const EDGE_WIDTH = 1.55;
const RING_DEPTH = 2.4;
const BOARD_SIDE = 2 * CORNER_SIZE + 9 * EDGE_WIDTH; // 18.75
const HALF = BOARD_SIDE / 2;
const CORNER = HALF - CORNER_SIZE / 2;
const EDGE_START = HALF - CORNER_SIZE;
const ATLAS = 2048;
const PXW = ATLAS / BOARD_SIDE;

const COLOR = { brown: "#955436", lightblue: "#aae0fa", pink: "#d93a96", orange: "#f7941d",
  red: "#ed1b24", yellow: "#fef200", green: "#1fb25a", darkblue: "#0072bb" };

const TILES = [
  ["GO", "go"], ["Mediterranean Avenue", "property", "brown"], ["Community Chest", "vault"],
  ["Baltic Avenue", "property", "brown"], ["Income Tax", "tax"], ["Reading Railroad", "railroad"],
  ["Oriental Avenue", "property", "lightblue"], ["Chance", "chance"], ["Vermont Avenue", "property", "lightblue"],
  ["Connecticut Avenue", "property", "lightblue"], ["Jail", "jail"], ["St. Charles Place", "property", "pink"],
  ["Electric Company", "utility"], ["States Avenue", "property", "pink"], ["Virginia Avenue", "property", "pink"],
  ["Pennsylvania Railroad", "railroad"], ["St. James Place", "property", "orange"], ["Community Chest", "vault"],
  ["Tennessee Avenue", "property", "orange"], ["New York Avenue", "property", "orange"], ["Free Parking", "free"],
  ["Kentucky Avenue", "property", "red"], ["Chance", "chance"], ["Indiana Avenue", "property", "red"],
  ["Illinois Avenue", "property", "red"], ["B&O Railroad", "railroad"], ["Atlantic Avenue", "property", "yellow"],
  ["Ventnor Avenue", "property", "yellow"], ["Water Works", "utility"], ["Marvin Gardens", "property", "yellow"],
  ["Go To Jail", "gotojail"], ["Pacific Avenue", "property", "green"], ["North Carolina Avenue", "property", "green"],
  ["Community Chest", "vault"], ["Pennsylvania Avenue", "property", "green"], ["Short Line", "railroad"],
  ["Chance", "chance"], ["Park Place", "property", "darkblue"], ["Luxury Tax", "tax"], ["Boardwalk", "property", "darkblue"],
];

const edgeCoord = (k) => EDGE_START - (k + 0.5) * EDGE_WIDTH;
function place(i) {
  const C = (x, z, s) => ({ x, z, side: s, w: CORNER_SIZE, d: CORNER_SIZE });
  const E = (x, z, s) => ({ x, z, side: s, w: EDGE_WIDTH, d: RING_DEPTH });
  if (i === 0) return C(CORNER, CORNER, "bottom");
  if (i === 10) return C(-CORNER, CORNER, "left");
  if (i === 20) return C(-CORNER, -CORNER, "top");
  if (i === 30) return C(CORNER, -CORNER, "right");
  if (i < 10) return E(edgeCoord(i - 1), CORNER, "bottom");
  if (i < 20) return E(-CORNER, edgeCoord(i - 11), "left");
  if (i < 30) return E(-edgeCoord(i - 21), -CORNER, "top");
  return E(CORNER, -edgeCoord(i - 31), "right");
}

const ANGLE = { bottom: 0, top: 180, left: 90, right: -90 };
const HINT = { railroad: "TRAIN", chance: "?", vault: "CHEST", tax: "$", jail: "JAIL",
  free: "FREE\nPARKING", gotojail: "GO TO\nJAIL", go: "GO" };
const iconHint = (name, type) =>
  type === "utility" ? (name.includes("Water") ? "TAP" : "BULB") : HINT[type] || "";

let cells = "";
for (let i = 0; i < 40; i++) {
  const p = place(i);
  const [name, type, cg] = TILES[i];
  const horiz = p.side === "bottom" || p.side === "top";
  const ww = horiz ? p.w : p.d, wd = horiz ? p.d : p.w;
  const px = (p.x - ww / 2 + HALF) * PXW, py = (p.z - wd / 2 + HALF) * PXW;
  const pw = ww * PXW, ph = wd * PXW, cx = px + pw / 2, cy = py + ph / 2;

  cells += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#ffffff" stroke="#222" stroke-width="2"/>`;
  const band = cg ? COLOR[cg] : null;
  if (band) {
    const t = 0.26;
    let bx = px, by = py, bw = pw, bh = ph;
    if (p.side === "bottom") bh = ph * t;
    else if (p.side === "top") { by = py + ph * (1 - t); bh = ph * t; }
    else if (p.side === "left") { bx = px + pw * (1 - t); bw = pw * t; }
    else bw = pw * t;
    cells += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${band}" opacity="0.85"/>`;
  }
  const g = `<g transform="translate(${cx},${cy}) rotate(${ANGLE[p.side]})">`;
  const fs = i % 10 === 0 ? 30 : 20;
  const hint = iconHint(name, type);
  cells += g;
  cells += `<text x="0" y="${-ph * 0.28}" font-family="sans-serif" font-weight="700" font-size="16" fill="#8a94a6" text-anchor="middle">#${i}</text>`;
  cells += `<text x="0" y="0" font-family="sans-serif" font-weight="800" font-size="${fs}" fill="#20242e" text-anchor="middle">${escape(name.toUpperCase())}</text>`;
  if (hint) hint.split("\n").forEach((h, k) =>
    cells += `<text x="0" y="${ph * 0.2 + k * 22}" font-family="sans-serif" font-weight="700" font-size="18" fill="#b04632" text-anchor="middle">[${h}]</text>`);
  cells += `</g>`;
}

const inner0 = RING_DEPTH * PXW, innerS = (BOARD_SIDE - 2 * RING_DEPTH) * PXW;
const center = `
<rect x="${inner0}" y="${inner0}" width="${innerS}" height="${innerS}" fill="#eef4ec" stroke="#2a7d46" stroke-width="4" stroke-dasharray="16 12"/>
<text x="${ATLAS / 2}" y="${ATLAS / 2 - 40}" font-family="sans-serif" font-weight="900" font-size="44" fill="#2a7d46" text-anchor="middle">CENTER ART ZONE</text>
<text x="${ATLAS / 2}" y="${ATLAS / 2 + 10}" font-family="sans-serif" font-size="26" fill="#3a6" text-anchor="middle">logo / banner / stadium arcs go here</text>
<text x="${ATLAS / 2}" y="${ATLAS / 2 + 70}" font-family="sans-serif" font-size="22" fill="#888" text-anchor="middle">TOP-DOWN VIEW - 2048x2048 - paint over these guides, keep tile rects</text>
<text x="${ATLAS / 2}" y="${ATLAS / 2 + 106}" font-family="sans-serif" font-size="22" fill="#888" text-anchor="middle">[BRACKETS] = suggested icon per special tile - color band edge faces center</text>`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ATLAS}" height="${ATLAS}" viewBox="0 0 ${ATLAS} ${ATLAS}">
<rect width="${ATLAS}" height="${ATLAS}" fill="#d9cfa9"/>
${cells}
${center}
</svg>`;

function escape(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../web/public/board/board-template.svg");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg);
console.log("wrote", out, `(${svg.length} bytes)`);
