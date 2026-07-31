import { PresenceDTO } from "@monopoly-sol/shared";

/**
 * Tracks which connected sockets have announced a wallet (via `client:hello`)
 * and throttles the resulting `presence` broadcast so rapid connect/
 * disconnect churn (e.g. a page reload cycling several sockets in a burst)
 * coalesces into at most one broadcast per `throttleMs`, trailing-edge.
 */
export class PresenceTracker {
  private readonly wallets = new Map<string, string | null>();
  private pending: NodeJS.Timeout | null = null;

  constructor(
    private readonly getGuessCounts: () => Record<number, number>,
    private readonly broadcast: (p: PresenceDTO) => void,
    private readonly throttleMs = 1000
  ) {}

  /** `walletBase58` is null for a spectator (no wallet connected yet). */
  hello(socketId: string, walletBase58: string | null): void {
    this.wallets.set(socketId, walletBase58);
    this.scheduleBroadcast();
  }

  disconnect(socketId: string): void {
    if (!this.wallets.delete(socketId)) return;
    this.scheduleBroadcast();
  }

  /** Distinct non-null wallets currently connected. */
  onlineWallets(): number {
    const distinct = new Set<string>();
    for (const w of this.wallets.values()) {
      if (w) distinct.add(w);
    }
    return distinct.size;
  }

  private scheduleBroadcast(): void {
    if (this.pending) return; // already coalescing a burst
    this.pending = setTimeout(() => {
      this.pending = null;
      this.broadcast({ onlineWallets: this.onlineWallets(), guessCounts: this.getGuessCounts() });
    }, this.throttleMs);
  }
}
