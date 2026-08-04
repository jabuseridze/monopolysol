"use client";

import { useState } from "react";
import {
  CORE_LOOP_NOTE,
  PENALTY_OVERRIDES_GO_NOTE,
  effectRules,
  type EffectRule,
} from "@monopoly-sol/shared/effectCopy";
import { TileThumb } from "./TileThumb";

/** One card per *rule*, not per tile: `effectRules` already collapses the three
 * identical Random Pump tiles into a single entry carrying all three indices,
 * so the grid shows five cards rather than seven with duplicate artwork. */
const BOOSTS = effectRules("boost");
const PENALTIES = effectRules("penalty");

/** Balanced against the panel's height budget: big enough that the tile is
 * recognisable at a glance (the whole point of showing the real artwork),
 * small enough that all five cards fit without scrolling on a ~900px-tall
 * window. Shorter windows scroll, which is the right failure. */
const THUMB_HEIGHT = 64;

/**
 * Slide-out rules card. Only 7 of the 40 tiles carry an effect and nothing
 * else in the UI says which -- without this, "aim for Random Pump so next
 * round pays 1 SOL" is invisible unless you already know the table.
 *
 * Each rule is illustrated with a crop of the real board tile (`TileThumb`),
 * so what you read here is recognisable on the board at a glance. Every string
 * is generated from `shared/src/effectCopy.ts`, which derives its numbers from
 * the same constants the on-chain program mirrors -- no hand-written prose
 * about a prize amount.
 *
 * Returns a fragment so BOTH the trigger and the panel land as direct
 * children of `.overlay` -- the `.overlay > *` rule is what grants
 * `pointer-events: auto`, and anything nested a level deeper silently stops
 * receiving clicks with no console error to explain it.
 */
export function RulesPanel() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="rules-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Tile rules"
        aria-expanded={open}
      >
        ?
      </button>

      <aside className={`panel rules-card${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="rules-eyebrow">How it works</div>
        <p className="rules-lede">{CORE_LOOP_NOTE}</p>

        <RuleGroup title="Boosts" rules={BOOSTS} tone="boost" />
        <RuleGroup title="Penalties" rules={PENALTIES} tone="penalty" />

        <p className="rules-note">{PENALTY_OVERRIDES_GO_NOTE}</p>
      </aside>
    </>
  );
}

function RuleGroup({ title, rules, tone }: { title: string; rules: EffectRule[]; tone: string }) {
  return (
    <section className="rules-group">
      <div className={`rules-eyebrow ${tone}`}>{title}</div>
      <ul className="rules-grid">
        {rules.map((rule) => (
          <li key={rule.label} className={`rule-card ${tone}`}>
            <TileThumb index={rule.tiles[0]} height={THUMB_HEIGHT} />
            <span className="rule-name">
              <strong>{rule.label}</strong> <span className="rule-tiles">{tileList(rule.tiles)}</span>
            </span>
            <span className="rule-detail">{rule.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Board positions a rule applies to, sharing a line with the rule's name --
 * the card already carries the tile's picture, so this only has to answer
 * "where do I find it". Random Pump occupies three tiles. */
function tileList(tiles: number[]): string {
  return tiles.map((t) => `#${t}`).join(" ");
}
