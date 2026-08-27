//! Proof that a player holds the game token.
//!
//! This reads the SPL token account layout by hand rather than using
//! `anchor_spl::token_interface::TokenAccount`. That was the first attempt and
//! was backed out: `anchor-spl` pulls in `spl-token-2022`, which pins a borsh
//! version incompatible with the one `anchor-lang` expects, and the IDL build
//! fails with a trait mismatch that cannot be resolved without forking the
//! dependency tree. The layout below is stable, versioned by the token program
//! itself, and short enough to audit in one screen.
//!
//! The first 165 bytes are identical between SPL Token and Token-2022 -- 2022
//! appends extension data past that point and never rearranges the base -- so
//! accepting both programs costs one extra comparison.

use anchor_lang::prelude::*;

use crate::errors::GameError;

/// `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
const SPL_TOKEN_ID: Pubkey = pubkey!("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
/// `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`
const SPL_TOKEN_2022_ID: Pubkey = pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/// Length of the base token account, common to both token programs.
const ACCOUNT_LEN: usize = 165;
const MINT_RANGE: core::ops::Range<usize> = 0..32;
const OWNER_RANGE: core::ops::Range<usize> = 32..64;
const AMOUNT_RANGE: core::ops::Range<usize> = 64..72;
/// `AccountState`: 0 = Uninitialized, 1 = Initialized, 2 = Frozen.
const STATE_OFFSET: usize = 108;
const STATE_INITIALIZED: u8 = 1;

/// Require `player` to hold at least one unit of `gate_mint`.
///
/// A zero `gate_mint` disables the gate entirely, which is the state
/// `initialize` leaves behind so the game is playable before the token exists.
///
/// Every check here is load-bearing; dropping any one makes the gate
/// decorative:
/// - **owned by a token program** -- otherwise a player passes an account they
///   authored, containing whatever bytes make the rest of these checks pass;
/// - **initialized** -- an all-zero account of the right length otherwise
///   reads as a valid balance of nothing;
/// - **correct mint** -- otherwise a worthless token they minted themselves
///   passes;
/// - **owned by this player** -- otherwise one real holder's account can be
///   passed by every non-holder in the game;
/// - **non-zero balance** -- an empty token account is free to create for any
///   mint, so its mere existence proves nothing.
pub fn enforce(
    gate_mint: Pubkey,
    player: Pubkey,
    token_account: Option<&AccountInfo>,
) -> Result<()> {
    if gate_mint == Pubkey::default() {
        return Ok(());
    }

    let acct = token_account.ok_or(GameError::TokenGateFailed)?;

    require!(
        *acct.owner == SPL_TOKEN_ID || *acct.owner == SPL_TOKEN_2022_ID,
        GameError::TokenGateFailed
    );

    let data = acct.try_borrow_data()?;
    require!(data.len() >= ACCOUNT_LEN, GameError::TokenGateFailed);
    require!(
        data[STATE_OFFSET] == STATE_INITIALIZED,
        GameError::TokenGateFailed
    );

    require!(
        Pubkey::try_from(&data[MINT_RANGE]).map_err(|_| GameError::TokenGateFailed)? == gate_mint,
        GameError::TokenGateFailed
    );
    require!(
        Pubkey::try_from(&data[OWNER_RANGE]).map_err(|_| GameError::TokenGateFailed)? == player,
        GameError::TokenGateFailed
    );

    let amount = u64::from_le_bytes(
        data[AMOUNT_RANGE]
            .try_into()
            .map_err(|_| GameError::TokenGateFailed)?,
    );
    require!(amount > 0, GameError::TokenGateFailed);

    Ok(())
}
