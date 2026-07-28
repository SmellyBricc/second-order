import { describe, expect, it } from "vitest";
import { BASELINE, simulate } from "./model";

describe("counterfactual model", () => {
  it("is reproducible for a seed", () => {
    expect(simulate(BASELINE, 500, 19)).toEqual(simulate(BASELINE, 500, 19));
  });

  it("returns ordered percentiles", () => {
    const result = simulate(BASELINE, 1000, 7);
    for (const distribution of Object.values(result.metrics)) {
      expect(distribution.p10).toBeLessThanOrEqual(distribution.p50);
      expect(distribution.p50).toBeLessThanOrEqual(distribution.p90);
    }
  });

  it("higher engineering depth improves median reliability", () => {
    const shallow = simulate({ ...BASELINE, engineeringDepth: 0.15 }, 3000, 8);
    const deep = simulate({ ...BASELINE, engineeringDepth: 0.9 }, 3000, 8);
    expect(deep.metrics.reliability.p50).toBeGreaterThan(shallow.metrics.reliability.p50);
  });
});
