use anchor_lang::prelude::*;

pub mod effects;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod token_gate;

use instructions::*;

// Placeholder program id. Run `anchor keys sync` after `anchor build` to replace
// this with the real deployed program id (also update Anchor.toml + web/server env).
declare_id!("ENAjUrMvqvzjM7Fr7qM19FTpurYYAB9BzLygz8xgbL3d");

#[program]
pub mod monopoly {
    use super::*;

    /// One-time setup of the global config + treasury vault.
    pub fn initialize(
        ctx: Context<Initialize>,
        prize_lamports: u64,
        num_tiles: u16,
        round_duration: u32,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, prize_lamports, num_tiles, round_duration)
    }

    /// Deposit house SOL into the treasury (anyone may fund).
    pub fn fund_treasury(ctx: Context<FundTreasury>, amount: u64) -> Result<()> {
        instructions::fund_treasury::handler(ctx, amount)
    }

    /// Authority opens a new round, committing keccak256(seed).
    pub fn open_round(ctx: Context<OpenRound>, commit_hash: [u8; 32]) -> Result<()> {
        instructions::open_round::handler(ctx, commit_hash)
    }

    /// A player submits a dice-sum guess for the current round (one guess per wallet).
    pub fn submit_guess(ctx: Context<SubmitGuess>, guess: u16) -> Result<()> {
        instructions::submit_guess::handler(ctx, guess)
    }

    /// Authority reveals the seed after lock; program derives the winning tile.
    pub fn reveal_and_draw(ctx: Context<RevealAndDraw>, seed: [u8; 32]) -> Result<()> {
        instructions::reveal_and_draw::handler(ctx, seed)
    }

    /// Authority records the number of winning picks (or rolls over if none).
    /// Count a batch of picks on-chain. Picks arrive in `remaining_accounts`;
    /// call repeatedly until `round.tallied == round.total_picks`.
    pub fn tally(ctx: Context<Tally>) -> Result<()> {
        instructions::tally::handler(ctx)
    }

    /// Finalise a round. Takes no winner count -- `tally` derived it.
    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handler(ctx)
    }

    /// Permissionless: write off a round the authority never revealed, so its
    /// pick accounts stop being unclosable. Moves no lamports.
    pub fn expire_round(ctx: Context<ExpireRound>) -> Result<()> {
        instructions::expire_round::handler(ctx)
    }

    /// Pay a single winning pick its equal share from the treasury. Callable
    /// by anyone -- see `payout.rs` for why that is safe.
    pub fn payout(ctx: Context<Payout>) -> Result<()> {
        instructions::payout::handler(ctx)
    }

    /// Authority arms, retargets, or disables the token gate on `submit_guess`.
    /// `Pubkey::default()` disables it.
    pub fn set_gate(ctx: Context<SetGate>, mint: Pubkey) -> Result<()> {
        instructions::set_gate::handler(ctx, mint)
    }

    /// Authority reclaims a settled round's pick account and its rent. Refuses
    /// to close a winner that has not been paid.
    pub fn close_pick(ctx: Context<ClosePick>) -> Result<()> {
        instructions::close_pick::handler(ctx)
    }

    /// Authority retunes the guessing window and base prize without wiping the
    /// chain. Takes effect from the next round to open.
    pub fn set_params(
        ctx: Context<SetParams>,
        prize_lamports: u64,
        round_duration: u32,
    ) -> Result<()> {
        instructions::set_params::handler(ctx, prize_lamports, round_duration)
    }
}
