use anchor_lang::prelude::*;

/// Lifecycle of a single round.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum Phase {
    /// Accepting picks (until `locks_at`).
    Open,
    /// Seed revealed, winning tile computed.
    Drawn,
    /// Winners recorded / rolled over; payouts allowed.
    Settled,
}

/// Global, singleton configuration + rollover accounting.
#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub config_bump: u8,
    pub treasury_bump: u8,
    /// Base prize per round in lamports.
    pub prize_lamports: u64,
    /// Prize armed for the next round to open, produced by the last reveal's
    /// tile effect (or `prize_lamports` if nothing has re-armed it yet).
    pub next_prize_lamports: u64,
    pub num_tiles: u16,
    pub round_duration: u32,
    /// Id of the most recently opened round (0 = none yet).
    pub current_round: u64,
    /// Avatar's current tile on the ring (persists between rounds).
    pub avatar_position: u16,
}

/// The program-owned SOL vault. Holds house funds; holds no logic beyond bump.
#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub bump: u8,
}

/// Per-round state. PDA seeds: ["round", round_id_le].
#[account]
#[derive(InitSpace)]
pub struct Round {
    pub round_id: u64,
    pub phase: Phase,
    /// keccak256(seed) published before picks open.
    pub commit_hash: [u8; 32],
    /// Revealed after lock so anyone can verify `landed_tile`.
    pub revealed_seed: [u8; 32],
    pub landed_tile: u16,
    pub winners_count: u32,
    pub total_picks: u32,
    /// Prize snapshot at open time (consumed from `GlobalConfig::next_prize_lamports`).
    pub prize_lamports: u64,
    pub opened_at: i64,
    pub locks_at: i64,
    pub bump: u8,
    pub dice_a: u8,
    pub dice_b: u8,
    /// Avatar's tile before this round's walk (lets a page refresh rebuild it).
    pub start_tile: u16,
    /// Audit trail: the prize this round's reveal produced for the *next* round.
    pub next_prize_lamports: u64,
}

/// One wallet's pick for one round. PDA seeds: ["pick", round_id_le, player].
/// Its existence prevents a second pick by the same wallet in the same round.
#[account]
#[derive(InitSpace)]
pub struct PlayerPick {
    pub player: Pubkey,
    pub round_id: u64,
    /// Guessed dice sum (2..=12). Field name changed from the tile-lottery
    /// era's `tile_index`; still a `u16` to keep this account exactly 52 bytes.
    pub guess: u16,
    pub claimed: bool,
    pub bump: u8,
}
