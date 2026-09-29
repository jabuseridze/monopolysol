# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Chain Estates** (codename MonopolySOL) is a 3D dice-guessing game on Solana. Players connect a wallet and guess the **sum of two dice** (2–12) on one of eleven hologram pads. Every ~2 minutes a provably-fair commit–reveal draw rolls the dice, an avatar walks that many tiles around the 40-tile board, and everyone who guessed the correct sum splits a house-funded prize.

The tile the avatar *lands on* does not decide the winner — the dice sum does. Landing only applies a prize modifier to the **next** round (GO bonus, Random Pump, Gas Fee, Get Rugged, Slippage Tax); see `shared/src/effects.ts`.

- **Currency:** whatever `RPC_URL` points at. Devnet = free test SOL; mainnet = **real money**. That one variable is the only difference.
- **Status:** Not audited. Reference art is placeholders; rebrand before mainnet
- **Tech Stack:** Node.js coordinator (Socket.IO + Postgres), Next.js + React Three Fiber (frontend)

### The game is OFF-CHAIN as of 2026-09-29 — read this first

There is **no smart contract any more**. The Anchor program in `program/` is kept,
untouched and still passing its 28 tests, but nothing deploys or calls it. Deploying it to
mainnet costs ~1.9 SOL of rent-exempt deposit, which was the only thing blocking launch,
and it bought exactly one property the game could do without: proof.

What replaced its two jobs:

| Was | Is now |
|-----|--------|
| Round/pick state in Solana accounts | Postgres (`server/src/db/`) |
| `payout` instruction from a keyless vault | `SystemProgram.transfer` from a normal wallet (`server/src/wallet.ts`) |
| Pick PDA seeding = one guess per address | `PRIMARY KEY (round_id, player)` |
| `PlayerPick.claimed` | `picks.paid`, set in the same transaction as the transfer |

**What this costs, stated plainly:** prizes are no longer pinned on-chain to the winner.
The address recorded when the guess was accepted is the only record of who is owed, so
**never let a caller-supplied address reach `payWinner`** — read it back from `picks`.
Commit-reveal survived unchanged, so the dice are still verifiable against a published
hash; what is gone is the chain *enforcing* that.

## Monorepo Structure

This is a **pnpm workspace** with four packages:

| Package | Purpose | Language | Deployment |
|---------|---------|----------|-----------|
| `shared/` | Board config, types, constants consumed by all packages | TypeScript | npm workspace |
| `program/` | **Dormant.** The old Anchor contract, kept so the move off-chain is one revert away | Rust + TypeScript tests | not deployed |
| `server/` | Express + Socket.IO coordinator; owns rounds, picks, payouts | Node.js/TypeScript | Render + Postgres |
| `web/` | Next.js + React Three Fiber; 3D board, hologram draw, HUD | React/TypeScript | Vercel |

### Key Architectural Insight: The Round Loop

The coordinator (server) orchestrates the game loop:

1. **Open phase:** Coordinator writes the round to Postgres with its commit hash, broadcasts state to web clients
2. **Guess phase:** Players **paste a wallet address** — there is no wallet extension and nothing to connect. The client asks the coordinator over Socket.IO (`client:guess`, acked) and the **coordinator signs and funds the pick on the player's behalf**. See "Walletless play" below
3. **Reveal phase:** After the window closes, the coordinator reveals the seed, derives the dice, walks the avatar and applies the landing tile's effect to the *next* round's prize
4. **Settlement:** The round is marked settled, the result is broadcast **immediately**, then a background payout queue drains (~1s apart) — the next round opens without waiting for payouts

**Randomness:** Commit–reveal, unchanged by the move off-chain. The coordinator publishes `keccak256(seed)` before guessing opens and reveals `seed` after; both dice come from `keccak256(seed ‖ round_id)`. The seed is *derived*, never stored — `HMAC(MASTER_SECRET, round_id)` in `server/src/secrets.ts` — so any restart can recompute it.

**This is now a promise rather than a proof.** Nothing forces the operator to publish honestly. Rotating `MASTER_SECRET` mid-round makes the revealed seed fail to open the published commit, which is exactly the evidence a player would cite to call the game rigged.

**Winner counting:** a `SELECT` on `picks` for the winning sum. The share is
`floor(prize / winners)`, and the remainder stays in the wallet — paying `ceil` to everyone
would spend more than the prize.

**Payouts:** `payOnce` (`server/src/db/picks.ts`) claims the pick row `FOR UPDATE`, re-checks
`paid` inside the transaction, sends, then records the signature. That is the whole defence
against a double payout on a retry — it replaces the on-chain `claimed` flag and must stay in
one transaction with the transfer it records.

**Tile effects:** `nextPrizeForLanding` in `shared/src/effects.ts` takes an optional
`baseLamports`. The ladder (pump ×2, penalty ×0.5, rug ×0.2, GO bonus ×0.2) scales from it, so
running at smaller stakes moves every effect together. Omitting it reproduces the original
0.5 SOL values exactly, which is why all 44 shared tests were unaffected.

