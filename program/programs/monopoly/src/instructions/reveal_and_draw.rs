use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, Round};

#[derive(Accounts)]
pub struct RevealAndDraw<'info> {
    #[account(address = config.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
}

pub fn handler(ctx: Context<RevealAndDraw>, seed: [u8; 32]) -> Result<()> {
    let round = &mut ctx.accounts.round;

    require!(round.phase == Phase::Open, GameError::RoundNotOpen);
    let now = Clock::get()?.unix_timestamp;
    require!(now >= round.locks_at, GameError::PickingStillOpen);

    // Verify the committed seed: keccak256(seed) must equal the commit hash.
    let computed = keccak::hashv(&[&seed]).to_bytes();
    require!(computed == round.commit_hash, GameError::BadReveal);

    // Winner = keccak256(seed || round_id) mod num_tiles. Deterministic and
    // independently verifiable by anyone holding the revealed seed.
    let mix = keccak::hashv(&[&seed, &round.round_id.to_le_bytes()]).to_bytes();
    let n = u64::from_le_bytes(mix[0..8].try_into().unwrap());
    let num_tiles = ctx.accounts.config.num_tiles as u64;
    let winning_tile = (n % num_tiles) as u16;

    round.revealed_seed = seed;
    round.winning_tile = winning_tile;
    round.phase = Phase::Drawn;

    msg!(
        "Round {} drawn: winning tile {}",
        round.round_id,
        winning_tile
    );
    Ok(())
}
