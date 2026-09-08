import { describe, expect, it } from "vitest";
import { computeHealth } from "../src/venus";

const E18 = 10n ** 18n;
const A = "0x0000000000000000000000000000000000000001" as const;
const V = "0x0000000000000000000000000000000000000002" as const;

describe("computeHealth", () => {
  // 1 vToken unit = 1 underlying (exchangeRate 1e18), price $1 (1e18 for an 18-decimal token), CF 80%.
  const base = { vToken: V, symbol: "vUSDT", exchangeRate: E18, price: E18, collateralFactor: (8n * E18) / 10n };
  it("computes health factor and matches the protocol view", () => {
    const rows = [{ ...base, vTokenBalance: 1000n * E18, borrowBalance: 400n * E18 }];
    const h = computeHealth(A, rows, { liquidity: 400n * E18, shortfall: 0n });
    expect(h.collateralUsd).toBeCloseTo(1000, 6);
    expect(h.weightedCollateralUsd).toBeCloseTo(800, 6);
    expect(h.borrowUsd).toBeCloseTo(400, 6);
    expect(h.healthFactor).toBeCloseTo(2, 6);
    expect(h.liquidationDrawdown).toBeCloseTo(0.5, 6);
    expect(h.crossCheck.ok).toBe(true);
    expect(h.status).toBe("healthy");
  });
  it("flags a liquidatable account and a cross-check mismatch", () => {
    const rows = [{ ...base, vTokenBalance: 1000n * E18, borrowBalance: 900n * E18 }];
    const h = computeHealth(A, rows, { liquidity: 0n, shortfall: 100n * E18 });
    expect(h.status).toBe("liquidatable");
    expect(h.crossCheck.ok).toBe(true);
    const wrong = computeHealth(A, rows, { liquidity: 500n * E18, shortfall: 0n });
    expect(wrong.crossCheck.ok).toBe(false);
  });
  it("handles no borrow and the danger band", () => {
    expect(computeHealth(A, [{ ...base, vTokenBalance: 10n * E18, borrowBalance: 0n }], { liquidity: 8n * E18, shortfall: 0n }).status).toBe("no-borrow");
    expect(computeHealth(A, [{ ...base, vTokenBalance: 1000n * E18, borrowBalance: 760n * E18 }], { liquidity: 40n * E18, shortfall: 0n }).status).toBe("danger");
  });
});
