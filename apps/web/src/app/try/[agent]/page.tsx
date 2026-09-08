import { notFound } from "next/navigation";
import { REF_AGENTS, type RefAgentName } from "@dojo/core";
import { TryAgent } from "@/components/TryAgent";

export default async function TryPage({ params }: { params: Promise<{ agent: string }> }) {
  const { agent } = await params;
  const def = REF_AGENTS[agent as RefAgentName];
  if (!def) notFound();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-zinc-500">Reference agent · {def.category}</div>
        <h1 className="mt-1 text-2xl font-semibold text-white">{def.title}</h1>
        <p className="mt-2 text-sm text-zinc-400">{def.description}</p>
      </div>
      <TryAgent name={def.name} sampleInput={def.sampleInput} />
    </div>
  );
}
