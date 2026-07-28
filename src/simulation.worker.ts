/// <reference lib="webworker" />

import { simulate, type Levers } from "./model";

export interface SimulationRequest {
  id: number;
  levers: Levers;
  seed: number;
}

self.onmessage = (event: MessageEvent<SimulationRequest>) => {
  const { id, levers, seed } = event.data;
  const result = simulate(levers, 10_000, seed);
  self.postMessage({ id, result });
};

export {};
