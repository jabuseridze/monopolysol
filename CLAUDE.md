# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Chain Estates** (codename MonopolySOL) is a 3D property-draw game on Solana Devnet. Players connect a wallet, pick a property on a 3D board, and every ~2 minutes a provably-fair random draw selects a winning property. Everyone who picked the winning property splits a house-funded prize.

- **Currency:** Devnet SOL (free from faucet) — no real money at risk
- **Status:** Not audited; Devnet only. Reference art is placeholders; rebrand before mainnet
- **Tech Stack:** Anchor (Rust on-chain), Node.js coordinator (Socket.IO), Next.js + React Three Fiber (frontend)

## Monorepo Structure

This is a **pnpm workspace** with four packages:

| Package | Purpose | Language | Deployment |
|---------|---------|----------|-----------|
| `shared/` | Board config, types, constants consumed by all packages | TypeScript | npm workspace |
| `program/` | Anchor (Rust) smart contract; owns rounds, picks, vault, payouts | Rust + TypeScript tests | Solana Devnet |
| `server/` | Express + Socket.IO coordinator; drives 2-min loop, settles winners | Node.js/TypeScript | Render |
| `web/` | Next.js + React Three Fiber; 3D board, hologram draw, HUD | React/TypeScript | Vercel |

### Key Architectural Insight: The Round Loop

The coordinator (server) orchestrates the game loop:

1. **Open phase:** Coordinator posts round on-chain (`open_round`), broadcasts state to web clients
2. **Pick phase:** Players send `pick_tile` txs; coordinator listens via WS and re-broadcasts
3. **Reveal phase:** After window closes, coordinator reveals the seed, calls `reveal_and_draw` on-chain
4. **Settlement:** Coordinator counts winners on-chain state, broadcasts results to all players

**Randomness:** Commit–reveal scheme: coordinator commits `keccak256(seed)` on-chain before picks open, then reveals `seed` after. The program verifies the hash and computes `winning_tile = keccak256(seed ‖ round_id) % num_tiles`.

## Common Development Commands

### Setup
```bash
pnpm install                  # Install all workspace dependencies
```

### Type Checking (all packages)
```bash
pnpm typecheck                # Run TypeScript checking across workspace
```

### Linting (all packages)
```bash
pnpm lint                     # Run linters across workspace
```

### Web Frontend
```bash
pnpm dev:web                  # Run Next.js dev server (localhost:3000)
pnpm build:web                # Production build
```

### Server Coordinator
```bash
pnpm dev:server               # Run Express + Socket.IO dev server (localhost:4000)
pnpm build:server             # Production build
```

### On-Chain Program (Rust)
```bash
cd program
anchor build                  # Compile to WASM
anchor test                   # Run mocha test suite (spins up local validator)
anchor deploy --provider.cluster devnet  # Deploy to Devnet
anchor migrate --provider.cluster devnet # Initialize on-chain (config + fund treasury)
```

### Single Test (Program)
```bash
cd program
pnpm test                     # Runs `anchor test` via package.json script
```

## Configuration & Environment Variables

### Shared (committed)
| File | Purpose |
|------|---------|
| `shared/src/constants.ts` | Round duration, prize, timings (DRAW_SEQUENCE_SEC, etc.) |
| `shared/src/tiles.ts` | Board definition; fully data-driven (tile names, colors, grid layout) |

### Server (.env, not committed)
```bash
cd server && cp .env.example .env
# Set:
#   PROGRAM_ID=<deployed_id>           # From anchor keys list
#   AUTHORITY_KEYPAIR_PATH=~/.config/solana/id.json
#   WEB_ORIGIN=http://localhost:3000   # For CORS (Vercel URL in prod)
#   RPC_URL=https://api.devnet.solana.com
```

### Web (.env.local, not committed)
```bash
cd web && cp .env.example .env.local
# Set:
#   NEXT_PUBLIC_PROGRAM_ID=<deployed_id>
#   NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
#   NEXT_PUBLIC_WS_URL=http://localhost:4000   # Render URL in prod
```

### Program (Anchor.toml, committed)
- `programs.devnet.monopoly`: Current Devnet program ID (synced via `anchor keys sync`)
- `provider.wallet`: Path to local keypair (~/.config/solana/id.json)

## Key Implementation Files

