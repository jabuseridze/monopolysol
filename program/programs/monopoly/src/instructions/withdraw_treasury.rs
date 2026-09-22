use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Treasury};

/// Authority moves SOL back out of the vault to an address of its choosing.
///
/// The treasury is a PDA with no private key, so before this existed money
/// could only ever leave as a prize: funding it was a one-way door, and any
/// balance beyond what the game eventually paid out was stranded forever. That
/// is fine for free devnet SOL and unacceptable for real money.
///
/// **This does not weaken the guarantee players rely on.** The vault still has
/// no key, `payout` is still permissionless, and prizes are still pinned to
/// `pick.player`. The only new power is held by the configured authority --
/// exactly the party that funded the vault in the first place -- and it is
/// visible on-chain like every other instruction.
///
/// **The hazard this cannot check:** a settled round whose winners have not
/// been paid yet is an obligation the chain does not total up anywhere, so
/// draining the vault can leave `payout` failing with `InsufficientTreasury`
/// and winners unpaid. Withdraw between rounds, and leave the outstanding
/// prizes behind.
#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(address = config.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut, seeds = [b"treasury"], bump = treasury.bump)]
    pub treasury: Account<'info, Treasury>,

    /// CHECK: any address the authority nominates; it only receives lamports.
    /// Deliberately unconstrained -- the authority is withdrawing its own
    /// float and may want it somewhere other than the signing wallet.
    #[account(mut)]
    pub destination: UncheckedAccount<'info>,
}

/// `amount == 0` withdraws everything available, which saves the caller from
/// having to read the balance and subtract the rent floor itself -- the common
/// case, and the one most likely to be got wrong by hand.
pub fn handler(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
    let treasury_ai = ctx.accounts.treasury.to_account_info();
    let destination_ai = ctx.accounts.destination.to_account_info();

    // The account must stay rent-exempt or the runtime reaps it, taking the
    // vault's address out of service until someone re-funds it.
    let rent_floor = Rent::get()?.minimum_balance(treasury_ai.data_len());
    let balance = treasury_ai.lamports();
    let available = balance.saturating_sub(rent_floor);

    let amount = if amount == 0 { available } else { amount };
    require!(amount > 0, GameError::NothingToWithdraw);
    require!(amount <= available, GameError::InsufficientTreasury);

    // Direct lamport arithmetic rather than a system transfer: the treasury is
    // program-owned, and the System Program refuses to move lamports out of an
    // account it does not own. Same mechanism `payout` uses.
    **treasury_ai.try_borrow_mut_lamports()? = balance
        .checked_sub(amount)
        .ok_or(GameError::Overflow)?;
    **destination_ai.try_borrow_mut_lamports()? = destination_ai
        .lamports()
        .checked_add(amount)
        .ok_or(GameError::Overflow)?;

    msg!(
        "Withdrew {} lamports to {} ({} left in vault)",
        amount,
        ctx.accounts.destination.key(),
        balance - amount
    );
    Ok(())
}
