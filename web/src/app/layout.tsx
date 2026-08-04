import type { Metadata } from "next";
import "./globals.css";
import "./hud.css";
import "./rules.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Meme Mogul - SOL Edition",
  description:
    "Pick a property, watch the hologram spin, and split the pot every 2 minutes on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