### Shared (`shared/src/`)
- **tiles.ts:** Board definition with 12 properties (names, colors, positions). Edit here to retheme.
- **constants.ts:** PRIZE, ROUND_DURATION_SEC, DRAW_SEQUENCE_SEC, etc.
- **types.ts:** Shared TypeScript types for rounds, picks, settlement
- **layout.ts:** Anchor account layout definitions (deserializer for on-chain state)

### Server (`server/src/`)
- **index.ts:** Express setup, WebSocket listener for client messages
- **roundLoop.ts:** Core 2-min loop: open → listen → reveal → settle
- **chain.ts:** Solana RPC calls (open_round, pick_tile, reveal_and_draw)
- **anchorCodec.ts:** Anchor account deserialization
- **pdas.ts:** Program Derived Addresses (config, treasury, round, picks)

### Web (`web/src/`)
- **app/**: Next.js app router; root layout, page
- **components/**: Wallet adapter, HUD, game state UI
- **three/**: React Three Fiber scene setup
  - **Hologram.tsx:** Spinning draw sequence animation
  - **Board.tsx:** 3D board mesh, tile highlighting
  - **Figurines.tsx:** Player figurines (procedural lowpoly models)

### Program (`program/programs/monopoly/src/`)
- **lib.rs:** Anchor program; accounts & instruction handlers for `open_round`, `pick_tile`, `reveal_and_draw`, `settle`, `claim_prize`
- **tests/**: Mocha suite covering happy path, two-winner split, bad-reveal rejection

## Deployment

### Web → Vercel
1. Import repo to Vercel
2. **Root Directory:** repository root (not `web/`)
3. **Build command** and other settings are in `vercel.json`
4. Set env vars:
   - `NEXT_PUBLIC_RPC_URL`
   - `NEXT_PUBLIC_PROGRAM_ID`
   - `NEXT_PUBLIC_WS_URL` (Render coordinator URL)

### Coordinator → Render
1. **Blueprint:** `render.yaml` is ready to use
2. **Service type:** Node web service (persistent process for Socket.IO)
3. Set secrets:
   - `PROGRAM_ID`
   - `AUTHORITY_KEYPAIR` (as inline JSON byte array — **never commit**)
   - `WEB_ORIGIN` (Vercel URL for CORS)
   - `RPC_URL`

### On-Chain Program → Solana Devnet
```bash
solana config set --url devnet
solana-keygen new              # If no wallet yet
solana airdrop 2               # Fund deployer
cd program
anchor build
anchor keys sync               # Syncs program ID into Anchor.toml and code
anchor build                   # Rebuild with synced ID
anchor deploy --provider.cluster devnet
anchor migrate --provider.cluster devnet  # Initializes on-chain state
```

The wallet that runs `migrate` becomes the **authority** and must sign all coordinator transactions.

## Data Flow & Request Paths

**Player picks a tile:**
- Web sends `pick_tile { player_wallet, tile_index }` via Socket.IO to coordinator
- Coordinator constructs + signs `pick_tile` instruction, submits to chain
- Chain verifies one-pick-per-wallet, stores pick, broadcasts re-read state back to web

**Draw (2-min timer fires):**
- Coordinator calls `reveal_and_draw` with revealed seed
- Program verifies `keccak256(seed)` matches the on-chain commit
- Program computes `winning_tile = keccak256(seed ‖ round_id) % num_tiles`
- Program transfers prize lamports to winners or re-funds authority if none picked

**Randomness verification:** Anyone with the revealed seed can independently recompute the draw result using the same hash function.

## Important Notes

- **Not for mainnet:** No audit, reference art is placeholder. Legal/security review required before real money.
- **Authority model:** Winner count is currently supplied by authority in `settle`. Future: on-chain counting or VRF.
- **Audio:** Synthesized via Web Audio API (no binary assets).
- **Figurines:** Procedural low-poly models; drop in CC0 GLTF models if needed.
- **Test coverage:** Program has happy path, split payout, double-pick rejection, bad-reveal tests.

## Troubleshooting

- **"Program not found" on-chain:** Verify `PROGRAM_ID` matches `anchor keys list` output and `Anchor.toml`
- **Coordinator crashes:** Check `AUTHORITY_KEYPAIR_PATH` exists and points to valid keypair
- **Web can't connect to coordinator:** Verify `NEXT_PUBLIC_WS_URL` is set and coordinator is running
- **Transactions fail:** Ensure Devnet RPC is reachable and coordinator has SOL for fees
