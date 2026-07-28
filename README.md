# Second Order

A counterfactual decision laboratory that treats strategy as a probability distribution, not a confident number.

Choose a strategic position or change shipping pressure, engineering depth, and price. Second Order sends the intervention through a causal model in a Web Worker, runs 10,000 Monte Carlo trials, and compares the P10–P90 outcome range against the baseline for adoption, reliability, trust, runway, and team load.

![Second Order counterfactual strategy laboratory](./output/playwright/second-order-desktop.png)

## Why this exists

Strategy tools often hide assumptions and collapse uncertainty into a score. Second Order keeps the causal chain visible and shows how a decision can improve one outcome while making another materially worse.

## Technical highlights

- Seeded Monte Carlo simulation with Gaussian uncertainty
- Explicit causal relationships between operating levers and outcomes
- Four instant strategic presets plus custom interventions
- 10,000-trial computation isolated in a Web Worker
- Main-thread fallback if Web Workers are unavailable
- Baseline-versus-intervention percentile visualization
- Selectable outcomes with highlighted causal paths and plain-language driver explanations
- URL-encoded, copyable scenario state—including the selected causal lens—for reproducible discussions
- Deterministic runs for reproducible discussion and tests
- Accessible native controls and live simulation status
- Responsive causal map with a non-animated reduced-motion mode

## Run it

```bash
npm install
npm run dev
```

## Verify it

```bash
npm test
npm run build
```

Production Lighthouse: **97 performance · 100 accessibility · 100 best practices · 100 SEO**.

## Security

Second Order is a static, client-only model: it has no accounts, backend, analytics, remote scripts, or network API. Shareable URL state is parsed through bounded numeric and enum allowlists before simulation. Production builds enforce a restrictive Content Security Policy, disable public source maps, and run tests, dependency auditing, and CodeQL in CI. See [SECURITY.md](./SECURITY.md) for reporting.

## Architecture

`src/model.ts` is a pure simulation package. `src/scenarios.ts` owns presets, URL state, and rule-based explanations. `src/simulation.worker.ts` runs the full model off the main thread. `src/App.tsx` coordinates requests by ID so stale worker results cannot overwrite a newer decision.

## Modelling note

The relationships are illustrative, not predictive. That limitation is part of the interface: it says “model, not forecast,” exposes the seed and percentile range, and avoids presenting one false-precision score.

## Portfolio talking point

The main product judgment was preserving trade-offs while making them legible. A decision can raise trust and team load simultaneously; the interface lets a reviewer trace that tension through the model instead of turning it into a simplistic green score.

## Authorship

Original concept, design, and engineering by **Kuba Opoczka (KubaOpoczka)**. © 2026. The MIT license requires this copyright notice to remain with substantial copies.
