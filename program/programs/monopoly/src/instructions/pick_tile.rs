use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, PlayerPick, Round};

#[derive(Accounts)]
pub struct PickTile<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,

    // `init` fails if the wallet already picked this round -> no double picks.
    #[account(
        init,
        payer = player,
        space = 8 + PlayerPick::INIT_SPACE,
        seeds = [b"pick", round.round_id.to_le_bytes().as_ref(), player.key().as_ref()],
        bump
    )]
    pub pick: Account<'info, PlayerPick>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PickTile>, tile_index: u16) -> Result<()> {
    let round = &mut ctx.accounts.round;

    require!(round.phase == Phase::Open, GameError::RoundNotOpen);
    let now = Clock::get()?.unix_timestamp;
    require!(now < round.locks_at, GameError::PickingClosed);
    require!(
        tile_index < ctx.accounts.config.num_tiles,
        GameError::InvalidTile
    );

    let pick = &mut ctx.accounts.pick;
    pick.player = ctx.accounts.player.key();
    pick.round_id = round.round_id;
    pick.tile_index = tile_index;
    pick.claimed = false;
    pick.bump = ctx.bumps.pick;

    round.total_picks = round.total_picks.checked_add(1).ok_or(GameError::Overflow)?;

    msg!(
        "Round {}: {} picked tile {}",
        round.round_id,
        pick.player,
        tile_index
    );
    Ok(())
}
