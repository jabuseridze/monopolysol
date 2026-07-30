use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, Round};

/// Authority records how many winning picks exist for the round (computed
/// off-chain from the on-chain PlayerPick accounts). This sets the payout
/// divisor. There's no rollover/sentinel handling here for a no-winner round --
/// `open_round.rs`'s consume-and-re-arm already set `next_prize_lamports` from
/// this round's `reveal_and_draw` tile effect regardless of how many people
/// guessed right, so a no-winner round simply degrades to that (base-prize, by
/// default) amount on its own; `config` stays writable purely so callers that
/// pass a fixed account list don't need a special case for this instruction.
///
/// The winning *dice sum* itself is fully provable on-chain (commit-reveal), so
/// the only trusted input here is the count; a future upgrade can replace this
/// with on-chain counting or VRF for full trustlessness in real-money mode.
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
    round.phase = Phase::Settled;

    msg!(
        "Round {} settled with {} winner(s)",
        round.round_id,
        winners_count
    );
    Ok(())
}
