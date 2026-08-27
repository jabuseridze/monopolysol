import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";
import "./panels.css";
import "./hud.css";
import "./rules.css";
import "./landing.css";
import { Providers } from "./providers";

/**
 * The display face: rounded and chunky, to match a board that is all soft
 * lowpoly shapes. The UI used to run on `system-ui`, which is the typeface of
 * an OS settings screen and caps out around semi-bold -- which is exactly why
 * nothing on screen looked chunky no matter how the weights were pushed.
 *
 * Headings, numbers and buttons only. Long body copy stays on the system stack,
 * where a display face costs more in readability than it gains in character.
 * Next self-hosts this after the first build, so there is no runtime request.
 */
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MONOPOLYSOL",
  description:
    "Guess the sum of two dice, watch the avatar walk the board, and split the pot every round on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fredoka.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
