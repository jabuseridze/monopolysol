"use client";

import { Countdown } from "./Countdown";
import { PickPanel } from "./PickPanel";
import { ResultsModal } from "./ResultsModal";
import { WalletBar } from "./WalletBar";
import { MuteButton } from "./MuteButton";

export function Hud() {
  return (
    <>
      <WalletBar />
      <Countdown />
      <PickPanel />
      <MuteButton />
      <ResultsModal />
    </>
  );
}
