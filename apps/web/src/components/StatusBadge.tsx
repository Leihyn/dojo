import type { ProbeState } from "@dojo/core";

// Severity is a dot, a word and a color, never color alone.
const STYLES: Record<ProbeState, { label: string; text: string; dot: string }> = {
  live: { label: "Answered", text: "text-ok", dot: "bg-ok" },
  gated: { label: "Answered, gated", text: "text-watch", dot: "bg-watch" },
  dead: { label: "No answer", text: "text-critical", dot: "bg-critical" },
  unresolved: { label: "Bad endpoint", text: "text-warn", dot: "bg-warn" },
  skipped: { label: "No endpoint", text: "text-ink-3", dot: "bg-ink-3" },
};

export function StatusBadge({ state, title }: { state: ProbeState; title?: string }) {
  const s = STYLES[state];
  return (
    <span title={title} className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${s.text}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
