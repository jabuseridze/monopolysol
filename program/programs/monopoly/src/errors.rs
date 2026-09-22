use anchor_lang::prelude::*;

#[error_code]
pub enum GameError {
    #[msg("Only the configured authority may perform this action")]
    Unauthorized,
    #[msg("Round is not accepting picks")]
    RoundNotOpen,
    #[msg("Picking window has closed")]
    PickingClosed,
    #[msg("Picking window is still open")]
    PickingStillOpen,
    #[msg("Tile index is out of range")]
    InvalidTile,
    #[msg("Round is not in the Drawn phase")]
    NotDrawn,
    #[msg("Round has already been settled")]
    AlreadySettled,
    #[msg("Round has not been settled yet")]
    NotSettled,
    #[msg("Revealed seed does not match the committed hash")]
    BadReveal,
    #[msg("This pick did not select the winning tile")]
    NotAWinner,
    #[msg("This pick has already been paid out")]
    AlreadyClaimed,
    #[msg("No winners were recorded for this round")]
    NoWinners,
    #[msg("Treasury has insufficient funds for the payout")]
    InsufficientTreasury,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Guess must be within the valid dice-sum range")]
    InvalidGuess,
    #[msg("You must hold the game token to play")]
    TokenGateFailed,
    #[msg("Round duration or prize is outside the allowed range")]
    InvalidParams,
    #[msg("Pick cannot be closed yet (round unsettled, or an unpaid winner)")]
    PickNotClosable,
    #[msg("Not every pick has been tallied yet")]
    TallyIncomplete,
    #[msg("Round has not passed its reveal deadline")]
    RoundNotExpired,
    #[msg("Pick does not belong to this round")]
    WrongRound,
    #[msg("Treasury has nothing available to withdraw")]
    NothingToWithdraw,
}
