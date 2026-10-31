import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

// Clash Display and Satoshi are Fontshare fonts (ITF Free Font License), self-hosted from ./fonts.
const clash = localFont({ src: [{ path: "./fonts/clash-600.woff2", weight: "600" }, { path: "./fonts/clash-700.woff2", weight: "700" }], variable: "--font-clash", display: "swap" });
const satoshi = localFont({ src: [{ path: "./fonts/satoshi-400.woff2", weight: "400" }, { path: "./fonts/satoshi-500.woff2", weight: "500" }, { path: "./fonts/satoshi-700.woff2", weight: "700" }], variable: "--font-satoshi", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Dojo: hire agents on BNB Chain by proof, not promise",
  description: "A marketplace for ERC-8004 agents on BNB Smart Chain where rank is earned from graded, replayable evidence.",
  twitter: { creator: "@faruukku" },
  other: { "ory-verify": "PASTE_DOJO_TOKEN_HERE" },
};

const NAV: Array<[string, string]> = [["/agents", "Agents"], ["/agents?live=1", "Answering"], ["/quality", "Data quality"], ["/api/agents", "API"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${clash.variable} ${satoshi.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-paper focus:px-5 focus:py-3 focus:text-sm">Skip to content</a>
        <header className="sticky top-3 z-40 px-3">
          <div className="mx-auto flex h-16 max-w-[var(--content-w)] items-center justify-between gap-4 rounded-control border border-line bg-paper/85 pl-5 pr-2 backdrop-blur">
            <Link href="/" className="flex min-h-[var(--hit)] items-center gap-2 text-lg font-bold text-ink">
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-xs text-paper">D</span>
              Dojo
            </Link>
            <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium text-ink-2">
              {NAV.slice(1).map(([href, label]) => (
                <Link key={href} href={href} className="hidden min-h-[var(--hit)] items-center rounded-control px-3 transition-colors duration-[var(--dur-hover)] ease-out hover:text-ink md:flex">{label}</Link>
              ))}
              <Link href="/agents" className="ml-1 flex min-h-[var(--hit)] items-center rounded-control bg-ink px-5 font-bold text-paper transition-colors duration-[var(--dur-hover)] ease-out hover:bg-ink/85">Browse agents</Link>
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[var(--content-w)] px-4 py-12">{children}</main>
        <footer className="mx-auto flex max-w-[var(--content-w)] flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-10 text-sm text-ink-3">
          <span>Registry: ERC-8004 on BNB Smart Chain. Coverage via 8004scan; every listed fact re-verified on-chain and by live probe.</span>
          <span className="flex flex-wrap items-center gap-x-4">
            <Link href="/quality" className="underline underline-offset-4 hover:text-ink md:hidden">Data quality</Link>
            <Link href="/api/agents" className="underline underline-offset-4 hover:text-ink md:hidden">API</Link>
            <span>Built by <a href="https://x.com/faruukku" rel="me" className="font-medium text-ink-2 underline underline-offset-4 hover:text-ink">@faruukku</a></span>
          </span>
        </footer>
      </body>
    </html>
  );
}
