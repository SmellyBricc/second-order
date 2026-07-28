import { BASELINE, type Levers, type MetricId } from "./model";

export type ScenarioId = "balanced" | "launch-sprint" | "quality-moat" | "premium-bet";

export interface Scenario {
  id: ScenarioId;
  name: string;
  thesis: string;
  levers: Levers;
}

export interface ScenarioState {
  levers: Levers;
  seed: number;
  focus: MetricId;
}

export interface MetricExplanation {
  title: string;
  summary: string;
  drivers: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: "balanced",
    name: "Balanced",
    thesis: "Keep urgency, technical depth, and price near the reference case.",
    levers: BASELINE,
  },
  {
    id: "launch-sprint",
    name: "Launch sprint",
    thesis: "Trade technical depth for speed and early market learning.",
    levers: { shippingPressure: 0.82, engineeringDepth: 0.34, priceChange: 0.42 },
  },
  {
    id: "quality-moat",
    name: "Quality moat",
    thesis: "Slow the cadence and invest in reliability users can feel.",
    levers: { shippingPressure: 0.3, engineeringDepth: 0.9, priceChange: 0.58 },
  },
  {
    id: "premium-bet",
    name: "Premium bet",
    thesis: "Use a higher price to buy resilience without abandoning quality.",
    levers: { shippingPressure: 0.44, engineeringDepth: 0.7, priceChange: 0.84 },
  },
];

const clamp = (value: number) => Math.min(1, Math.max(0, value));

const parseUnit = (value: string | null, fallback: number) => {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed) : fallback;
};

export const scenarioStateFromSearch = (search: string): ScenarioState => {
  const params = new URLSearchParams(search);
  const parsedSeed = Number(params.get("seed"));
  const requestedFocus = params.get("focus");
  const focus: MetricId =
    requestedFocus === "adoption" ||
    requestedFocus === "reliability" ||
    requestedFocus === "runway" ||
    requestedFocus === "teamLoad" ||
    requestedFocus === "trust"
      ? requestedFocus
      : "trust";
  return {
    levers: {
      shippingPressure: parseUnit(params.get("ship"), BASELINE.shippingPressure),
      engineeringDepth: parseUnit(params.get("depth"), BASELINE.engineeringDepth),
      priceChange: parseUnit(params.get("price"), BASELINE.priceChange),
    },
    seed:
      Number.isInteger(parsedSeed) && parsedSeed > 0 && parsedSeed <= 2_147_483_647
        ? parsedSeed
        : 2607,
    focus,
  };
};

export const scenarioSearch = (levers: Levers, seed: number, focus: MetricId = "trust") => {
  const params = new URLSearchParams({
    ship: levers.shippingPressure.toFixed(2),
    depth: levers.engineeringDepth.toFixed(2),
    price: levers.priceChange.toFixed(2),
    seed: String(seed),
    focus,
  });
  return `?${params.toString()}`;
};

export const matchingScenario = (levers: Levers) =>
  SCENARIOS.find(
    (scenario) =>
      Math.abs(scenario.levers.shippingPressure - levers.shippingPressure) < 0.005 &&
      Math.abs(scenario.levers.engineeringDepth - levers.engineeringDepth) < 0.005 &&
      Math.abs(scenario.levers.priceChange - levers.priceChange) < 0.005,
  );

const direction = (value: number, positive: string, negative: string) => {
  if (Math.abs(value) < 0.015) return "This lever stays near the reference case.";
  return value > 0 ? positive : negative;
};

export const explainMetric = (metric: MetricId, levers: Levers): MetricExplanation => {
  const shipping = levers.shippingPressure - BASELINE.shippingPressure;
  const depth = levers.engineeringDepth - BASELINE.engineeringDepth;
  const price = levers.priceChange - BASELINE.priceChange;
  const unchanged = Math.abs(shipping) + Math.abs(depth) + Math.abs(price) < 0.015;

  if (unchanged) {
    return {
      title: "Reference case",
      summary: "The selected scenario matches the model’s baseline assumptions.",
      drivers: [
        "Move any lever to expose its direct and second-order effects.",
        "The P10–P90 range still shows uncertainty inside the reference case.",
      ],
    };
  }

  const explanations: Record<MetricId, MetricExplanation> = {
    adoption: {
      title: "Why adoption moved",
      summary: "Adoption combines time-to-market, affordability, reliability, and demand noise.",
      drivers: [
        direction(
          shipping,
          "More shipping pressure creates an earlier-market advantage.",
          "Less shipping pressure gives up some early-market advantage.",
        ),
        direction(
          price,
          "A higher price creates more adoption friction.",
          "A lower price reduces adoption friction.",
        ),
        direction(
          depth,
          "Deeper engineering can support adoption through reliability.",
          "Shallower engineering can weaken adoption through reliability.",
        ),
      ],
    },
    reliability: {
      title: "Why reliability moved",
      summary: "Reliability is the clearest contest between engineering depth and defect pressure.",
      drivers: [
        direction(
          depth,
          "More engineering depth raises the system’s reliability ceiling.",
          "Less engineering depth lowers the system’s reliability ceiling.",
        ),
        direction(
          shipping,
          "More shipping pressure adds defect pressure.",
          "Less shipping pressure removes defect pressure.",
        ),
      ],
    },
    trust: {
      title: "Why trust moved",
      summary: "Trust compounds reliability, durable engineering, and visible defect pressure.",
      drivers: [
        direction(
          depth,
          "Deeper engineering supports trust directly and through reliability.",
          "Shallower engineering weakens both trust channels.",
        ),
        direction(
          shipping,
          "More shipping pressure can erode trust when defects surface.",
          "Less shipping pressure protects trust from defect pressure.",
        ),
      ],
    },
    runway: {
      title: "Why runway moved",
      summary: "Runway balances price and adoption against engineering investment and team strain.",
      drivers: [
        direction(
          price,
          "A higher price directly strengthens the revenue side of runway.",
          "A lower price asks adoption to carry more of the runway burden.",
        ),
        direction(
          depth,
          "Deeper engineering spends more runway before its quality effects arrive.",
          "Shallower engineering preserves near-term runway.",
        ),
        direction(
          shipping,
          "More shipping pressure can raise team load and reduce resilience.",
          "Less shipping pressure can reduce team strain.",
        ),
      ],
    },
    teamLoad: {
      title: "Why team load moved",
      summary: "Team load rises with urgency and falls when engineering depth absorbs repeat work.",
      drivers: [
        direction(
          shipping,
          "More shipping pressure is the strongest source of sustained strain.",
          "Less shipping pressure removes the strongest source of strain.",
        ),
        direction(
          depth,
          "Deeper engineering reduces repeated delivery friction.",
          "Shallower engineering leaves more repeated delivery friction.",
        ),
      ],
    },
  };

  return explanations[metric];
};
