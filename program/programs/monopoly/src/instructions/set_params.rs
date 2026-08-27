use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::GlobalConfig;

/// Lower bound on the guessing window. Below this a player realistically
/// cannot read the pads, decide, sign in their wallet and have the
/// transaction confirm -- the round would close on them mid-signature.
pub const MIN_ROUND_DURATION: u32 = 15;
/// Upper bound, purely a fat-finger guard: a mistyped value here would
/// otherwise strand the game in a round nobody can wait out, and there is no
/// way to interrupt a round in flight.
pub const MAX_ROUND_DURATION: u32 = 3_600;

/// Retune the guessing window and the base prize.
///
/// Both fields were previously written once by `initialize` and could never be
/// changed, so altering either meant wiping the chain and losing every round of
/// history -- fine on a local validator, unacceptable on devnet or mainnet
/// where the fix would destroy real game state. `set_gate` already established
/// that authority-settable config is the right shape; this closes the same gap
/// for the two values that actually get tuned in practice.
///
/// `prize_lamports` is the *base* prize. It deliberately does NOT touch
/// `next_prize_lamports`, which the last reveal's tile effect already armed --
/// overwriting that would silently cancel a Random Pump or a Get Rugged that
/// players have already seen resolve on screen. The new base takes effect from
/// the round after the one currently armed.
#[derive(Accounts)]
pub struct SetParams<'info> {
    #[account(address = config.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,
}

pub fn handler(ctx: Context<SetParams>, prize_lamports: u64, round_duration: u32) -> Result<()> {
    require!(
        (MIN_ROUND_DURATION..=MAX_ROUND_DURATION).contains(&round_duration),
        GameError::InvalidParams
    );
    require!(prize_lamports > 0, GameError::InvalidParams);

    let config = &mut ctx.accounts.config;
    config.prize_lamports = prize_lamports;
    config.round_duration = round_duration;

    msg!(
        "Params updated: prize={} lamports, duration={}s (next round's prize already armed at {} is unchanged)",
        prize_lamports,
        round_duration,
        config.next_prize_lamports
    );
    Ok(())
}
