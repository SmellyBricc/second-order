export interface Levers {
  shippingPressure: number;
  engineeringDepth: number;
  priceChange: number;
}

export type MetricId = "adoption" | "reliability" | "runway" | "teamLoad" | "trust";

export interface Distribution {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

export interface SimulationResult {
  iterations: number;
  seed: number;
  metrics: Record<MetricId, Distribution>;
}

export const BASELINE: Levers = {
  shippingPressure: 0.46,
  engineeringDepth: 0.54,
  priceChange: 0.5,
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const mulberry32 = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const normal = (random: () => number) => {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
};

const summarize = (values: number[]): Distribution => {
  values.sort((a, b) => a - b);
  const at = (percentile: number) => values[Math.floor((values.length - 1) * percentile)];
  return {
    p10: at(0.1),
    p50: at(0.5),
    p90: at(0.9),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
};

export const simulate = (
  levers: Levers,
  iterations = 10_000,
  seed = 2607,
): SimulationResult => {
  const random = mulberry32(seed);
  const values: Record<MetricId, number[]> = {
    adoption: [],
    reliability: [],
    runway: [],
    teamLoad: [],
    trust: [],
  };

  for (let index = 0; index < iterations; index += 1) {
    const marketNoise = normal(random);
    const executionNoise = normal(random);
    const demandNoise = normal(random);

    const timeAdvantage = levers.shippingPressure * 1.45 - 0.52;
    const defectPressure =
      levers.shippingPressure * 1.12 -
      levers.engineeringDepth * 1.3 +
      executionNoise * 0.28;
    const affordability = (0.5 - levers.priceChange) * 1.15;

    const reliability = sigmoid(
      0.42 + levers.engineeringDepth * 2.3 - defectPressure * 1.34 + executionNoise * 0.18,
    );
    const teamLoad = sigmoid(
      -0.45 +
        levers.shippingPressure * 2.05 -
        levers.engineeringDepth * 0.72 +
        executionNoise * 0.36,
    );
    const adoption = sigmoid(
      -0.38 +
        timeAdvantage * 1.12 +
        affordability * 0.82 +
        reliability * 0.92 +
        marketNoise * 0.46,
    );
    const trust = sigmoid(
      -0.68 +
        reliability * 2.15 +
        levers.engineeringDepth * 0.72 -
        Math.max(0, defectPressure) * 0.86 +
        marketNoise * 0.22,
    );
    const runway = sigmoid(
      -0.14 +
        levers.priceChange * 1.34 +
        adoption * 0.9 -
        levers.engineeringDepth * 0.42 -
        teamLoad * 0.3 +
        demandNoise * 0.38,
    );

    values.adoption.push(clamp(adoption));
    values.reliability.push(clamp(reliability));
    values.runway.push(clamp(runway));
    values.teamLoad.push(clamp(teamLoad));
    values.trust.push(clamp(trust));
  }

  return {
    iterations,
    seed,
    metrics: {
      adoption: summarize(values.adoption),
      reliability: summarize(values.reliability),
      runway: summarize(values.runway),
      teamLoad: summarize(values.teamLoad),
      trust: summarize(values.trust),
    },
  };
};
