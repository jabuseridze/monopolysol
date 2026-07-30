//! v1 tile effects — prize size only, applied to the *next* round.
//!
//! Independent reimplementation of `shared/src/effects.ts` (not literally shared
//! code across Rust/TS); parity between the two is asserted by tests in a later
//! task, not enforced by the compiler.

/// Penalty tiles: Gas Fee (#4), Slippage Tax (#38). Halve the base prize; GO
/// bonus suppressed.
const PENALTY_TILES: [u16; 2] = [4, 38];
/// Rug tile: Get Rugged (#30). Cuts to a fifth of base; GO bonus suppressed.
const RUG_TILE: u16 = 30;
/// Pump tiles: Random Pump (#7, #22, #36). Doubles the base; GO bonus stacks.
const PUMP_TILES: [u16; 3] = [7, 22, 36];

/// Guess range for 2d6 dice (today). The seam for a future JAILED effect to
/// override with a different valid range.
pub fn guess_range() -> (u16, u16) {
    (2, 12)
}

/// Prize armed for the *next* round, given the tile landed on this round and
/// whether GO was passed or landed on (already collapsed by the caller so a
/// single roll can never award the GO bonus twice — see `reveal_and_draw.rs`).
///
/// `base` is `GlobalConfig::prize_lamports`. Penalties (Gas Fee, Slippage Tax,
/// Get Rugged) override the GO bonus; every other tile stacks it when applicable.
pub fn next_prize_for(landed_tile: u16, base: u64, passed_or_landed_go: bool) -> u64 {
    let go_bonus = if passed_or_landed_go { base / 5 } else { 0 };

    if PENALTY_TILES.contains(&landed_tile) {
        return base / 2;
    }
    if landed_tile == RUG_TILE {
        return base / 5;
    }
    if PUMP_TILES.contains(&landed_tile) {
        return base.saturating_mul(2).saturating_add(go_bonus);
    }
    base.saturating_add(go_bonus)
}
