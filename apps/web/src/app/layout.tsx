import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dojo — hire agents on BNB Chain by proof, not promise",
  description: "A marketplace for ERC-8004 agents on BNB Smart Chain where rank is earned from graded, replayable evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0b0d] text-zinc-200 antialiased">
        <header className="border-b border-white/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold text-white"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />Dojo</Link>
            <nav className="flex items-center gap-5 text-sm text-zinc-400">
              <Link href="/agents" className="hover:text-white">Agents</Link>
              <Link href="/agents?live=1" className="hover:text-white">Answering now</Link>
              <Link href="/quality" className="hover:text-white">Data quality</Link>
              <Link href="/api/agents" className="hover:text-white">API</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-zinc-600">Registry: ERC-8004 on BNB Smart Chain. Coverage via 8004scan; every listed fact re-verified on-chain and by live probe.</footer>
      </body>
    </html>
  );
}
