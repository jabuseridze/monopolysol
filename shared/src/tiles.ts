/**
 * Board configuration - single source of truth for the 40 tiles.
 * Names match the Meme Mogul: SOL Edition board art.
 */

export type TileType =
  | "go"
  | "property"
  | "railroad"
  | "utility"
  | "chance"
  | "vault"
  | "tax"
  | "jail"
  | "free"
  | "gotojail";

export type ColorGroup =
  | "brown"
  | "lightblue"
  | "pink"
  | "orange"
  | "red"
  | "yellow"
  | "green"
  | "darkblue";

export interface Tile {
  index: number;
  name: string;
  type: TileType;
  colorGroup?: ColorGroup;
  /** Display price; purely flavor for the UI. */
  price?: number;
}

export const COLOR_HEX: Record<ColorGroup, string> = {
  brown: "#955436",
  lightblue: "#aae0fa",
  pink: "#d93a96",
  orange: "#f7941d",
  red: "#ed1b24",
  yellow: "#fef200",
  green: "#1fb25a",
  darkblue: "#0072bb",
};

export const TILES: Tile[] = [
  { index: 0, name: "GO", type: "go" },
  { index: 1, name: "Testnet Alley", type: "property", colorGroup: "brown", price: 60 },
  { index: 2, name: "Airdrop Crate", type: "vault" },
  { index: 3, name: "Faucet Lane", type: "property", colorGroup: "brown", price: 60 },
  { index: 4, name: "Gas Fee", type: "tax", price: 200 },
  { index: 5, name: "Warp Bridge", type: "railroad", price: 200 },
  { index: 6, name: "Ape Avenue", type: "property", colorGroup: "lightblue", price: 100 },
  { index: 7, name: "Random Pump", type: "chance" },
  { index: 8, name: "Pump Plaza", type: "property", colorGroup: "lightblue", price: 100 },
  { index: 9, name: "Degen Drive", type: "property", colorGroup: "lightblue", price: 120 },
  { index: 10, name: "Paper Hands Jail", type: "jail" },
  { index: 11, name: "Moon Boulevard", type: "property", colorGroup: "pink", price: 140 },
  { index: 12, name: "Laser Eyes Lane", type: "property", colorGroup: "pink", price: 140 },
  { index: 13, name: "Diamond Hands Way", type: "property", colorGroup: "pink", price: 160 },
  { index: 14, name: "Validator Power", type: "utility", price: 150 },
  { index: 15, name: "Mempool Metro", type: "railroad", price: 200 },
  { index: 16, name: "Liquidity Pool Road", type: "property", colorGroup: "orange", price: 180 },
  { index: 17, name: "Airdrop Crate", type: "vault" },
  { index: 18, name: "Slippage Street", type: "property", colorGroup: "orange", price: 180 },
  { index: 19, name: "Whale Wharf", type: "property", colorGroup: "orange", price: 200 },
  { index: 20, name: "Free Mint", type: "free" },
  { index: 21, name: "Candle Court", type: "property", colorGroup: "red", price: 220 },
  { index: 22, name: "Random Pump", type: "chance" },
  { index: 23, name: "Fomo Freeway", type: "property", colorGroup: "red", price: 220 },
  { index: 24, name: "Rocket Row", type: "property", colorGroup: "red", price: 240 },
  { index: 25, name: "Rollup Rail", type: "railroad", price: 200 },
  { index: 26, name: "Staking Summit", type: "property", colorGroup: "yellow", price: 260 },
  { index: 27, name: "Validator View", type: "property", colorGroup: "yellow", price: 260 },
  { index: 28, name: "Oracle Feed", type: "utility", price: 150 },
  { index: 29, name: "Airdrop Heights", type: "property", colorGroup: "yellow", price: 280 },
  { index: 30, name: "Get Rugged", type: "gotojail" },
  { index: 31, name: "Yield Yard", type: "property", colorGroup: "green", price: 300 },
  { index: 32, name: "Alpha Acres", type: "property", colorGroup: "green", price: 300 },
  { index: 33, name: "Airdrop Crate", type: "vault" },
  { index: 34, name: "Bull Run Boulevard", type: "property", colorGroup: "green", price: 320 },
  { index: 35, name: "Ledger Line", type: "railroad", price: 200 },
  { index: 36, name: "Random Pump", type: "chance" },
  { index: 37, name: "Genesis Grand", type: "property", colorGroup: "darkblue", price: 350 },
  { index: 38, name: "Slippage Tax", type: "tax", price: 100 },
  { index: 39, name: "Sol Summit", type: "property", colorGroup: "darkblue", price: 400 },
];

export const NUM_TILES = TILES.length;

export function getTile(index: number): Tile | undefined {
  return TILES[index];
}
