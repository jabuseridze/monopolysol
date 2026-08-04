"use client";

import { Countdown } from "./Countdown";
import { PickPanel } from "./PickPanel";
import { ResultsModal } from "./ResultsModal";
import { WalletBar } from "./WalletBar";
import { MuteButton } from "./MuteButton";
import { RulesPanel } from "./RulesPanel";

export function Hud() {
  return (
    <>
      <WalletBar />
      <Countdown />
      <PickPanel />
      <MuteButton />
      <RulesPanel />
      <ResultsModal />
    </>
  );
}