### Walletless play — read before changing guess intake

There is **no wallet connection anywhere in the app**. Players paste an address; the coordinator
records the pick and later sends the prize. Two properties hold this together:

1. **The token gate is checked against the pasted address, never the connection.**
   `Wallet.holdsGateToken` reads that address's own associated token account, so a holder cannot
   lend their balance to admit a non-holder. This is standard SPL and never depended on our
   program, which is why it survived the move off-chain unchanged.
2. **Prizes go to the address stored in `picks`.** `payWinner` takes whatever it is handed, so the
   recorded address is the only record of who is owed — never pass a caller-supplied one.

**Accepted trade-offs (decided 2026-08-27, revised 2026-09-29 — do not silently "fix" these):**

- The coordinator **asserts intent**: it records which number you picked, where your signature
  used to prove it. A buggy or dishonest operator could record a different number. Inherent to
  walletless play, and now also true of the dice themselves.
- **Griefing is possible.** Anyone who knows an address can ask the coordinator to guess for it,
  burning that address's one pick for the round. They cannot steal the prize. Mitigated by the
  limits in `server/src/guessIntake.ts` only.
- **Accepting a guess is now free.** It used to cost ~0.0013 SOL of pick rent, which is why the
  balance floor and the pick sweeper existed; both are gone. The house pays only when it pays a
  winner.

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
# Required:
#   DATABASE_URL=postgresql://...      # Supabase, or any Postgres. Schema self-creates.
#   PAYOUT_KEYPAIR_PATH=~/.config/solana/id.json   # or PAYOUT_KEYPAIR (JSON array OR base58)
#   MASTER_SECRET=$(openssl rand -hex 32)          # derives every round's seed
# Usually set:
#   RPC_URL=https://api.devnet.solana.com          # mainnet-beta = REAL MONEY
#   GATE_MINT=<spl mint>               # blank = anyone may play
#   WEB_ORIGIN=http://localhost:3000   # CORS (Vercel URL in prod)
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
- **guessIntake.ts:** Validation, token gate, per-socket and per-round limits. The only place a player request becomes a claim on the prize pot.
- **db/schema.sql:** `rounds`, `picks`, `game_state`. Created on boot; safe to re-run.
- **db/rounds.ts` / `db/picks.ts`:** Every query. `payOnce` is the double-payout defence.
- **db/client.ts:** Pool, TLS, and `tx()` for work that must not come apart.
- **wallet.ts:** Sends prizes (`SystemProgram.transfer`) and reads the token gate.
- **roundLoop.ts` / `roundPhases.ts` / `roundOpen.ts`:** The round cycle: open → guess window → reveal → settle
- **payouts.ts:** Background payout queue (~1s spacing, retry with backoff). Runs *outside* the round loop so a slow payout never stalls the game.
- **secrets.ts:** `HMAC(MASTER_SECRET, round_id)` → the round's seed. Derived, never stored.

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
- **lib.rs:** Instruction handlers: `initialize`, `open_round`, `submit_guess`, `reveal_and_draw`, `settle`, `payout`, `fund_treasury`, `withdraw_treasury`, `set_gate`, `set_params`, `close_pick`
- **withdraw_treasury.rs:** The vault's only non-prize exit, authority-only. Before it, funding the
  treasury was a one-way door — the PDA has no key, so anything beyond what the game eventually paid
  out was stranded. Keeps the account rent-exempt; `amount == 0` means "everything available".
  Driven by `server/src/withdraw.ts` (`pnpm --filter server withdraw <address> [sol]`).
