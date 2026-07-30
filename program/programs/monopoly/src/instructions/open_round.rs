use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, Round, Treasury};

#[derive(Accounts)]
pub struct OpenRound<'info> {
    #[account(mut, address = config.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(seeds = [b"treasury"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,

    #[account(
        init,
        payer = authority,
        space = 8 + Round::INIT_SPACE,
        seeds = [b"round", (config.current_round + 1).to_le_bytes().as_ref()],
        bump
    )]
    pub round: Account<'info, Round>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenRound>, commit_hash: [u8; 32]) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let round_id = config
        .current_round
        .checked_add(1)
        .ok_or(GameError::Overflow)?;
    let prize = config.next_prize_lamports;
    let avatar_position = config.avatar_position;

    require!(
        ctx.accounts.treasury.to_account_info().lamports() >= prize,
        GameError::InsufficientTreasury
    );

    let now = Clock::get()?.unix_timestamp;

    let round = &mut ctx.accounts.round;
    round.round_id = round_id;
    round.phase = Phase::Open;
    round.commit_hash = commit_hash;
    round.revealed_seed = [0u8; 32];
    round.landed_tile = 0;
    round.dice_a = 0;
    round.dice_b = 0;
    round.start_tile = avatar_position;
    round.winners_count = 0;
    round.total_picks = 0;
    round.prize_lamports = prize;
    round.next_prize_lamports = 0;
    round.opened_at = now;
    round.locks_at = now + config.round_duration as i64;
    round.bump = ctx.bumps.round;

    // Consume-and-re-arm: this round spends what the last reveal armed; the
    // config resets to base so a lost round degrades to "next round pays base"
    // rather than accidentally keeping a stale bonus/penalty alive.
    config.next_prize_lamports = config.prize_lamports;
    config.current_round = round_id;

    msg!("Opened round {} (prize {} lamports)", round_id, prize);
    Ok(())
}
