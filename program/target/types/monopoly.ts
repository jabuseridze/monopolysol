/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/monopoly.json`.
 */
export type Monopoly = {
  "address": "ENAjUrMvqvzjM7Fr7qM19FTpurYYAB9BzLygz8xgbL3d",
  "metadata": {
    "name": "monopoly",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "On-chain program for the Monopoly-on-Solana game (provably-fair rounds). Hand-written IDL: Anchor's own idl-build compilation step is broken in this environment (borsh trait-version conflict inherent to anchor-lang 0.30.1 + a current solana-program release; reproduced on a vanilla anchor init scaffold, not caused by this program's code). The deployable program binary itself compiles cleanly via `anchor build --no-idl`. Regenerate this file by hand whenever instructions/accounts change until upstream is fixed or anchor-lang is major-version-bumped."
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "prizeLamports",
          "type": "u64"
        },
        {
          "name": "numTiles",
          "type": "u16"
        },
        {
          "name": "roundDuration",
          "type": "u32"
        }
      ]
    },
    {
      "name": "fundTreasury",
      "discriminator": [
        71,
        154,
        45,
        220,
        206,
        32,
        174,
        239
      ],
      "accounts": [
        {
          "name": "funder",
          "writable": true,
          "signer": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "openRound",
      "discriminator": [
        66,
        235,
        123,
        240,
        8,
        35,
        185,
        159
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "treasury"
        },
        {
          "name": "round",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "commitHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "submitGuess",
      "discriminator": [
        61,
        124,
        32,
        227,
        64,
        198,
        252,
        3
      ],
      "accounts": [
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "round",
          "writable": true
        },
        {
          "name": "pick",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "guess",
          "type": "u16"
        }
      ]
    },
    {
      "name": "revealAndDraw",
      "discriminator": [
        19,
        131,
        158,
        218,
        153,
        80,
        102,
        197
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "round",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "seed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "settle",
      "discriminator": [
        175,
        42,
        185,
        87,
        144,
        131,
        102,
        212
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "round",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "winnersCount",
          "type": "u32"
        }
      ]
    },
    {
      "name": "payout",
      "discriminator": [
        149,
        140,
        194,
        236,
        174,
        189,
        6,
        239
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "config"
        },
        {
          "name": "round"
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "pick",
          "writable": true
        },
        {
          "name": "winner",
          "writable": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "globalConfig",
      "discriminator": [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
      ]
    },
    {
      "name": "treasury",
      "discriminator": [
        238,
        239,
        123,
        238,
        89,
        1,
        168,
        253
      ]
    },
    {
      "name": "round",
      "discriminator": [
        87,
        127,
        165,
        51,
        73,
        78,
        116,
        174
      ]
    },
    {
      "name": "playerPick",
      "discriminator": [
        173,
        206,
        121,
        219,
        132,
        29,
        236,
        249
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the configured authority may perform this action"
    },
    {
      "code": 6001,
      "name": "roundNotOpen",
      "msg": "Round is not accepting picks"
    },
    {
      "code": 6002,
      "name": "pickingClosed",
      "msg": "Picking window has closed"
    },
    {
      "code": 6003,
      "name": "pickingStillOpen",
      "msg": "Picking window is still open"
    },
    {
      "code": 6004,
      "name": "invalidTile",
      "msg": "Tile index is out of range"
    },
    {
      "code": 6005,
      "name": "notDrawn",
      "msg": "Round is not in the Drawn phase"
    },
    {
      "code": 6006,
      "name": "alreadySettled",
      "msg": "Round has already been settled"
    },
    {
      "code": 6007,
      "name": "notSettled",
      "msg": "Round has not been settled yet"
    },
    {
      "code": 6008,
      "name": "badReveal",
      "msg": "Revealed seed does not match the committed hash"
    },
    {
      "code": 6009,
      "name": "notAWinner",
      "msg": "This pick did not select the winning tile"
    },
    {
      "code": 6010,
      "name": "alreadyClaimed",
      "msg": "This pick has already been paid out"
    },
    {
      "code": 6011,
      "name": "noWinners",
      "msg": "No winners were recorded for this round"
    },
    {
      "code": 6012,
      "name": "insufficientTreasury",
      "msg": "Treasury has insufficient funds for the payout"
    },
    {
      "code": 6013,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6014,
      "name": "invalidGuess",
      "msg": "Guess must be within the valid dice-sum range"
    }
  ],
  "types": [
    {
      "name": "phase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "drawn"
          },
          {
            "name": "settled"
          }
        ]
      }
    },
    {
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "configBump",
            "type": "u8"
          },
          {
            "name": "treasuryBump",
            "type": "u8"
          },
          {
            "name": "prizeLamports",
            "type": "u64"
          },
          {
            "name": "nextPrizeLamports",
            "type": "u64"
          },
          {
            "name": "numTiles",
            "type": "u16"
          },
          {
            "name": "roundDuration",
            "type": "u32"
          },
          {
            "name": "currentRound",
            "type": "u64"
          },
          {
            "name": "avatarPosition",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "treasury",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "round",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "phase"
              }
            }
          },
          {
            "name": "commitHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "revealedSeed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "landedTile",
            "type": "u16"
          },
          {
            "name": "winnersCount",
            "type": "u32"
          },
          {
            "name": "totalPicks",
            "type": "u32"
          },
          {
            "name": "prizeLamports",
            "type": "u64"
          },
          {
            "name": "openedAt",
            "type": "i64"
          },
          {
            "name": "locksAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "diceA",
            "type": "u8"
          },
          {
            "name": "diceB",
            "type": "u8"
          },
          {
            "name": "startTile",
            "type": "u16"
          },
          {
            "name": "nextPrizeLamports",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "playerPick",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "roundId",
            "type": "u64"
          },
          {
            "name": "guess",
            "type": "u16"
          },
          {
            "name": "claimed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
