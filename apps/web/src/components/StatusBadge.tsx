import type { ProbeState } from "@dojo/core";

const STYLES: Record<ProbeState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  gated: { label: "Live · gated", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  dead: { label: "No answer", cls: "bg-rose-500/15 text-rose-300 border-rose-500/40" },
  unresolved: { label: "Bad endpoint", cls: "bg-zinc-500/15 text-zinc-300 border-zinc-500/40" },
  skipped: { label: "No endpoint", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-600/40" },
};

export function StatusBadge({ state, title }: { state: ProbeState; title?: string }) {
  const s = STYLES[state];
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state === "live" ? "bg-emerald-400" : state === "gated" ? "bg-amber-400" : state === "dead" ? "bg-rose-400" : "bg-zinc-400"}`} />
      {s.label}
    </span>
  );
}
