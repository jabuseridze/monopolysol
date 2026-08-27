use anchor_lang::prelude::*;

use crate::state::{GlobalConfig, Treasury};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, Treasury>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    prize_lamports: u64,
    num_tiles: u16,
    round_duration: u32,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.authority = ctx.accounts.authority.key();
    config.config_bump = ctx.bumps.config;
    config.treasury_bump = ctx.bumps.treasury;
    config.prize_lamports = prize_lamports;
    config.next_prize_lamports = prize_lamports;
    config.num_tiles = num_tiles;
    config.round_duration = round_duration;
    config.current_round = 0;
    config.avatar_position = 0;
    // Gate starts disabled so the game is playable before the token exists.
    config.gate_mint = Pubkey::default();

    ctx.accounts.treasury.bump = ctx.bumps.treasury;

    msg!(
        "Initialized: prize={} lamports, tiles={}, duration={}s",
        prize_lamports,
        num_tiles,
        round_duration
    );
    Ok(())
}