- **set_params.rs:** Retune round duration and prize without wiping the chain. Before it existed the only way to change either was a fresh chain — fine locally, destructive anywhere real.
- **token_gate.rs:** Optional SPL holder gate. Parses the token account layout **by hand** — `anchor-spl` pulls in a borsh version that conflicts with `anchor-lang`'s.
- **tests/**: Mocha suites. `Anchor.toml` lists them explicitly and the order is load-bearing — `monopoly.gate.ts` must stay last (it arms the gate and leaves rounds unsettled).

## Deployment

### Web → Vercel
1. Import repo to Vercel
2. **Root Directory: `web`** — not the repository root. Vercel's Next.js builder looks for
   `next` in the Root Directory's `package.json`; the repo root has no `next` dependency, so
   pointing it there fails the build with "No Next.js version detected".
3. Leave **Include source files outside of the Root Directory** ON (the default). It is what
   pulls in `shared/` and the root `pnpm-lock.yaml` so the pnpm workspace resolves.
4. **Framework Preset: Next.js.** `web/vercel.json` pins this (`"framework": "nextjs"`)
   because vercel.json overrides dashboard project settings, and a preset left on "Other"
   makes Vercel look for a static `public/` directory and fail with *No Output Directory
   named "public" found*. That file is read from the **Root Directory**, so it only takes
   effect once step 2 is done.
5. There is **no `vercel.json` at the repository root**, on purpose. The original one set
   `framework: nextjs` and `outputDirectory: web/.next` while the Root Directory was the
   repo root; that combination is what broke the first deploys. Do not add it back — set
   the Root Directory instead.
6. Env vars are all **optional** now — `web/src/lib/env.ts` and `server/src/config.ts`
   default to the deployed URLs (see "Wiring" below). Set them only to override:
   - `NEXT_PUBLIC_RPC_URL`
   - `NEXT_PUBLIC_PROGRAM_ID`
   - `NEXT_PUBLIC_WS_URL` (Render coordinator URL)

   `NEXT_PUBLIC_*` values are inlined at **build** time, not read at runtime: changing one
   in the dashboard does nothing until you redeploy.

### Wiring: which URL lives where

Production URLs are baked into the code so the two halves connect unconfigured:

| Side | Deployed at | Reaches the other via |
|------|-------------|-----------------------|
| Web (Vercel) | `https://monopolysol-server.vercel.app` | `DEFAULT_WS_URL` in `web/src/lib/env.ts` |
| Coordinator (Render) | `https://monopolysol.onrender.com` | default `corsOrigins` in `server/src/config.ts` |

Note the project names are crossed: the Vercel project is called `monopolysol-server`
but hosts the **frontend**; the Render service is called `monopolysol` but is the
**coordinator**. Preview deployments get their own URLs and need `WEB_ORIGIN` set on
Render to be allowed through CORS.

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
- `server/src/guessIntake.ts` validates and rate-limits, checks the gate against the *pasted address*, then inserts into `picks`.
- One guess per address per round is enforced by `PRIMARY KEY (round_id, player)` — the insert simply returns no row on a duplicate.
- The picking loop re-reads `guessCounts` every ~4s and re-broadcasts the pad counters.

**Draw (round timer fires):**
- Coordinator derives the dice from the revealed seed, walks the avatar, and applies the landing tile's effect to the *next* round's prize
- The round is marked settled, the result is **broadcast immediately**, and the winners go to the background payout queue

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
- **The database is not a cache.** It is where the game lives. A round not written to Postgres is a
  round a redeploy loses, along with the guesses in it and the obligation to pay them. This used to
  come free from the chain, which is why `RoundLoop` could always rebuild itself by reading it back.
- **`payOnce` must stay one transaction.** It claims the pick `FOR UPDATE`, re-checks `paid`, sends,
  then records the signature. A transfer that lands without its flag set is a double payout waiting
  for the next retry; a flag set without the transfer is a winner silently never paid.
- **Prizes go to the address in `picks`, never a caller-supplied one.** The on-chain `payout` pinned
  the destination so even the operator could not redirect it. Nothing enforces that now.
- **`open_round` refuses to start a round the wallet cannot cover.** Kept from the on-chain rule.
  Taking guesses against a prize that will bounce at settle time is worse than not opening.
- **`WEB_ORIGIN` is a CORS allowlist.** Vercel preview deployments get unique URLs and will be
  blocked unless listed.

### Constraints that are easy to break silently

- **`PRIMARY KEY (round_id, player)` is a security control, not tidiness.** It is what makes a
  second guess from one address impossible. Enforce it with the key, never a prior `SELECT`: two
  concurrent requests both pass a check-then-insert, and a second claim on a split prize is a
  direct loss to the honest winners.
- **The round deadline is set in the server's clock domain**, passed into `openRound` rather than
  computed as Postgres `now() + interval`. Letting the database set it puts any skew between the
  two hosts straight into the countdown players see.
- **The dice derivation is published, not internal.** `keccak256(seed ‖ round_id_le)` folded to two
  d6, with `u64le` in `server/src/seed.ts`. Changing any of it invalidates every past reveal.
- **`.overlay` is `pointer-events: none`** with `auto` restored on its children. HUD components must be direct children of it (i.e. rendered from `Hud`), or they silently receive no clicks.

### Scale

Sized for ~100 concurrent players, not 10k. The old `getProgramAccounts` ceiling is gone — pick
lookups are now indexed Postgres queries scoped to one round. The remaining limits are the RPC
endpoint (one token-gate read per guess, one transfer per payout) and Socket.IO fan-out from a
single process. **A provider RPC key is worth having before real traffic** — server and client are
configured separately (`RPC_URL` vs `NEXT_PUBLIC_RPC_URL`) so they can point at different providers.

## Troubleshooting

- **Refuses to boot, "Missing DATABASE_URL":** the round loop has nowhere to store state. Set the
  Postgres connection string; the schema creates itself.
- **`SyntaxError: Unexpected token 'j'`:** a base58 key hitting `JSON.parse`. Both formats are
  accepted now (`server/src/bs58.ts`) — if you still see this, the key is malformed.
- **"payout wallet holds N lamports, below the … prize":** fund the wallet named in the message.
  The loop refuses to open a round it cannot pay.
- **Web can't connect to coordinator:** verify `NEXT_PUBLIC_WS_URL`, and that the browser's origin
  is in `WEB_ORIGIN` — a missing origin is a silent CORS rejection.
- **Rounds stop after a deploy:** Render's free plan sleeps after ~15 minutes idle. The loop must
  stay awake; use the paid plan.
