use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

// Placeholder program id. Run `anchor keys sync` after `anchor build` to replace
// this with the real deployed program id (also update Anchor.toml + web/server env).
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

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

    /// A player picks a tile for the current round (one pick per wallet).
    pub fn pick_tile(ctx: Context<PickTile>, tile_index: u16) -> Result<()> {
        instructions::pick_tile::handler(ctx, tile_index)
    }

    /// Authority reveals the seed after lock; program derives the winning tile.
    pub fn reveal_and_draw(ctx: Context<RevealAndDraw>, seed: [u8; 32]) -> Result<()> {
        instructions::reveal_and_draw::handler(ctx, seed)
    }

    /// Authority records the number of winning picks (or rolls over if none).
    pub fn settle(ctx: Context<Settle>, winners_count: u32) -> Result<()> {
        instructions::settle::handler(ctx, winners_count)
    }

    /// Pay a single winning pick its equal share from the treasury.
    pub fn payout(ctx: Context<Payout>) -> Result<()> {
        instructions::payout::handler(ctx)
    }
}
