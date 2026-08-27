# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Chain Estates** (codename MonopolySOL) is a 3D dice-guessing game on Solana. Players connect a wallet and guess the **sum of two dice** (2–12) on one of eleven hologram pads. Every ~2 minutes a provably-fair commit–reveal draw rolls the dice, an avatar walks that many tiles around the 40-tile board, and everyone who guessed the correct sum splits a house-funded prize.

The tile the avatar *lands on* does not decide the winner — the dice sum does. Landing only applies a prize modifier to the **next** round (GO bonus, Random Pump, Gas Fee, Get Rugged, Slippage Tax); see `shared/src/effects.ts`.

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
2. **Guess phase:** Players **paste a wallet address** — there is no wallet extension and nothing to connect. The client asks the coordinator over Socket.IO (`client:guess`, acked) and the **coordinator signs and funds the pick on the player's behalf**. See "Walletless play" below
3. **Reveal phase:** After the window closes, the coordinator reveals the seed and calls `reveal_and_draw`
4. **Settlement:** Coordinator calls `settle`, broadcasts the result **immediately**, then drains a background payout queue (~1s apart) — the next round opens without waiting for payouts

**Randomness:** Commit–reveal: the coordinator commits `keccak256(seed)` on-chain before guessing opens, then reveals `seed` after. The program verifies the hash and derives both dice from `keccak256(seed ‖ round_id)`.

**Winner counting:** `settle` takes **no winner count**. `tally` visits every pick in batches
(`remaining_accounts`), re-derives each PDA before counting it, and marks it `counted` so a retried
batch is a no-op. `settle` refuses until `round.tallied == round.total_picks`, so the divisor
`payout` uses is derived by the chain rather than asserted by the coordinator.

**Payouts:** `payout` is **permissionless** — the destination is pinned on-chain to the pick's own player and a `claimed` flag makes it idempotent, so anyone may pay a winner and nobody can redirect a prize. That is what lets the coordinator auto-pay, and what makes the results modal's "Resend payout" button safe to expose to anybody.

### Walletless play — read before changing `submit_guess`

There is **no wallet connection anywhere in the app**. Players paste an address; the coordinator
signs and pays for their pick. Three properties hold this together, and breaking any one of them
breaks the game's security:

1. **`submit_guess` is authority-only** (`payer` is constrained to `config.authority`). The player is
   a plain `UncheckedAccount` that never signs. Removing that constraint would let anyone create
   picks for any address straight against the program, out of reach of every server-side limit.
2. **The token gate is checked against `player`, never the signer.** `token_gate::enforce` reads the
   *owner field out of the token account's own bytes*, so not even the coordinator can pass someone
   else's holdings to sneak a non-holder in (there is a test for exactly this).
3. **Prizes are pinned to `pick.player`.** The coordinator can choose *whether* you are paid, never
   *who* is paid.

**Accepted trade-offs (decided 2026-08-27 — do not silently "fix" these):**

- The coordinator is now **required** to play, and it **asserts intent**: it says which number you
  picked, where your signature used to prove it. A buggy or dishonest operator could submit a
  different number. Inherent to walletless play.
- **Griefing is possible.** Anyone who knows an address can ask the coordinator to guess for it,
  burning that address's one pick for the round. They cannot steal the prize. Mitigated by rate
  limits in `server/src/guessIntake.ts` only.
- **The house pays ~0.0013 SOL of rent per guess.** `close_pick` + `pickSweeper.ts` reclaim it after
  settlement; without that sweep the outflow is permanent and unbounded. `guessIntake.ts` also
  enforces a balance floor and a per-round pick cap so a burst cannot empty the authority wallet.

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
- **tiles.ts:** Board definition, 40 tiles (names, colors, positions). Edit here to retheme.
- **constants.ts:** PRIZE, ROUND_DURATION_SEC, the draw beat sheet (`BEAT_*_MS`, `WALK_STEP_MS`), SOCKET_EVENTS
- **effects.ts:** Landing-tile prize modifiers for the next round. Pure, and unit-tested.
- **ringPath.ts:** Walk geometry — where the avatar stands and which way it faces at step *n*. Pure.
- **explorer.ts:** Cluster-aware Solscan links; returns nothing on localnet, which Solscan cannot index.
- **types.ts:** Shared DTOs for rounds, guesses, settlement, payout progress

