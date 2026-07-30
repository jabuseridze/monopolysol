# Chain Estates — a 3D property-draw game on Solana

A captivating, provably-fair party game on Solana Devnet. Players connect a
wallet, pick a property on a 3D board, and **every ~2 minutes** a spinning yellow
hologram lands on one random property. Everyone who picked the winning property
splits a house-funded prize.

> **Currency:** Devnet SOL (free from a faucet) — real end-to-end on-chain flow
> with **no real money at risk**. Rebrand + audit before ever touching mainnet.

---

## What's in the box

```
MonopolySOL/
├── shared/     TypeScript board config + shared types/constants (workspace pkg)
├── program/    Anchor (Rust) on-chain program + tests
├── server/     Node + Socket.IO round coordinator (deploys to Render)
├── web/        Next.js + React Three Fiber frontend (deploys to Vercel)
├── render.yaml Render blueprint (coordinator)
└── vercel.json Vercel config (web)
```

### Architecture

- **Program (Devnet):** owns rounds, picks, the treasury vault, and payouts.
- **Coordinator (Render):** drives the 2-minute loop, commits/reveals the random
  seed, settles winners, and streams live state to browsers over WebSocket.
- **Web (Vercel):** the 3D board, animated figurines, hologram draw, and HUD.

### Provably-fair randomness (commit–reveal)

1. Before picks open, the coordinator generates a secret `seed` and publishes
   `keccak256(seed)` on-chain (`open_round`).
2. Players pick tiles (`pick_tile`) — one pick per wallet per round.
3. After the window closes, the coordinator reveals `seed` (`reveal_and_draw`).
   The program verifies `keccak256(seed)` matches the commit and computes
   `winning_tile = keccak256(seed ‖ round_id) % num_tiles`.

Anyone with the revealed seed can independently verify the result. (A future
upgrade can swap commit–reveal for on-chain VRF — ORAO/Switchboard — for full
trustlessness in real-money mode.)

---

## Prerequisites

- **Node ≥ 18** and **pnpm** (`npm i -g pnpm`)
- For the on-chain program only:
  - **Rust** — https://rustup.rs
  - **Solana CLI** — https://docs.solanalabs.com/cli/install
  - **Anchor 0.30.1** — `cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.30.1 && avm use 0.30.1`

## 1) Install

```bash
pnpm install
```

## 2) Build, deploy & initialize the program (Devnet)

```bash
solana config set --url devnet
solana-keygen new                 # if you don't have a wallet yet
solana airdrop 2                  # fund the deployer

cd program
anchor build
anchor keys sync                  # writes the real program id into the code + Anchor.toml
anchor build                      # rebuild with the synced id
anchor deploy --provider.cluster devnet
anchor migrate --provider.cluster devnet   # initialize config + fund treasury
```

Copy the deployed **program id** (`anchor keys list`) — you'll paste it into both
`.env` files below. The wallet that ran `migrate` is the **authority**; the
coordinator must sign with this same keypair.

## 3) Run the coordinator (server)

```bash
cd server
cp .env.example .env
# edit .env:
#   PROGRAM_ID=<deployed id>
#   AUTHORITY_KEYPAIR_PATH=~/.config/solana/id.json   (the authority from step 2)
pnpm dev
```

## 4) Run the web app

```bash
cd web
cp .env.example .env.local
# edit .env.local:
#   NEXT_PUBLIC_PROGRAM_ID=<deployed id>
#   NEXT_PUBLIC_WS_URL=http://localhost:4000
pnpm dev        # http://localhost:3000
```

Open the app, connect Phantom/Solflare (set to **Devnet**), hit **Faucet** for
Devnet SOL, and click a property to join the round.

---

## Running the program tests

```bash
cd program
anchor test    # spins up a local validator, runs the mocha suite
```

Covers: full happy path, two-winner split payout, double-pick rejection, and
bad-reveal rejection.

---

## Configuration knobs

| What | Where |
| --- | --- |
| Board tiles / names / colors | [`shared/src/tiles.ts`](shared/src/tiles.ts) |
| Prize, round duration, timings | [`shared/src/constants.ts`](shared/src/constants.ts) + migration args in [`program/migrations/deploy.ts`](program/migrations/deploy.ts) |
| Draw sequence length / spin | `DRAW_SEQUENCE_SEC` (shared) + `SPIN_SECONDS` in [`web/src/three/Hologram.tsx`](web/src/three/Hologram.tsx) |

The board is fully data-driven — re-theme the game by editing `tiles.ts` only.

---

## Deployment

### Web → Vercel

- Import the repo. Set **Root Directory = repository root** (a `vercel.json`
  configures `installCommand`, `buildCommand`, and `outputDirectory`).
- Env vars: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_PROGRAM_ID`,
  `NEXT_PUBLIC_WS_URL` (your Render URL, e.g. `https://<svc>.onrender.com`).

### Coordinator → Render

- `render.yaml` is a ready blueprint (Node web service, persistent process for
  Socket.IO — this is why it can't live on Vercel serverless).
- Secret env vars: `PROGRAM_ID`, `AUTHORITY_KEYPAIR` (inline JSON byte array of
  the authority key — **never commit it**), `WEB_ORIGIN` (your Vercel URL, for
  CORS), and `RPC_URL`.

---

## Notes & limitations

- **Not audited; Devnet only.** Do not deploy to mainnet without a security
  review and a rebrand (the reference art is Hasbro IP; tile names here are
  original crypto-themed placeholders).
- **Winner count** is currently supplied by the authority in `settle` (the
  winning *tile* is fully provable on-chain). Replace with on-chain counting or
  VRF for a trust-minimized real-money mode.
- **Audio** is synthesized via the Web Audio API (no binary assets). **Figurines**
  are procedural low-poly characters; drop in CC0 GLTF models later if desired.
```
