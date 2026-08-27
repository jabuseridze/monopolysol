use anchor_lang::prelude::*;

use crate::errors::GameError;
use crate::state::{GlobalConfig, Phase, PlayerPick, Round};

/// Count a batch of this round's picks on-chain.
///
/// `settle` used to take `winners_count` as an argument and write it straight
/// through, and `payout` divides `prize_lamports / winners_count` to size every
/// share -- so a single wrong number, from a bug or a compromised key, silently
/// mis-paid every winner in the round. Nothing on-chain could tell.
///
/// Picks arrive in `remaining_accounts` because there can be hundreds of them
/// and a transaction can only carry a few dozen accounts. The coordinator sends
/// as many batches as it takes; `settle` then refuses until `round.tallied`
/// reaches `round.total_picks`, so the count is complete by construction rather
/// than by trust.
///
/// Each pick is verified three ways before it counts: it must deserialize as a
/// `PlayerPick` owned by this program, its PDA must re-derive from this round
/// and its own `player` (so a forged account cannot be substituted), and it must
/// not already be `counted`. That last flag is what makes a retried batch a
/// no-op instead of double-counting -- which matters because the coordinator
/// retries on RPC failure.
#[derive(Accounts)]
pub struct Tally<'info> {
    #[account(address = config.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    #[account(seeds = [b"config"], bump = config.config_bump)]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"round", round.round_id.to_le_bytes().as_ref()],
        bump = round.bump
    )]
    pub round: Account<'info, Round>,
    // Picks follow in `remaining_accounts`.
}

pub fn handler(ctx: Context<Tally>) -> Result<()> {
    // Only between the draw and settlement: before the draw there is no winning
    // sum to compare against, and after it the count is final.
    require!(ctx.accounts.round.phase == Phase::Drawn, GameError::NotDrawn);

    let round_id = ctx.accounts.round.round_id;
    let winning_sum =
        u16::from(ctx.accounts.round.dice_a) + u16::from(ctx.accounts.round.dice_b);
    let program_id = ctx.program_id;

    let mut newly_counted: u32 = 0;
    let mut new_winners: u32 = 0;

    for info in ctx.remaining_accounts.iter() {
        require!(info.owner == program_id, GameError::WrongRound);

        let mut data = info.try_borrow_mut_data()?;
        let mut pick: PlayerPick = PlayerPick::try_deserialize(&mut &data[..])?;

        require!(pick.round_id == round_id, GameError::WrongRound);

        // Re-derive the address. Without this, any program-owned account of the
        // right shape could be passed repeatedly to inflate the winner count.
        let expected = Pubkey::create_program_address(
            &[
                b"pick",
                round_id.to_le_bytes().as_ref(),
                pick.player.as_ref(),
                &[pick.bump],
            ],
            program_id,
        )
        .map_err(|_| GameError::WrongRound)?;
        require_keys_eq!(*info.key, expected, GameError::WrongRound);

        if pick.counted {
            continue; // retried batch; already accounted for
        }

        pick.counted = true;
        if pick.guess == winning_sum {
            new_winners = new_winners.checked_add(1).ok_or(GameError::Overflow)?;
        }
        newly_counted = newly_counted.checked_add(1).ok_or(GameError::Overflow)?;

        let mut cursor = &mut data[..];
        pick.try_serialize(&mut cursor)?;
    }

    let round = &mut ctx.accounts.round;
    round.tallied = round.tallied.checked_add(newly_counted).ok_or(GameError::Overflow)?;
    round.winners_count = round
        .winners_count
        .checked_add(new_winners)
        .ok_or(GameError::Overflow)?;

    // Cannot exceed what `submit_guess` recorded; a breach means the derivation
    // check above let something through and the count is not trustworthy.
    require!(round.tallied <= round.total_picks, GameError::WrongRound);

    msg!(
        "Round {}: tallied {}/{}, {} winner(s) so far",
        round_id,
        round.tallied,
        round.total_picks,
        round.winners_count
    );
    Ok(())
}
