use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, PlayerPick, Round};

/// Reclaim a settled round's pick account and its rent.
///
/// Picks were never closed before, which was tolerable while the *player* paid
/// the rent: it was their own 0.0013 SOL, spent once. Now the coordinator funds
/// every pick, so without this the house leaks rent on every guess forever --
/// at a hundred players a round that is a permanent, unbounded outflow rather
/// than a float.
///
/// It also relieves the `getProgramAccounts` ceiling documented in CLAUDE.md.
/// The coordinator's 4-second poll scans every account the program has ever
/// owned; while picks accumulated, that scan grew with total game history
/// instead of with the current round.
#[derive(Accounts)]
pub struct ClosePick<'info> {
    /// Receives the reclaimed rent. Authority-only: the rent came from the
    /// coordinator, so it goes back there, and nobody else gets to decide when
    /// a pick disappears.
    #[account(mut, address = config.authority @ GameError::Unauthorized)]
    pub payer: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,

    #[account(
        mut,
        close = payer,
        seeds = [b"pick", round.round_id.to_le_bytes().as_ref(), pick.player.as_ref()],
        bump = pick.bump,
        constraint = pick.round_id == round.round_id @ GameError::PickNotClosable
    )]
    pub pick: Account<'info, PlayerPick>,
}

pub fn handler(ctx: Context<ClosePick>) -> Result<()> {
    let round = &ctx.accounts.round;
    let pick = &ctx.accounts.pick;

    // Before settlement the winning sum isn't known, so "is this pick owed
    // anything?" has no answer yet. `Expired` also qualifies: that round never
    // drew, so nothing is owed and the rent should not stay stranded.
    require!(
        round.phase == Phase::Settled || round.phase == Phase::Expired,
        GameError::PickNotClosable
    );

    // The one case that must never close: a winner who hasn't been paid.
    // `payout` reads `pick.guess` and flips `pick.claimed`; deleting the
    // account first would destroy a prize that is already owed, with no record
    // left to recover it from.
    // An expired round has no dice, so nobody can be an unpaid winner in it.
    let won = round.phase == Phase::Settled
        && pick.guess == u16::from(round.dice_a) + u16::from(round.dice_b);
    require!(!won || pick.claimed, GameError::PickNotClosable);

    Ok(())
}
