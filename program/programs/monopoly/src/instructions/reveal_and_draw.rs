use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

use crate::effects;
use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, Round};

#[derive(Accounts)]
pub struct RevealAndDraw<'info> {
    #[account(address = config.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump = config.config_bump)]
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

    // Dice = two disjoint 8-byte windows of the same hash. Do not derive `b` by
    // shifting `a`'s window -- that would correlate the two dice.
    let mix = keccak::hashv(&[&seed, &round.round_id.to_le_bytes()]).to_bytes();
    let dice_a = (u64::from_le_bytes(mix[0..8].try_into().unwrap()) % 6) as u8 + 1;
    let dice_b = (u64::from_le_bytes(mix[8..16].try_into().unwrap()) % 6) as u8 + 1;
    let sum = dice_a as u16 + dice_b as u16;

    let config = &mut ctx.accounts.config;
    let num_tiles = config.num_tiles;
    let start_tile = config.avatar_position;
    let new_pos = (start_tile + sum) % num_tiles;
    // Double-count collapse: "landed exactly on GO" and "passed GO" can both be
    // true for the same roll (start + sum == num_tiles) -- treat that as a
    // single GO bonus, never two.
    let passed_or_landed_go = (start_tile + sum >= num_tiles) || (new_pos == 0);

    let next_prize = effects::next_prize_for(new_pos, config.prize_lamports, passed_or_landed_go);

    round.revealed_seed = seed;
    round.landed_tile = new_pos;
    round.dice_a = dice_a;
    round.dice_b = dice_b;
    round.start_tile = start_tile;
    round.next_prize_lamports = next_prize;
    round.phase = Phase::Drawn;

    config.avatar_position = new_pos;
    config.next_prize_lamports = next_prize;

    msg!(
        "Round {} drawn: dice {}+{}={}, landed tile {} (start {}), next prize {} lamports",
        round.round_id,
        dice_a,
        dice_b,
        sum,
        new_pos,
        start_tile,
        next_prize
    );
    Ok(())
}
