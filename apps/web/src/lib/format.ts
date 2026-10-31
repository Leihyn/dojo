export function ago(iso: string | undefined | null): string {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${Math.round(s)}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function pct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
}

export function shortAddr(a: string | null | undefined): string {
  if (!a) return "–";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Registration files list the same protocol under different cases ("Web", "WEB"); show each once. */
export function protocolList(protocols: string[]): string {
  return [...new Set(protocols.map((p) => p.toUpperCase()))].join(" · ");
}

/** A registration URI can be a multi-kilobyte base64 data URI; show its kind and a short head. */
export function shortUri(uri: string | null | undefined): string {
  if (!uri) return "none";
  if (uri.startsWith("data:")) return `${uri.slice(0, uri.indexOf(",") + 1)}… (${uri.length.toLocaleString()} chars inline)`;
  return uri.length > 64 ? `${uri.slice(0, 48)}…${uri.slice(-12)}` : uri;
}

export function chainName(id: number): string {
  return id === 56 ? "BSC" : id === 97 ? "BSC testnet" : `chain ${id}`;
}
