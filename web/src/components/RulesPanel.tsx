"use client";

import { useState } from "react";
import {
  CORE_LOOP_NOTE,
  PENALTY_OVERRIDES_GO_NOTE,
  effectRules,
  type EffectRule,
} from "@monopoly-sol/shared/effectCopy";

const BOOSTS = effectRules("boost");
const PENALTIES = effectRules("penalty");

/**
 * Slide-out rules card. Only 7 of the 40 tiles carry an effect and nothing
 * else in the UI says which -- without this, "aim for Random Pump so next
 * round pays 1 SOL" is invisible unless you already know the table.
 *
 * Every string is generated from `shared/src/effectCopy.ts`, which derives its
 * numbers from the same constants the on-chain program mirrors. Nothing here
 * is hand-written prose about a prize amount.
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
        className="btn ghost rules-trigger"
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
    <section>
      <div className="rules-eyebrow">{title}</div>
      <ul className="rules-list">
        {rules.map((rule) => (
          <li key={rule.label}>
            <span className={`rules-swatch ${tone}`} aria-hidden />
            <div>
              <strong>{rule.label}</strong>
              <span className="rules-tiles">{tileList(rule.tiles)}</span>
              <div className="rules-detail">{rule.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Board positions a rule applies to. Each rule already shows its tile name
 * as the headline, so repeating it per index just reads as stutter -- Random
 * Pump occupies three tiles and would print its own name three times. */
function tileList(tiles: number[]): string {
  return `${tiles.length > 1 ? "Tiles" : "Tile"} ${tiles.join(" · ")}`;
}
