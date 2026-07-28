import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BASELINE,
  simulate,
  type Distribution,
  type Levers,
  type MetricId,
  type SimulationResult,
} from "./model";
import {
  SCENARIOS,
  explainMetric,
  matchingScenario,
  scenarioSearch,
  scenarioStateFromSearch,
  type Scenario,
} from "./scenarios";
import type { SimulationRequest } from "./simulation.worker";

const METRICS: Array<{ id: MetricId; label: string; note: string; inverse?: boolean }> = [
  { id: "adoption", label: "Adoption", note: "Likelihood of repeat use" },
  { id: "reliability", label: "Reliability", note: "Healthy sessions" },
  { id: "trust", label: "Trust", note: "Users willing to recommend" },
  { id: "runway", label: "Runway", note: "Financial resilience" },
  { id: "teamLoad", label: "Team load", note: "Sustained delivery strain", inverse: true },
];

const NETWORK_PATHS: Array<{
  coordinates: [number, number, number, number];
  outcomes: MetricId[];
}> = [
  { coordinates: [190, 155, 480, 92], outcomes: ["reliability", "trust"] },
  { coordinates: [190, 155, 480, 252], outcomes: ["adoption", "trust", "runway"] },
  { coordinates: [190, 390, 480, 252], outcomes: ["adoption", "trust", "runway"] },
  { coordinates: [190, 390, 480, 455], outcomes: ["teamLoad", "runway"] },
  { coordinates: [535, 92, 820, 170], outcomes: ["trust"] },
  { coordinates: [535, 252, 820, 170], outcomes: ["trust"] },
  { coordinates: [535, 252, 820, 390], outcomes: ["runway"] },
  { coordinates: [535, 455, 820, 390], outcomes: ["runway"] },
];

const INITIAL_STATE = scenarioStateFromSearch(window.location.search);

const percent = (value: number) => `${Math.round(value * 100)}%`;

const sameLevers = (first: Levers, second: Levers) =>
  Math.abs(first.shippingPressure - second.shippingPressure) < 0.005 &&
  Math.abs(first.engineeringDepth - second.engineeringDepth) < 0.005 &&
  Math.abs(first.priceChange - second.priceChange) < 0.005;

