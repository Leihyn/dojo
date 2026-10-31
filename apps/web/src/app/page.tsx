import "@/components/home/home.css";
import { Hero } from "@/components/home/Hero";
import { HowChapter, ProblemChapter, TransitionChapter } from "@/components/home/Chapters";
import { Evidence } from "@/components/home/Evidence";
import { Graded } from "@/components/home/Graded";
import { Jobs, TopAgents } from "@/components/home/Jobs";
import { Developers } from "@/components/home/Developers";
import { Faq, FinalCta, Receipts } from "@/components/home/Closing";
import type { HomeStats } from "@/components/home/types";
import { categoryCounts, filterEntries, getCatalog, gradedAgents } from "@/lib/catalog";
import { baseUrl } from "@/lib/base-url";

export default function Home() {
  const c = getCatalog();
  const q = c.quality;
  const stats: HomeStats = {
    registered: q.scanTotals["56:latest"],
    indexed: c.entries.length,
    answering: c.entries.filter((e) => e.liveStatus === "live" || e.liveStatus === "gated").length,
    live: q.live,
    gated: q.gated,
    dead: q.dead,
    unresolved: q.unresolved,
  };
  const graded = gradedAgents();
  return (
    <div className="hm-root">
      <Hero s={stats} />
      <ProblemChapter s={stats} />
      <TransitionChapter />
      <HowChapter />
      <Evidence s={stats} />
      <Graded graded={graded} />
      <Jobs counts={categoryCounts()} />
      <TopAgents entries={filterEntries({ live: true }).slice(0, 5)} answering={stats.answering} />
      <Developers apiBase={baseUrl()} />
      <Receipts />
      <Faq s={stats} graded={graded} />
      <FinalCta />
    </div>
  );
}
