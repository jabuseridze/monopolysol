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

pub fn handler(ctx: Context<Settle>) -> Result<()> {
    let round = &mut ctx.accounts.round;

    require!(round.phase == Phase::Drawn, GameError::NotDrawn);

    // `winners_count` is no longer an argument. It is accumulated by `tally`,
    // which re-derives every pick's PDA before counting it, and settlement is
    // refused until every pick `submit_guess` recorded has been visited. That
    // turns the share divisor in `payout` from something the authority asserts
    // into something the chain derived.
    require!(round.tallied == round.total_picks, GameError::TallyIncomplete);

    round.phase = Phase::Settled;

    msg!(
        "Round {} settled with {} winner(s) from {} pick(s)",
        round.round_id,
        round.winners_count,
        round.total_picks
    );
    Ok(())
}