### Server (`server/src/`)
- **index.ts:** Express setup, Socket.IO wiring, presence, and the two acked client requests (`client:guess`, `client:retryPayout`)
- **guessIntake.ts:** Validation, rate limits and the spend cap for coordinator-submitted guesses. The only place a player request becomes a transaction the house pays for.
- **pickSweeper.ts:** Closes settled picks to reclaim rent. Retries winners, whose picks cannot close until they are paid.
- **roundLoop.ts` / `roundPhases.ts`:** The round cycle: open → guess window → reveal → settle
- **payouts.ts:** Background payout queue (~1s spacing, retry with backoff). Runs *outside* the round loop so a slow payout never stalls the game.
- **chain.ts:** Solana RPC calls (`open_round`, `submit_guess`, `reveal_and_draw`, `settle`, `payout`, `close_pick`)
- **anchorCodec.ts:** Anchor account deserialization (hardcoded offsets — see the append-only rule below)
- **pdas.ts:** Program Derived Addresses (config, treasury, round, picks)

### Web (`web/src/`)
- **app/**: Next.js app router; `globals.css` holds the palette tokens, `hud.css` the HUD
- **components/**: HUD — wallet bar, countdown, guess panel, presence readout, results modal
- **hooks/useIdentity.tsx:** The pasted address — the app's only identity. There is no wallet adapter.
- **lib/connection.ts:** The single read-only RPC connection. The client never builds or signs a transaction, so there is no instruction-building code left.
- **lib/audio/**: Fully synthesised. `synth.ts` primitives → `sfx.ts` (UI cues) + `drawCues.ts` (draw sheet) + `music.ts` (generative lobby bed)
- **three/**: React Three Fiber scene
  - **Board.tsx:** 3D board mesh, tile highlighting
  - **Avatar.tsx:** The walking piece (KayKit Knight GLB)
  - **GuessPads.tsx` / `PadChip.tsx`:** The eleven 2–12 hologram pads and their per-guess counts
  - **Figurines.tsx:** Background wanderers — KayKit GLB models, **not** procedural. Two by default; each additional model is ~3.4 MB preloaded on page load (`assets.ts`).

