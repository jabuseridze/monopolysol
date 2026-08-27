use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{Phase, Round};

/// How long after guessing closes the authority has to reveal before anyone may
/// write the round off. Generous on purpose: this is a backstop for an operator
/// who has genuinely gone away, not a race the coordinator could lose to a
/// slow RPC or a redeploy.
pub const EXPIRY_GRACE_SECS: i64 = 24 * 60 * 60;

/// Write off a round the authority never revealed.
///
/// Deliberately **permissionless**, because the failure this exists for is the
/// authority itself being gone -- a key loss, a dead server, an abandoned
/// project. An authority-gated escape hatch would be useless in exactly the
/// case it is needed.
///
/// No lamports move, and that is worth stating plainly because it is easy to
/// assume otherwise: the prize is never escrowed. `open_round` only *checks*
/// `treasury.lamports() >= prize` and `round.prize_lamports` is a bookkeeping
/// number; the SOL sits in the shared treasury throughout and only `payout`
/// ever moves it. So a stuck round strands no funds.
///
/// What it does strand is state: `payout` and `close_pick` both gate on
/// `Phase::Settled`, so players can never be paid and the rent the coordinator
/// fronted for every pick account can never be reclaimed. `Expired` is a
/// terminal phase that unblocks `close_pick` while leaving `winners_count` at
/// zero, so nothing becomes payable that was not already won.
#[derive(Accounts)]
pub struct ExpireRound<'info> {
    /// Pays the fee. Anyone.
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
}

pub fn handler(ctx: Context<ExpireRound>) -> Result<()> {
    let round = &mut ctx.accounts.round;

    // Settled rounds are already fine, and an expired one must not be
    // re-expired -- both are terminal.
    require!(
        round.phase == Phase::Open || round.phase == Phase::Drawn,
        GameError::AlreadySettled
    );

    let now = Clock::get()?.unix_timestamp;
    let deadline = round
        .locks_at
        .checked_add(EXPIRY_GRACE_SECS)
        .ok_or(GameError::Overflow)?;
    require!(now > deadline, GameError::RoundNotExpired);

    // Zero winners: nobody is owed anything from a round that never drew.
    round.winners_count = 0;
    round.phase = Phase::Expired;

    msg!(
        "Round {} expired {}s past its reveal deadline; picks are now closable",
        round.round_id,
        now - deadline
    );
    Ok(())
}
