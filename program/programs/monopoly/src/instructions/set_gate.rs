use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::GlobalConfig;

/// Arm, retarget, or disable the token gate.
///
/// This exists because `round_duration` and `prize_lamports` are written once
/// by `initialize` and can never be changed -- retuning them means wiping the
/// whole game. The gate must not inherit that flaw: the token it points at may
/// not exist yet, and the mint will change at least once (stand-in -> real).
/// So the mint is settable at any time by the authority.
///
/// Passing `Pubkey::default()` disables the gate and reopens the game to
/// everyone, which is also the state `initialize` leaves behind.
#[derive(Accounts)]
pub struct SetGate<'info> {
    #[account(address = config.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,
}

pub fn handler(ctx: Context<SetGate>, mint: Pubkey) -> Result<()> {
    ctx.accounts.config.gate_mint = mint;

    if mint == Pubkey::default() {
        msg!("Token gate disabled -- anyone may play");
    } else {
        msg!("Token gate armed on mint {}", mint);
    }
    Ok(())
}
