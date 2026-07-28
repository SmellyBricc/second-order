import { describe, expect, it } from "vitest";
import { BASELINE } from "./model";
import {
  SCENARIOS,
  explainMetric,
  matchingScenario,
  scenarioSearch,
  scenarioStateFromSearch,
} from "./scenarios";

describe("scenario utilities", () => {
  it("round-trips levers and seed through a shareable URL", () => {
    const state = { levers: SCENARIOS[2].levers, seed: 9012, focus: "reliability" as const };
    expect(scenarioStateFromSearch(scenarioSearch(state.levers, state.seed, state.focus))).toEqual(
      state,
    );
  });

  it("clamps unsafe URL values and falls back from invalid values", () => {
    const parsed = scenarioStateFromSearch("?ship=9&depth=nope&price=-2&seed=-1");
    expect(parsed.levers).toEqual({
      shippingPressure: 1,
      engineeringDepth: BASELINE.engineeringDepth,
      priceChange: 0,
    });
    expect(parsed.seed).toBe(2607);
    expect(parsed.focus).toBe("trust");
  });

  it("recognizes presets and explains their causal drivers", () => {
    expect(matchingScenario(SCENARIOS[1].levers)?.id).toBe("launch-sprint");
    const explanation = explainMetric("reliability", SCENARIOS[1].levers);
    expect(explanation.title).toBe("Why reliability moved");
    expect(explanation.drivers.join(" ")).toContain("defect pressure");
  });
});
