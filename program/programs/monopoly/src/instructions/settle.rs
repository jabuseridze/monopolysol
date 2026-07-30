use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, Round};

/// Authority records how many winning picks exist for the round (computed
/// off-chain from the on-chain PlayerPick accounts). This sets the payout
/// divisor. If there are no winners, the prize rolls into the next round.
///
/// The winning *tile* itself is fully provable on-chain (commit-reveal), so the
/// only trusted input here is the count; a future upgrade can replace this with
/// on-chain counting or VRF for full trustlessness in real-money mode.
#[derive(Accounts)]
pub struct Settle<'info> {
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

pub fn handler(ctx: Context<Settle>, winners_count: u32) -> Result<()> {
    let round = &mut ctx.accounts.round;

    require!(round.phase == Phase::Drawn, GameError::NotDrawn);

    round.winners_count = winners_count;

    if winners_count == 0 {
        // No winners: roll the prize into the next round.
        let config = &mut ctx.accounts.config;
        config.rollover_lamports = config
            .rollover_lamports
            .checked_add(round.prize_lamports)
            .ok_or(GameError::Overflow)?;
        msg!(
            "Round {} settled with no winners; {} lamports rolled over",
            round.round_id,
            round.prize_lamports
        );
    } else {
        msg!(
            "Round {} settled with {} winner(s)",
            round.round_id,
            winners_count
        );
    }

    round.phase = Phase::Settled;
    Ok(())
}
