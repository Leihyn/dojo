import { describe, expect, it } from "vitest";
import { classify } from "../src/classify";

describe("classify", () => {
  const cases: Array<[string, string]> = [
    ["Watches your Venus and Aave positions and repays before the health factor drops below 1.1", "health-factor"],
    ["Liquidation protection bot for lending positions on BSC", "health-factor"],
    ["Runs a grid trading strategy between two prices on PancakeSwap", "grid"],
    ["Moves stablecoins between Venus, Lista and Aave to the highest APY", "yield"],
    ["Auto-compounding vault optimiser", "yield"],
    ["Rebalances concentrated liquidity ranges on PancakeSwap v3 when price leaves the range", "rebalancing"],
    ["Wallet tracker that alerts you when a whale moves funds", "monitoring"],
    ["Copy-trade agent that mirrors a wallet's swaps", "trading"],
    ["Token security scan and rug-pull analysis", "research"],
    ["An EvoEvo AI Agent focused on sports.", "other"],
  ];
  for (const [text, expected] of cases) {
    it(`"${text.slice(0, 40)}" -> ${expected}`, () => {
      expect(classify(text).category).toBe(expected);
    });
  }
  it("reports matched terms as evidence", () => {
    const c = classify("grid bot with liquidation alerts");
    expect(c.matched.length).toBeGreaterThan(1);
    expect(c.confidence).toBeGreaterThan(0);
    expect(c.confidence).toBeLessThanOrEqual(1);
  });
});

import { displayName } from "../src/catalog";

describe("displayName", () => {
  it("prefers the agent card when the registry name is a scaffold placeholder", () => {
    expect(displayName("studio-agent", "healthfactor-agent")).toBe("healthfactor-agent");
    expect(displayName("", "b8xrebal-agent")).toBe("b8xrebal-agent");
    expect(displayName("Brain on BNB", "brain")).toBe("Brain on BNB");
    expect(displayName(undefined, undefined)).toBeUndefined();
  });
});
