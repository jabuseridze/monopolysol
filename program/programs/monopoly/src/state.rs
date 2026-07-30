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
    /// Prize from rounds with no winners, added to the next round's prize.
    pub rollover_lamports: u64,
    pub num_tiles: u16,
    pub round_duration: u32,
    /// Id of the most recently opened round (0 = none yet).
    pub current_round: u64,
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
    /// Revealed after lock so anyone can verify `winning_tile`.
    pub revealed_seed: [u8; 32],
    pub winning_tile: u16,
    pub winners_count: u32,
    pub total_picks: u32,
    /// Prize snapshot at open time (base + rollover).
    pub prize_lamports: u64,
    pub opened_at: i64,
    pub locks_at: i64,
    pub bump: u8,
}

/// One wallet's pick for one round. PDA seeds: ["pick", round_id_le, player].
/// Its existence prevents a second pick by the same wallet in the same round.
#[account]
#[derive(InitSpace)]
pub struct PlayerPick {
    pub player: Pubkey,
    pub round_id: u64,
    pub tile_index: u16,
    pub claimed: bool,
    pub bump: u8,
}
