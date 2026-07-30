//! v1 tile effects — prize size only, applied to the *next* round.
//!
//! Independent reimplementation of `shared/src/effects.ts` (not literally shared
//! code across Rust/TS); parity between the two is asserted by tests in a later
//! task, not enforced by the compiler.

/// Penalty tiles: Gas Fee (#4), Slippage Tax (#38). GO bonus suppressed.
const PENALTY_TILES: [u16; 2] = [4, 38];
/// Rug tile: Get Rugged (#30). GO bonus suppressed.
const RUG_TILE: u16 = 30;
/// Pump tiles: Random Pump (#7, #22, #36). GO bonus stacks.
const PUMP_TILES: [u16; 3] = [7, 22, 36];

/// Fixed prize tiers, in lamports. Deliberately **not** derived from
/// `GlobalConfig::prize_lamports` (the configurable base) -- the effects table
/// is a fixed schedule independent of whatever the authority currently has the
/// base prize set to. If these ever need to scale with the configured base,
/// that's a deliberate follow-up, not a side effect of a `prize_lamports` change.
const GAS_FEE_SLIPPAGE_PRIZE_LAMPORTS: u64 = 250_000_000; // 0.25 SOL
const RUG_PRIZE_LAMPORTS: u64 = 100_000_000; // 0.10 SOL
const PUMP_PRIZE_LAMPORTS: u64 = 1_000_000_000; // 1.00 SOL
const BASE_PRIZE_LAMPORTS: u64 = 500_000_000; // 0.50 SOL
const GO_BONUS_LAMPORTS: u64 = 100_000_000; // 0.10 SOL

/// Guess range for 2d6 dice (today). The seam for a future JAILED effect to
/// override with a different valid range.
pub fn guess_range() -> (u16, u16) {
    (2, 12)
}

/// Prize armed for the *next* round, given the tile landed on this round and
/// whether GO was passed or landed on (already collapsed by the caller so a
/// single roll can never award the GO bonus twice — see `reveal_and_draw.rs`).
///
/// `base` (`GlobalConfig::prize_lamports`) is accepted for signature parity
/// with callers/tests but intentionally **unused** here: the tile-effect
/// prizes are a fixed lamport schedule, not a fraction of the configurable
/// base. Penalties (Gas Fee, Slippage Tax, Get Rugged) override the GO bonus;
/// every other tile stacks it when applicable.
pub fn next_prize_for(landed_tile: u16, _base: u64, passed_or_landed_go: bool) -> u64 {
    let go_bonus = if passed_or_landed_go { GO_BONUS_LAMPORTS } else { 0 };

    if PENALTY_TILES.contains(&landed_tile) {
        return GAS_FEE_SLIPPAGE_PRIZE_LAMPORTS;
    }
    if landed_tile == RUG_TILE {
        return RUG_PRIZE_LAMPORTS;
    }
    if PUMP_TILES.contains(&landed_tile) {
        return PUMP_PRIZE_LAMPORTS + go_bonus;
    }
    BASE_PRIZE_LAMPORTS + go_bonus
}
