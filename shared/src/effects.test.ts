import { describe, it, expect } from "vitest";
import {
  BASE_PRIZE_LAMPORTS,
  PENALTY_PRIZE_LAMPORTS,
  RUG_PRIZE_LAMPORTS,
  PUMP_PRIZE_LAMPORTS,
  GO_BONUS_LAMPORTS,
  GUESS_MIN,
  GUESS_MAX,
  nextPrizeForLanding,
  landingFor,
  diceSumProbability,
} from "./effects";

const NUM_TILES = 40;

describe("effects", () => {
  describe("constants", () => {
    it("should export correct prize values", () => {
      expect(BASE_PRIZE_LAMPORTS).toBe(500_000_000); // 0.5 SOL
      expect(PENALTY_PRIZE_LAMPORTS).toBe(250_000_000); // 0.25 SOL
      expect(RUG_PRIZE_LAMPORTS).toBe(100_000_000); // 0.1 SOL
      expect(PUMP_PRIZE_LAMPORTS).toBe(1_000_000_000); // 1.0 SOL
      expect(GO_BONUS_LAMPORTS).toBe(100_000_000); // 0.1 SOL
    });

    it("should export guess range", () => {
      expect(GUESS_MIN).toBe(2);
      expect(GUESS_MAX).toBe(12);
    });
  });

  describe("nextPrizeForLanding", () => {
    // Penalty tiles (suppress GO bonus)
    describe("penalty tiles (Gas Fee #4, Slippage Tax #38)", () => {
      it("should return 0.25 SOL for Gas Fee (tile 4) without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 4, passedOrLandedGo: false })).toBe(
          PENALTY_PRIZE_LAMPORTS,
        );
      });

      it("should return 0.25 SOL for Gas Fee (tile 4) even with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 4, passedOrLandedGo: true })).toBe(
          PENALTY_PRIZE_LAMPORTS,
        );
      });

      it("should return 0.25 SOL for Slippage Tax (tile 38) without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 38, passedOrLandedGo: false })).toBe(
          PENALTY_PRIZE_LAMPORTS,
        );
      });

      it("should return 0.25 SOL for Slippage Tax (tile 38) even with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 38, passedOrLandedGo: true })).toBe(
          PENALTY_PRIZE_LAMPORTS,
        );
      });
    });

    // Rug tile (suppress GO bonus)
    describe("rug tile (Get Rugged #30)", () => {
      it("should return 0.1 SOL without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 30, passedOrLandedGo: false })).toBe(
          RUG_PRIZE_LAMPORTS,
        );
      });

      it("should return 0.1 SOL even with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 30, passedOrLandedGo: true })).toBe(
          RUG_PRIZE_LAMPORTS,
        );
      });
    });

    // Pump tiles (stack GO bonus)
    describe("pump tiles (Random Pump #7, #22, #36)", () => {
      it("should return 1.0 SOL for Random Pump #7 without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 7, passedOrLandedGo: false })).toBe(
          PUMP_PRIZE_LAMPORTS,
        );
      });

      it("should return 1.1 SOL for Random Pump #7 with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 7, passedOrLandedGo: true })).toBe(
          PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS,
        );
      });

      it("should return 1.0 SOL for Random Pump #22 without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 22, passedOrLandedGo: false })).toBe(
          PUMP_PRIZE_LAMPORTS,
        );
      });

      it("should return 1.1 SOL for Random Pump #22 with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 22, passedOrLandedGo: true })).toBe(
          PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS,
        );
      });

      it("should return 1.0 SOL for Random Pump #36 without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 36, passedOrLandedGo: false })).toBe(
          PUMP_PRIZE_LAMPORTS,
        );
      });

      it("should return 1.1 SOL for Random Pump #36 with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 36, passedOrLandedGo: true })).toBe(
          PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS,
        );
      });
    });

    // All other tiles (stack GO bonus)
    describe("all other tiles (base + optional GO bonus)", () => {
      it("should return 0.5 SOL for GO (tile 0) without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 0, passedOrLandedGo: false })).toBe(
          BASE_PRIZE_LAMPORTS,
        );
      });

      it("should return 0.6 SOL for GO (tile 0) with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 0, passedOrLandedGo: true })).toBe(
          BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS,
        );
      });

      it("should return 0.5 SOL for Testnet Alley (tile 1) without GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 1, passedOrLandedGo: false })).toBe(
          BASE_PRIZE_LAMPORTS,
        );
      });

      it("should return 0.6 SOL for Testnet Alley (tile 1) with GO bonus", () => {
        expect(nextPrizeForLanding({ landedTile: 1, passedOrLandedGo: true })).toBe(
          BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS,
        );
      });

      // Spot check a few more tiles to ensure the pattern holds
      it("should stack GO bonus for Airdrop Crate (tile 2)", () => {
        expect(nextPrizeForLanding({ landedTile: 2, passedOrLandedGo: false })).toBe(
          BASE_PRIZE_LAMPORTS,
        );
        expect(nextPrizeForLanding({ landedTile: 2, passedOrLandedGo: true })).toBe(
          BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS,
        );
      });

      it("should stack GO bonus for Ape Avenue (tile 6)", () => {
        expect(nextPrizeForLanding({ landedTile: 6, passedOrLandedGo: false })).toBe(
          BASE_PRIZE_LAMPORTS,
        );
        expect(nextPrizeForLanding({ landedTile: 6, passedOrLandedGo: true })).toBe(
          BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS,
        );
      });
    });
  });

  describe("comprehensive tile coverage", () => {
    // Test all 40 tiles to ensure they produce expected prizes
    const expectedPrizes = [
      // Tile 0-3
      { tile: 0, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // GO
      { tile: 1, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Testnet Alley
      { tile: 2, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Airdrop Crate
      { tile: 3, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Faucet Lane
      // Tile 4
      { tile: 4, noGo: PENALTY_PRIZE_LAMPORTS, withGo: PENALTY_PRIZE_LAMPORTS }, // Gas Fee (PENALTY)
      // Tile 5-6
      { tile: 5, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Warp Bridge
      { tile: 6, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Ape Avenue
      // Tile 7
      { tile: 7, noGo: PUMP_PRIZE_LAMPORTS, withGo: PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Random Pump
      // Tile 8-9
      { tile: 8, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Pump Plaza
      { tile: 9, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Degen Drive
      // Tile 10
      { tile: 10, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Paper Hands Jail
      // Tile 11-13
      { tile: 11, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Moon Boulevard
      { tile: 12, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Laser Eyes Lane
      { tile: 13, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Diamond Hands Way
      // Tile 14-15
      { tile: 14, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Validator Power
      { tile: 15, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Mempool Metro
      // Tile 16-19
      { tile: 16, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Liquidity Pool Road
      { tile: 17, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Airdrop Crate
      { tile: 18, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Slippage Street
      { tile: 19, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Whale Wharf
      // Tile 20
      { tile: 20, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Free Mint
      // Tile 21
      { tile: 21, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Candle Court
      // Tile 22
      { tile: 22, noGo: PUMP_PRIZE_LAMPORTS, withGo: PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Random Pump
      // Tile 23-24
      { tile: 23, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Fomo Freeway
      { tile: 24, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Rocket Row
      // Tile 25-29
      { tile: 25, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Rollup Rail
      { tile: 26, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Staking Summit
      { tile: 27, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Validator View
      { tile: 28, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Oracle Feed
      { tile: 29, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Airdrop Heights
      // Tile 30
      { tile: 30, noGo: RUG_PRIZE_LAMPORTS, withGo: RUG_PRIZE_LAMPORTS }, // Get Rugged (RUG)
      // Tile 31-35
      { tile: 31, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Yield Yard
      { tile: 32, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Alpha Acres
      { tile: 33, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Airdrop Crate
      { tile: 34, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Bull Run Boulevard
      { tile: 35, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Ledger Line
      // Tile 36
      { tile: 36, noGo: PUMP_PRIZE_LAMPORTS, withGo: PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Random Pump
      // Tile 37-39
      { tile: 37, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Genesis Grand
      { tile: 38, noGo: PENALTY_PRIZE_LAMPORTS, withGo: PENALTY_PRIZE_LAMPORTS }, // Slippage Tax (PENALTY)
      { tile: 39, noGo: BASE_PRIZE_LAMPORTS, withGo: BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS }, // Sol Summit
    ];

    it("should produce correct prizes for all 40 tiles", () => {
      for (const { tile, noGo, withGo } of expectedPrizes) {
        expect(
          nextPrizeForLanding({ landedTile: tile, passedOrLandedGo: false }),
          `tile ${tile} without GO bonus`,
        ).toBe(noGo);
        expect(
          nextPrizeForLanding({ landedTile: tile, passedOrLandedGo: true }),
          `tile ${tile} with GO bonus`,
        ).toBe(withGo);
      }
    });
  });

  describe("special effect tile groups", () => {
    // Report the specific next-prize values for the 5 special groups
    it("should report Gas Fee / Slippage Tax group prizes", () => {
      const tile4 = nextPrizeForLanding({ landedTile: 4, passedOrLandedGo: false });
      const tile38 = nextPrizeForLanding({ landedTile: 38, passedOrLandedGo: false });
      expect(tile4).toBe(PENALTY_PRIZE_LAMPORTS);
      expect(tile38).toBe(PENALTY_PRIZE_LAMPORTS);
      console.log(
        `Gas Fee/Slippage Tax next-prize: ${tile4 / 1_000_000_000} SOL (250M lamports)`,
      );
    });

    it("should report Get Rugged group prize", () => {
      const tile30 = nextPrizeForLanding({ landedTile: 30, passedOrLandedGo: false });
      expect(tile30).toBe(RUG_PRIZE_LAMPORTS);
      console.log(
        `Get Rugged next-prize: ${tile30 / 1_000_000_000} SOL (100M lamports)`,
      );
    });

    it("should report Random Pump group prizes (with and without GO)", () => {
      const tile7NoGo = nextPrizeForLanding({ landedTile: 7, passedOrLandedGo: false });
      const tile7WithGo = nextPrizeForLanding({ landedTile: 7, passedOrLandedGo: true });
      const tile22NoGo = nextPrizeForLanding({ landedTile: 22, passedOrLandedGo: false });
      const tile22WithGo = nextPrizeForLanding({ landedTile: 22, passedOrLandedGo: true });
      const tile36NoGo = nextPrizeForLanding({ landedTile: 36, passedOrLandedGo: false });
      const tile36WithGo = nextPrizeForLanding({ landedTile: 36, passedOrLandedGo: true });

      expect(tile7NoGo).toBe(PUMP_PRIZE_LAMPORTS);
      expect(tile7WithGo).toBe(PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS);
      expect(tile22NoGo).toBe(PUMP_PRIZE_LAMPORTS);
      expect(tile22WithGo).toBe(PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS);
      expect(tile36NoGo).toBe(PUMP_PRIZE_LAMPORTS);
      expect(tile36WithGo).toBe(PUMP_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS);

      console.log(
        `Random Pump next-prize: ${tile7NoGo / 1_000_000_000} SOL (1000M lamports)`,
      );
      console.log(
        `Random Pump with GO bonus: ${tile7WithGo / 1_000_000_000} SOL (1100M lamports)`,
      );
    });

    it("should report base/plain tile group prizes (with and without GO)", () => {
      const plainNoGo = nextPrizeForLanding({ landedTile: 1, passedOrLandedGo: false });
      const plainWithGo = nextPrizeForLanding({ landedTile: 1, passedOrLandedGo: true });

      expect(plainNoGo).toBe(BASE_PRIZE_LAMPORTS);
      expect(plainWithGo).toBe(BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS);

      console.log(
        `Plain tiles next-prize: ${plainNoGo / 1_000_000_000} SOL (500M lamports)`,
      );
      console.log(
        `Plain tiles with GO bonus: ${plainWithGo / 1_000_000_000} SOL (600M lamports)`,
      );
    });
  });

  describe("landingFor", () => {
    it("should compute correct landing tile", () => {
      const result = landingFor(0, 5, NUM_TILES);
      expect(result.landedTile).toBe(5);
    });

    it("should handle wraparound", () => {
      const result = landingFor(38, 5, NUM_TILES);
      expect(result.landedTile).toBe(3); // (38 + 5) % 40 = 3
    });

    it("should not pass GO when sum < num_tiles", () => {
      const result = landingFor(10, 5, NUM_TILES);
      expect(result.passedOrLandedGo).toBe(false);
    });

    it("should pass GO when start + sum >= num_tiles", () => {
      const result = landingFor(35, 5, NUM_TILES);
      expect(result.passedOrLandedGo).toBe(true); // 35 + 5 = 40 >= 40
    });

    it("should land on GO when (start + sum) % num_tiles === 0", () => {
      const result = landingFor(38, 2, NUM_TILES);
      expect(result.landedTile).toBe(0); // (38 + 2) % 40 = 0
      expect(result.passedOrLandedGo).toBe(true); // Landed on GO
    });

    it("should collapse double-count: start + sum === num_tiles", () => {
      // When start + sum exactly equals num_tiles, we both "pass GO" and "land on GO"
      // The collapsed rule should count this as exactly one GO bonus.
      const result = landingFor(28, 12, NUM_TILES);
      expect(result.landedTile).toBe(0); // (28 + 12) % 40 = 0
      expect(result.passedOrLandedGo).toBe(true);

      // Verify it only gets one GO bonus via nextPrizeForLanding
      const prize = nextPrizeForLanding({
        landedTile: result.landedTile,
        passedOrLandedGo: result.passedOrLandedGo,
      });
      // Landing on GO (tile 0) without passing it would be BASE, with passing would be BASE + GO_BONUS
      expect(prize).toBe(BASE_PRIZE_LAMPORTS + GO_BONUS_LAMPORTS);
    });

    it("should handle multiple rounds of walking", () => {
      const result1 = landingFor(0, 7, NUM_TILES);
      expect(result1.landedTile).toBe(7);
      expect(result1.passedOrLandedGo).toBe(false);

      const result2 = landingFor(result1.landedTile, 35, NUM_TILES);
      expect(result2.landedTile).toBe(2); // (7 + 35) % 40 = 2
      expect(result2.passedOrLandedGo).toBe(true); // Passed GO
    });
  });

  describe("diceSumProbability", () => {
    it("should return correct probabilities for all sums", () => {
      expect(diceSumProbability(2)).toBe(1 / 36);
      expect(diceSumProbability(3)).toBe(2 / 36);
      expect(diceSumProbability(4)).toBe(3 / 36);
      expect(diceSumProbability(5)).toBe(4 / 36);
      expect(diceSumProbability(6)).toBe(5 / 36);
      expect(diceSumProbability(7)).toBe(6 / 36); // Most likely
      expect(diceSumProbability(8)).toBe(5 / 36);
      expect(diceSumProbability(9)).toBe(4 / 36);
      expect(diceSumProbability(10)).toBe(3 / 36);
      expect(diceSumProbability(11)).toBe(2 / 36);
      expect(diceSumProbability(12)).toBe(1 / 36);
    });

    it("should sum to 1.0 across all valid sums", () => {
      let total = 0;
      for (let sum = 2; sum <= 12; sum++) {
        total += diceSumProbability(sum);
      }
      expect(total).toBeCloseTo(1.0);
    });

    it("should return 0 for invalid sums", () => {
      expect(diceSumProbability(1)).toBe(0);
      expect(diceSumProbability(13)).toBe(0);
      expect(diceSumProbability(-5)).toBe(0);
      expect(diceSumProbability(100)).toBe(0);
    });
  });
});