const deltaLabel = (current: Distribution, baseline: Distribution, inverse = false) => {
  const raw = (current.p50 - baseline.p50) * (inverse ? -1 : 1);
  const points = Math.round(raw * 100);
  if (points === 0) return "no material change";
  const unit = Math.abs(points) === 1 ? "pt" : "pts";
  return `${points > 0 ? "+" : "−"}${Math.abs(points)} ${unit} ${points > 0 ? "better" : "worse"}`;
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
  const [levers, setLevers] = useState<Levers>(INITIAL_STATE.levers);
  const [baseline] = useState<SimulationResult>(() => simulate(BASELINE, 10_000, 2607));
  const [result, setResult] = useState<SimulationResult>(() =>
    sameLevers(INITIAL_STATE.levers, BASELINE) && INITIAL_STATE.seed === 2607
      ? baseline
      : simulate(INITIAL_STATE.levers, 10_000, INITIAL_STATE.seed),
  );
  const [simulatedLevers, setSimulatedLevers] = useState<Levers>(INITIAL_STATE.levers);
  const [pending, setPending] = useState(false);
  const [seed, setSeed] = useState(INITIAL_STATE.seed);
  const [selectedMetric, setSelectedMetric] = useState<MetricId>(INITIAL_STATE.focus);
  const [shareLabel, setShareLabel] = useState("Copy scenario link");
  const workerRef = useRef<Worker | null>(null);
  const requestRef = useRef(0);
  const pendingRequestRef = useRef<SimulationRequest | null>(null);

  useEffect(() => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./simulation.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (event: MessageEvent<{ id: number; result: SimulationResult }>) => {
        if (event.data.id !== requestRef.current) return;
        const completed = pendingRequestRef.current;
        setResult(event.data.result);
        if (completed) setSimulatedLevers(completed.levers);
        pendingRequestRef.current = null;
        setPending(false);
      };
      worker.onerror = () => {
        const failed = pendingRequestRef.current;
        if (!failed || failed.id !== requestRef.current) return;
        setResult(simulate(failed.levers, 10_000, failed.seed));
        setSimulatedLevers(failed.levers);
        pendingRequestRef.current = null;
        setPending(false);
        workerRef.current = null;
        worker?.terminate();
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }
    return () => worker?.terminate();
  }, []);

  const runSimulation = (nextLevers = levers, nextSeed = seed) => {
    const id = requestRef.current + 1;
    requestRef.current = id;
    const request: SimulationRequest = { id, levers: nextLevers, seed: nextSeed };
    pendingRequestRef.current = request;
    setPending(true);

    const url = new URL(window.location.href);
    url.search = scenarioSearch(nextLevers, nextSeed, selectedMetric);
    window.history.replaceState({}, "", url);

    if (workerRef.current) {
      workerRef.current.postMessage(request);
      return;
    }

    window.setTimeout(() => {
      if (request.id !== requestRef.current) return;
      setResult(simulate(request.levers, 10_000, request.seed));
      setSimulatedLevers(request.levers);
      pendingRequestRef.current = null;
      setPending(false);
    }, 0);
  };

  const chooseScenario = (scenario: Scenario) => {
    const nextLevers = { ...scenario.levers };
    setLevers(nextLevers);
    setShareLabel("Copy scenario link");
    runSimulation(nextLevers, seed);
  };

  const updateLever = (key: keyof Levers, value: number) => {
    setLevers((current) => ({ ...current, [key]: value }));
    setShareLabel("Copy scenario link");
  };

  const selectMetric = (metric: MetricId) => {
    setSelectedMetric(metric);
    const url = new URL(window.location.href);
    url.search = scenarioSearch(levers, seed, metric);
    window.history.replaceState({}, "", url);
  };

  const reset = () => {
    requestRef.current += 1;
    pendingRequestRef.current = null;
    setPending(false);
    setLevers(BASELINE);
    setSimulatedLevers(BASELINE);
    setResult(baseline);
    setSeed(2607);
    setSelectedMetric("trust");
    setShareLabel("Copy scenario link");
    window.history.replaceState({}, "", window.location.pathname);
  };

  const copyScenario = async () => {
    const url = new URL(window.location.href);
    url.search = scenarioSearch(levers, seed, selectedMetric);
    window.history.replaceState({}, "", url);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url.toString());
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url.toString();
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.append(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy unavailable");
      }
      setShareLabel("Scenario link copied");
    } catch {
      setShareLabel("Copy blocked — use the address bar");
    }
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

  const activeScenario = useMemo(() => matchingScenario(levers), [levers]);
  const explanation = useMemo(() => explainMetric(selectedMetric, levers), [levers, selectedMetric]);
  const selectedDefinition = METRICS.find((metric) => metric.id === selectedMetric) ?? METRICS[0];
  const isDirty = !sameLevers(levers, simulatedLevers);

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

          <fieldset className="scenario-presets">
            <legend>Starting position</legend>
            <div>
              {SCENARIOS.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  aria-pressed={activeScenario?.id === scenario.id}
                  className={activeScenario?.id === scenario.id ? "active" : ""}
                  title={scenario.thesis}
                  onClick={() => chooseScenario(scenario)}
                >
                  {scenario.name}
                </button>
              ))}
            </div>
            <p>{activeScenario?.thesis ?? "Custom intervention. Run it to update the model."}</p>
          </fieldset>

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
                onChange={(event) => updateLever("shippingPressure", Number(event.target.value))}
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
                onChange={(event) => updateLever("engineeringDepth", Number(event.target.value))}
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
                onChange={(event) => updateLever("priceChange", Number(event.target.value))}
              />
              <small>Accessible → premium</small>
            </label>
          </div>

          <div className="rail-actions">
            <button className="run-button" onClick={() => runSimulation()} disabled={pending}>
              <span>
                {pending
                  ? "Simulating…"
                  : isDirty
                    ? "Run changed scenario"
                    : "Simulate 10,000 futures"}
              </span>
              <i aria-hidden="true">→</i>
            </button>
            <button className="share-button" onClick={() => void copyScenario()}>
              {shareLabel}
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
              <span>
                <i className="current-key" /> Current range
              </span>
              <span>
                <i className="baseline-key" /> Baseline median
              </span>
            </div>
          </div>

          <div className={`causal-map ${pending ? "is-running" : ""}`}>
            <svg viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
              {NETWORK_PATHS.map(({ coordinates, outcomes }, index) => (
                <path
                  key={index}
                  className={outcomes.includes(selectedMetric) ? "is-relevant" : ""}
                  d={path(...coordinates)}
                />
              ))}
            </svg>

            <div className="cause-node shipping">
              <span>Shipping pressure</span>
              <strong>{percent(levers.shippingPressure)}</strong>
            </div>
            <div className="cause-node depth">
              <span>Engineering depth</span>
              <strong>{percent(levers.engineeringDepth)}</strong>
            </div>
            <button
              type="button"
              className={`metric-node reliability ${selectedMetric === "reliability" ? "selected" : ""}`}
              aria-pressed={selectedMetric === "reliability"}
              onClick={() => selectMetric("reliability")}
            >
              <span>Reliability</span>
              <strong>{percent(result.metrics.reliability.p50)}</strong>
              <Range
                distribution={result.metrics.reliability}
                baseline={baseline.metrics.reliability}
              />
            </button>
            <button
              type="button"
              className={`metric-node adoption ${selectedMetric === "adoption" ? "selected" : ""}`}
              aria-pressed={selectedMetric === "adoption"}
              onClick={() => selectMetric("adoption")}
            >
              <span>Adoption</span>
              <strong>{percent(result.metrics.adoption.p50)}</strong>
              <Range distribution={result.metrics.adoption} baseline={baseline.metrics.adoption} />
            </button>
            <button
              type="button"
              className={`metric-node team ${selectedMetric === "teamLoad" ? "selected" : ""}`}
              aria-pressed={selectedMetric === "teamLoad"}
              onClick={() => selectMetric("teamLoad")}
            >
              <span>Team load</span>
              <strong>{percent(result.metrics.teamLoad.p50)}</strong>
              <Range distribution={result.metrics.teamLoad} baseline={baseline.metrics.teamLoad} />
            </button>
            <button
              type="button"
              className={`metric-node trust ${selectedMetric === "trust" ? "selected" : ""}`}
              aria-pressed={selectedMetric === "trust"}
              onClick={() => selectMetric("trust")}
            >
              <span>Trust</span>
              <strong>{percent(result.metrics.trust.p50)}</strong>
              <Range distribution={result.metrics.trust} baseline={baseline.metrics.trust} />
            </button>
            <button
              type="button"
              className={`metric-node runway ${selectedMetric === "runway" ? "selected" : ""}`}
              aria-pressed={selectedMetric === "runway"}
              onClick={() => selectMetric("runway")}
            >
              <span>Runway</span>
              <strong>{percent(result.metrics.runway.p50)}</strong>
              <Range distribution={result.metrics.runway} baseline={baseline.metrics.runway} />
            </button>
            <div className="price-orbit" style={{ "--price": levers.priceChange } as CSSProperties}>
              Price {percent(levers.priceChange)}
            </div>
          </div>

          <section className="explanation-strip" aria-live="polite">
            <div>
              <span>{selectedDefinition.label}</span>
              <strong>{explanation.title}</strong>
              <p>{explanation.summary}</p>
            </div>
            <ol>
              {explanation.drivers.map((driver) => (
                <li key={driver}>{driver}</li>
              ))}
            </ol>
          </section>

          <div className="forecast-strip" aria-label="Simulation outcome distributions">
            {METRICS.map((metric) => {
              const current = result.metrics[metric.id];
              const base = baseline.metrics[metric.id];
              return (
                <article className={selectedMetric === metric.id ? "selected" : ""} key={metric.id}>
                  <button
                    type="button"
                    className="forecast-select"
                    aria-pressed={selectedMetric === metric.id}
                    onClick={() => selectMetric(metric.id)}
                  >
                    <h3>{metric.label}</h3>
                    <p>{metric.note}</p>
                  </button>
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
                runSimulation(levers, nextSeed);
              }}
            >
              Change uncertainty seed and rerun
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
