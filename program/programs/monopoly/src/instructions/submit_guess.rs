use anchor_lang::prelude::*;

use crate::effects;
use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, PlayerPick, Round};
use crate::token_gate;

#[derive(Accounts)]
pub struct SubmitGuess<'info> {
    /// The coordinator. Signs and funds the pick PDA on the player's behalf.
    ///
    /// Constrained to the authority, and that constraint is load-bearing: the
    /// player no longer signs, so without it *anyone* could create a pick for
    /// *any* address directly against the program, and no amount of server-side
    /// rate limiting could stop them. Funnelling submissions through the
    /// coordinator makes its limits the real ones.
    #[account(mut, address = config.authority @ GameError::Unauthorized)]
    pub payer: Signer<'info>,

    /// CHECK: the address the player pasted into the site. It never signs --
    /// that is the whole point of walletless play -- so nothing here may be
    /// inferred from its presence. It is used only as a PDA seed and as
    /// `pick.player` (which is what pins the eventual payout), and its claim to
    /// hold the game token is verified independently by `token_gate::enforce`,
    /// which reads the owner field out of the token account's own bytes.
    pub player: UncheckedAccount<'info>,

    #[account(seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,

    // `init` fails if this address already guessed this round -> no double
    // guesses. Seeded on `player`, not on the payer, so the coordinator can
    // submit for many players in one round while each address still gets
    // exactly one pick.
    #[account(
        init,
        payer = payer,
        space = 8 + PlayerPick::INIT_SPACE,
        seeds = [b"pick", round.round_id.to_le_bytes().as_ref(), player.key().as_ref()],
        bump
    )]
    pub pick: Account<'info, PlayerPick>,

    pub system_program: Program<'info, System>,

    /// CHECK: not trusted as an account type -- every field is validated by
    /// `token_gate::enforce`, which is the whole point of that module. Left
    /// unchecked here so the program needs no `anchor-spl` dependency.
    ///
    /// The *player's* token account for `config.gate_mint` -- not the payer's.
    /// `token_gate::enforce` requires its owner field to equal `player`, so the
    /// coordinator cannot pass its own (or any other holder's) account to sneak
    /// a non-holder in. Optional because the gate can be disabled
    /// (`gate_mint == Pubkey::default()`), which is how the game runs before
    /// the token exists -- clients signal `None` by passing the program's own
    /// id in this slot, per Anchor's optional-account convention.
    pub player_token_account: Option<UncheckedAccount<'info>>,
}

pub fn handler(ctx: Context<SubmitGuess>, guess: u16) -> Result<()> {
    let round = &mut ctx.accounts.round;

    require!(round.phase == Phase::Open, GameError::RoundNotOpen);
    let now = Clock::get()?.unix_timestamp;
    require!(now < round.locks_at, GameError::PickingClosed);

    let (min, max) = effects::guess_range();
    require!((min..=max).contains(&guess), GameError::InvalidGuess);

    // Checked against `player`, never against the signer -- the signer is the
    // coordinator and holds nothing on the player's behalf.
    token_gate::enforce(
        ctx.accounts.config.gate_mint,
        ctx.accounts.player.key(),
        ctx.accounts
            .player_token_account
            .as_ref()
            .map(|a| a.as_ref()),
    )?;

    let pick = &mut ctx.accounts.pick;
    pick.player = ctx.accounts.player.key();
    pick.round_id = round.round_id;
    pick.guess = guess;
    pick.claimed = false;
    pick.bump = ctx.bumps.pick;

    round.total_picks = round.total_picks.checked_add(1).ok_or(GameError::Overflow)?;

    msg!(
        "Round {}: {} guessed {}",
        round.round_id,
        pick.player,
        guess
    );
    Ok(())
}
