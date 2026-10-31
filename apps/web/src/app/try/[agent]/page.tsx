import Link from "next/link";
import { notFound } from "next/navigation";
import { REF_AGENTS, type RefAgentName } from "@dojo/core";
import { TryAgent } from "@/components/TryAgent";

/**
 * Prefill values for sample inputs that ship empty, so the first run shows a real result.
 * The Venus account is the one the Health Sentinel falls back to when none is given.
 */
const EXAMPLES: Partial<Record<RefAgentName, Record<string, unknown>>> = {
  "venus-health": { account: "0x33b914FC1b1fE541fBa51B0ebdA8dB810B4FC979" },
};

export default async function TryPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const def = REF_AGENTS[agent as RefAgentName];
  if (!def) notFound();
  const others = (Object.keys(REF_AGENTS) as RefAgentName[]).filter((n) => n !== def.name);
  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <div className="caps">Reference agent · {def.category}</div>
        <h1 className="mt-2 text-4xl text-ink">{def.title}</h1>
        <p className="mt-3 text-base text-ink-2">{def.description}</p>
      </div>
      <TryAgent name={def.name} title={def.title} sampleInput={{ ...def.sampleInput, ...EXAMPLES[def.name] }} />
      <nav aria-label="Other reference agents" className="border-t border-line pt-6 text-sm text-ink-2">
        <span className="caps mr-3">Try another</span>
        {others.map((n) => (
          <Link key={n} href={`/try/${n}`} className="mr-4 inline-flex min-h-[var(--hit)] items-center underline underline-offset-4 hover:text-ink">{REF_AGENTS[n].title}</Link>
        ))}
      </nav>
    </div>
  );
}
