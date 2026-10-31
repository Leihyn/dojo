export interface HomeStats {
  registered: number | undefined;
  indexed: number;
  answering: number;
  live: number;
  gated: number;
  dead: number;
  unresolved: number;
}

/** Thousands separators, fixed locale so server and client render the same string. */
export function n(x: number): string {
  return x.toLocaleString("en-US");
}

/** Registration names use em dashes as separators; copy on this page avoids them. */
export function plainName(name: string): string {
  return name.replace(/\s*[–—]\s*/g, ", ");
}
