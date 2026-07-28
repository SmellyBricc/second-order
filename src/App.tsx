import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BASELINE,
  simulate,
  type Distribution,
  type Levers,
  type MetricId,
  type SimulationResult,
} from "./model";
import type { SimulationRequest } from "./simulation.worker";

const METRICS: Array<{ id: MetricId; label: string; note: string; inverse?: boolean }> = [
  { id: "adoption", label: "Adoption", note: "Likelihood of repeat use" },
  { id: "reliability", label: "Reliability", note: "Healthy sessions" },
  { id: "trust", label: "Trust", note: "Users willing to recommend" },
  { id: "runway", label: "Runway", note: "Financial resilience" },
  { id: "teamLoad", label: "Team load", note: "Sustained delivery strain", inverse: true },
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

const deltaLabel = (current: Distribution, baseline: Distribution, inverse = false) => {
  const raw = (current.p50 - baseline.p50) * (inverse ? -1 : 1);
  const points = Math.round(raw * 100);
  if (points === 0) return "no material change";
  return `${points > 0 ? "+" : "−"}${Math.abs(points)} pts ${points > 0 ? "better" : "worse"}`;
};

function Range({
  distribution,
  baseline,
}: {
  distribution: Distribution;
  baseline?: Distribution;
}) {
  const currentStyle = {
    transform: `translateX(${distribution.p10 * 100}%) scaleX(${Math.max(0.01, distribution.p90 - distribution.p10)})`,
  };
  const medianStyle = { left: `${distribution.p50 * 100}%` };
  const baselineStyle = baseline ? { left: `${baseline.p50 * 100}%` } : undefined;
  return (
    <div className="range" aria-hidden="true">
      <span className="range-fill" style={currentStyle} />
      <i className="range-median" style={medianStyle} />
      {baselineStyle ? <i className="range-baseline" style={baselineStyle} /> : null}
    </div>
  );
}

const path = (fromX: number, fromY: number, toX: number, toY: number) =>
  `M ${fromX} ${fromY} C ${(fromX + toX) / 2} ${fromY}, ${(fromX + toX) / 2} ${toY}, ${toX} ${toY}`;

export function App() {
  const [levers, setLevers] = useState<Levers>(BASELINE);
  const [baseline, setBaseline] = useState<SimulationResult>(() => simulate(BASELINE, 2500, 2607));
  const [result, setResult] = useState<SimulationResult>(baseline);
  const [pending, setPending] = useState(false);
  const [seed, setSeed] = useState(2607);
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<{ id: number; result: SimulationResult }>) => {
      if (event.data.id !== requestRef.current) return;
      setResult(event.data.result);
      setPending(false);
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const runSimulation = () => {
    const id = requestRef.current + 1;
    requestRef.current = id;
    setPending(true);
    const request: SimulationRequest = { id, levers, seed };
    workerRef.current?.postMessage(request);
  };

  const reset = () => {
    setLevers(BASELINE);
    setResult(baseline);
    setSeed(2607);
  };

  const headline = useMemo(() => {
    const trustDelta = result.metrics.trust.p50 - baseline.metrics.trust.p50;
    const loadDelta = result.metrics.teamLoad.p50 - baseline.metrics.teamLoad.p50;
    if (trustDelta > 0.04 && loadDelta < 0.03) return "The upside survives contact with the team.";
    if (trustDelta > 0.04) return "Trust rises. So does the human cost.";
    if (loadDelta > 0.05) return "The schedule improves before the system does.";
    if (result.metrics.runway.p50 < baseline.metrics.runway.p50 - 0.04)
      return "Growth arrives with a shorter clock.";
    return "Small decisions still cast long shadows.";
  }, [baseline, result]);

  return (
    <main>
      <a className="skip-link" href="#decision-controls">
        Skip to decision controls
      </a>
      <header>
        <div className="wordmark">
          <span aria-hidden="true">Ⅱ</span>
          <div>
            <strong>Second Order</strong>
            <small>Counterfactual strategy laboratory</small>
          </div>
        </div>
        <p>
          This is a model, not a forecast. <span>Assumptions stay visible.</span>
        </p>
        <div className="run-id">RUN / {seed}</div>
      </header>

      <section className="workspace">
        <aside id="decision-controls" className="decision-rail" aria-labelledby="decision-title">
          <div>
            <p className="rail-label">Intervention</p>
            <h1 id="decision-title">Pull one lever. Move five futures.</h1>
            <p className="rail-copy">
              Change the operating assumptions, then send 10,000 possible outcomes through the
              causal model.
            </p>
          </div>

          <div className="levers">
            <label>
              <span>
                Shipping pressure <output>{percent(levers.shippingPressure)}</output>
              </span>
              <input
                type="range"
                name="shipping-pressure"
                autoComplete="off"
                min="0"
                max="1"
                step="0.01"
                value={levers.shippingPressure}
                onChange={(event) =>
                  setLevers((current) => ({
                    ...current,
                    shippingPressure: Number(event.target.value),
                  }))
                }
              />
              <small>Low = deliberate · High = urgent</small>
            </label>
            <label>
              <span>
                Engineering depth <output>{percent(levers.engineeringDepth)}</output>
              </span>
              <input
                type="range"
                name="engineering-depth"
                autoComplete="off"
                min="0"
                max="1"
                step="0.01"
                value={levers.engineeringDepth}
                onChange={(event) =>
                  setLevers((current) => ({
                    ...current,
                    engineeringDepth: Number(event.target.value),
                  }))
                }
              />
              <small>Prototype patch → durable system</small>
            </label>
            <label>
              <span>
                Price position <output>{percent(levers.priceChange)}</output>
              </span>
              <input
                type="range"
                name="price-position"
                autoComplete="off"
                min="0"
                max="1"
                step="0.01"
                value={levers.priceChange}
                onChange={(event) =>
                  setLevers((current) => ({
                    ...current,
                    priceChange: Number(event.target.value),
                  }))
                }
              />
              <small>Accessible → premium</small>
            </label>
          </div>

          <div className="rail-actions">
            <button className="run-button" onClick={runSimulation} disabled={pending}>
              <span>{pending ? "Simulating…" : "Simulate 10,000 futures"}</span>
              <i aria-hidden="true">→</i>
            </button>
            <button className="reset-button" onClick={reset}>
              Reset assumptions
            </button>
          </div>
        </aside>

        <section className="causal-stage" aria-labelledby="map-title" aria-busy={pending}>
          <div className="stage-top">
            <div>
              <p className="rail-label">Causal map</p>
              <h2 id="map-title">{headline}</h2>
            </div>
            <div className="legend" aria-label="Chart legend">
              <span><i className="current-key" /> Current range</span>
              <span><i className="baseline-key" /> Baseline median</span>
            </div>
          </div>

          <div className={`causal-map ${pending ? "is-running" : ""}`}>
            <svg viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
              <path d={path(190, 155, 480, 92)} />
              <path d={path(190, 155, 480, 252)} />
              <path d={path(190, 390, 480, 252)} />
              <path d={path(190, 390, 480, 455)} />
              <path d={path(535, 92, 820, 170)} />
              <path d={path(535, 252, 820, 170)} />
              <path d={path(535, 252, 820, 390)} />
              <path d={path(535, 455, 820, 390)} />
            </svg>

            <div className="cause-node shipping">
              <span>Shipping pressure</span>
              <strong>{percent(levers.shippingPressure)}</strong>
            </div>
            <div className="cause-node depth">
              <span>Engineering depth</span>
              <strong>{percent(levers.engineeringDepth)}</strong>
            </div>
            <div className="metric-node reliability">
              <span>Reliability</span>
              <strong>{percent(result.metrics.reliability.p50)}</strong>
              <Range
                distribution={result.metrics.reliability}
                baseline={baseline.metrics.reliability}
              />
            </div>
            <div className="metric-node adoption">
              <span>Adoption</span>
              <strong>{percent(result.metrics.adoption.p50)}</strong>
              <Range distribution={result.metrics.adoption} baseline={baseline.metrics.adoption} />
            </div>
            <div className="metric-node team">
              <span>Team load</span>
              <strong>{percent(result.metrics.teamLoad.p50)}</strong>
              <Range distribution={result.metrics.teamLoad} baseline={baseline.metrics.teamLoad} />
            </div>
            <div className="metric-node trust">
              <span>Trust</span>
              <strong>{percent(result.metrics.trust.p50)}</strong>
              <Range distribution={result.metrics.trust} baseline={baseline.metrics.trust} />
            </div>
            <div className="metric-node runway">
              <span>Runway</span>
              <strong>{percent(result.metrics.runway.p50)}</strong>
              <Range distribution={result.metrics.runway} baseline={baseline.metrics.runway} />
            </div>
            <div className="price-orbit" style={{ "--price": levers.priceChange } as CSSProperties}>
              Price {percent(levers.priceChange)}
            </div>
          </div>

          <div className="forecast-strip" aria-label="Simulation outcome distributions">
            {METRICS.map((metric) => {
              const current = result.metrics[metric.id];
              const base = baseline.metrics[metric.id];
              return (
                <article key={metric.id}>
                  <div>
                    <h3>{metric.label}</h3>
                    <p>{metric.note}</p>
                  </div>
                  <Range distribution={current} baseline={base} />
                  <strong>{percent(current.p50)}</strong>
                  <small>{deltaLabel(current, base, metric.inverse)}</small>
                </article>
              );
            })}
          </div>

          <footer>
            <p>
              10,000 Monte Carlo trials · seeded Gaussian uncertainty · percentile range P10–P90
            </p>
            <button
              onClick={() => {
                const nextSeed = seed + 1;
                setSeed(nextSeed);
              }}
            >
              Change uncertainty seed
            </button>
          </footer>

          <div className="status-announcement" aria-live="polite">
            {pending
              ? "Running ten thousand simulated futures"
              : `Simulation complete. Median trust is ${percent(result.metrics.trust.p50)}.`}
          </div>
        </section>
      </section>
    </main>
  );
}