### Program (`program/programs/monopoly/src/`)
- **lib.rs:** Instruction handlers: `initialize`, `open_round`, `submit_guess`, `reveal_and_draw`, `settle`, `payout`, `fund_treasury`, `set_gate`, `set_params`, `close_pick`
- **set_params.rs:** Retune round duration and prize without wiping the chain. Before it existed the only way to change either was a fresh chain — fine locally, destructive anywhere real.
- **token_gate.rs:** Optional SPL holder gate. Parses the token account layout **by hand** — `anchor-spl` pulls in a borsh version that conflicts with `anchor-lang`'s.
- **tests/**: Mocha suites. `Anchor.toml` lists them explicitly and the order is load-bearing — `monopoly.gate.ts` must stay last (it arms the gate and leaves rounds unsettled).

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

**Player guesses a dice sum:**
- The player pastes an address. The client emits `client:guess { address, sum }` and waits for the ack.
- `server/src/guessIntake.ts` validates and rate-limits, then the coordinator signs `submit_guess` with itself as `payer` and the pasted address as a **non-signing** `player`.
- The chain enforces one guess per address per round (the pick PDA is seeded on round + player, so a second attempt fails with "already in use") and, when armed, the token gate — checked against the *pasted address*, never the signer.
- The coordinator observes the new pick when it next polls `getProgramAccounts`, and re-broadcasts the updated counts.

**Draw (round timer fires):**
- Coordinator calls `reveal_and_draw` with the revealed seed
- Program verifies `keccak256(seed)` matches the on-chain commit, then derives both dice from the hash
- Coordinator calls `settle`, **broadcasts the result immediately**, and hands the winners to the background payout queue

**Randomness verification:** anyone with the revealed seed can recompute the dice independently using the same hash function.

## Important Notes

- **Not for mainnet:** No audit, reference art is placeholder. Legal/security review required before real money.
- **Authority model:** Winner count is currently supplied by authority in `settle`. Future: on-chain counting or VRF.
- **Audio:** Fully synthesised via Web Audio API — no binary assets. The lobby bed is *generated*, not a clip, so it fits any round length. Cues are scheduled on the audio clock in one pass, never with `setTimeout` (which jitters enough to visibly desync a dice clatter from the die landing).
- **Figurines:** KayKit CC0 GLB models, not procedural. Keep the count low — they preload eagerly.
- **Test coverage:** Program covers happy path, split payout, double-guess rejection, bad reveal, and the token gate.

### Money-safety invariants — do not weaken

- **The commit-reveal seed is derived, never stored**: `HMAC(MASTER_SECRET, round_id)` in
  `server/src/secrets.ts`. It used to live in `.round-secret.json`, and because Render's filesystem
  is ephemeral, any redeploy landing mid-round destroyed the only copy of the preimage — leaving a
  round that could never be revealed, players who could never be paid, and a loop retrying forever.
  `MASTER_SECRET` is as sensitive as the authority key and must stay **stable**; rotating it
  mid-round strands that round exactly as the file loss did.
- **`expire_round` is permissionless on purpose.** It exists for the case where the authority itself
  is gone, so gating it on the authority would make it useless. It moves no lamports — the prize is
  never escrowed (`open_round` only *checks* the treasury balance), so a stuck round strands state,
  not funds: `payout` and `close_pick` both gate on a terminal phase.
- **The upgrade authority is live.** Whoever holds it can replace the program and drain the
  treasury. Burn it or move it to a multisig before real money.
- **`WEB_ORIGIN` is a CORS allowlist.** Vercel preview deployments get unique URLs and will be
  blocked unless listed.

### Constraints that are easy to break silently

- **`PlayerPick` is 53 bytes** — `server/src/chain.ts` filters on `dataSize: 53`. A stale value there
  returns zero picks with no error, which silently breaks settlement. The trailing byte is `counted`,
  added when winner counting moved on-chain.
- **`GlobalConfig` changes must be append-only** — `server/src/anchorCodec.ts` reads hardcoded byte offsets.
- **`GameError` variants must be appended**, never reordered — the discriminant is the wire format.
- **The web client never touches the chain for writes.** Instruction account lists live in `server/src/chain.ts` and must be edited by hand to match the Rust; a rename means recomputing `sha256("global:<name>")[..8]`.
- **`.overlay` is `pointer-events: none`** with `auto` restored on its children. HUD components must be direct children of it (i.e. rendered from `Hud`), or they silently receive no clicks.

### Scale

Sized for ~100 concurrent players, not 10k. The known ceiling is `getProgramAccounts`: pick PDAs are never closed, so the RPC node's scan grows with total game history rather than with the current round. Fixing that needs an index, not a smaller payload. **A paid RPC endpoint is required before any real traffic** — server and client endpoints are configured separately (`RPC_URL` vs `NEXT_PUBLIC_RPC_URL`) so they can point at different providers.

## Troubleshooting

- **"Program not found" on-chain:** Verify `PROGRAM_ID` matches `anchor keys list` output and `Anchor.toml`
- **Coordinator crashes:** Check `AUTHORITY_KEYPAIR_PATH` exists and points to valid keypair
- **Web can't connect to coordinator:** Verify `NEXT_PUBLIC_WS_URL` is set and coordinator is running
- **Transactions fail:** Ensure Devnet RPC is reachable and coordinator has SOL for fees
