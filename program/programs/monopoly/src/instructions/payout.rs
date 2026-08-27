use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, PlayerPick, Round, Treasury};

/// Pay one winning pick its equal share of the prize. Idempotent per pick via
/// `claimed`.
///
/// **Permissionless: any signer may call this.** That is deliberate and safe,
/// because the signer has no influence over where the money goes -- the
/// destination is pinned to `pick.player` by the `address` constraint on
/// `winner` below, the entitlement is checked against the round's own dice,
/// and `claimed` makes a second call fail. The worst a stranger can do is pay
/// the transaction fee to send someone else their own prize.
///
/// Two things depend on this being permissionless:
/// - the coordinator pays winners in the background, off the round loop, so a
///   slow payout can never stall the game;
/// - a winner the coordinator failed to pay can claim it themselves from the
///   results modal, instead of the money being silently lost.
#[derive(Accounts)]
pub struct Payout<'info> {
    /// Pays the transaction fee. Usually the coordinator, sometimes the
    /// winner themselves. Intentionally unconstrained -- see the note above.
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
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,

    #[account(
        mut,
        seeds = [b"pick", round.round_id.to_le_bytes().as_ref(), pick.player.as_ref()],
        bump = pick.bump,
        constraint = pick.round_id == round.round_id @ GameError::NotAWinner
    )]
    pub pick: Account<'info, PlayerPick>,

    /// CHECK: validated to equal `pick.player`; receives the SOL payout.
    #[account(mut, address = pick.player @ GameError::NotAWinner)]
    pub winner: UncheckedAccount<'info>,
}

pub fn handler(ctx: Context<Payout>) -> Result<()> {
    let round = &ctx.accounts.round;
    require!(round.phase == Phase::Settled, GameError::NotSettled);
    require!(round.winners_count > 0, GameError::NoWinners);

    let pick = &mut ctx.accounts.pick;
    require!(!pick.claimed, GameError::AlreadyClaimed);
    require!(
        pick.guess == round.dice_a as u16 + round.dice_b as u16,
        GameError::NotAWinner
    );

    let share = round
        .prize_lamports
        .checked_div(round.winners_count as u64)
        .ok_or(GameError::Overflow)?;

    // Move lamports out of the program-owned treasury by direct arithmetic.
    let treasury_ai = ctx.accounts.treasury.to_account_info();
    let winner_ai = ctx.accounts.winner.to_account_info();
    let treasury_balance = treasury_ai.lamports();
    require!(treasury_balance >= share, GameError::InsufficientTreasury);

    **treasury_ai.try_borrow_mut_lamports()? = treasury_balance - share;
    **winner_ai.try_borrow_mut_lamports()? = winner_ai
        .lamports()
        .checked_add(share)
        .ok_or(GameError::Overflow)?;

    pick.claimed = true;
    msg!("Paid {} lamports to {}", share, pick.player);
    Ok(())
}
