# FireTrace + Ask FireTrace

Ask FireTrace is integrated into the existing static dashboard, with a small TypeScript/Express backend. The supplied `preview.html` is also preserved as `dist/original.html`, including its CFI-G lab and original `computeRanking()` function; the same assistant dock is added. No React migration or replacement application was introduced. Prior prediction features remain separate: the assistant does **not** train models or use predictions as NASA observations.

## Run

Requires Node 22.13 or newer (tested with 22.23.2). From this directory:

```sh
npm install
npm run build
npm run dev
```

Open http://127.0.0.1:3000. One server serves both existing frontend and API. Production: `npm run build` then `npm start`. The supplied prepared data is sufficient; raw workbooks are not needed to run the app. `npm test` runs mocked scientific/reliability evaluations with no paid calls.

The hosted static version, if published, provides the **browser-local analysis engine only**. It does not host this Node server or a paid model. It clearly labels local responses. Use the Node deployment below to enable Muse Spark. No API key is embedded in any public file.

## Available data (verified canonical representations)

| Investigation | Included records | Meaning |
|---|---:|---|
| FLEX / PSI-69 | 274 | Identified experimental test rows, including QC-flagged cases |
| BASS-II / PSI-25 | 129 | Identified test rows, original material descriptions retained |
| SAME-R / PSI-101 | 109 | Identified rows from **SAME R Results** only |
| SAFFIRE / PSI-98, sample-1 | 20,000 | Calibrated Data keyed time samples |
| SAFFIRE / PSI-98, sample-2 | 20,000 | Calibrated Data keyed time samples |
| SAFFIRE sample-1 camera | 18,124 | Source rows containing camera metadata, not flame measurements |
| SAFFIRE sample-2 camera | 18,150 | Source rows containing camera metadata, not flame measurements |
| SAFFIRE telemetry CygnusData | 2,540 | Keyed telemetry rows |
| SAFFIRE telemetry SaffireData | 105 | Keyed telemetry rows |

All four areas have local data. Stream samples are **not independent burns** and are never pooled. Additional workbook sheets, sparse unkeyed plot columns, paper tables and duplicated reductions are inventoried but not pooled into canonical experiments. All six SAFFIRE streams retain source row numbers and full cached raw cells in compressed JSONL. Keys mean a numeric first timestamp/index column; blank/unkeyed spreadsheet padding is not counted as an experiment.

FLEX: initial fuel, pressure (mmHg), gas mole fractions and droplet diameter; recorded extinction droplet diameter, burning constant (mm²/s), burn time and test end. The source burning-rate header incorrectly says mm; the documented unit correction follows NASA/TP–2015-216046 Table IX without numerical rescaling. Approximate times are flagged. Zero pressure is preserved with a QC flag.

BASS-II: material/sample/test IDs, flow restrictor and fan/air **display settings**, calibrated initial/final oxygen (% by volume), CO₂ (% by volume) and CO (ppm). Display settings are not calibrated velocity. There is no spread-rate or test-end-outcome column in this table.

SAME-R: sample/material/test IDs, inlet velocity, smoke-generation duration, detector obscuration/scatter voltage, P-Trak concentration (PT/cc), DustTrak concentration (mg/m3), processed particle-size metrics (micro-m), derived sample temperature, and mass loss. Missing values and Excel errors remain null and flagged. Cached derived values are not relabelled as direct measurements. Other workbook sheets contain SAME, ground data and overlapping reductions: they are not additional SAME-R trials.

SAFFIRE: recorded O₂/CO₂ (%), calibrated anemometer channels (cm/sec), ambient pressure (PSIA), radiometers (source mW/cm² notation), temperature channels (Degrees C), fan/igniter/control channels and telemetry including detector voltages. Unspecified units stay unspecified. Camera exposure/gain metadata is not a flame boundary measurement. Mission identity follows supplied filenames and the official PSI-98 description; the exact sample-to-material/independent-burn mapping is **not** established from these workbooks. Full-stream summaries include pre/post-event periods; no automatic ignition window or flame-spread calculation is claimed.

`data/prepared/manifest.json` lists files, SHA-256 hashes, source URLs, canonical counts, sheet inventories and limitations. `variable_dictionary.json` records original labels, units, roles and column positions, including sensor streams. `records_with_raw.json` and the `*.jsonl.gz` files map every processed record back to its file, sheet and row. No original file is modified.

## Prepare data again

Python 3.12 with the pinned requirements in `requirements-data.txt`:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-data.txt
NASA_DATA_DIR=/path/to/NASA NASA_DOWNLOADS_DIR=/path/to/downloads .venv/bin/python scripts/ingest.py
npm run build
```

Defaults search the two user-provided NASA/Downloads folders. Each investigation has a separate adapter in `scripts/ingest.py`. The ingestion pass validates actual encountered columns/positions, preserves source strings, flags malformed numbers and excludes missing identifiers rather than treating formatting as experiments. New schemas must be explicitly mapped and tested; do not drop unrelated files into a generic merged table. The PDF/PPTX index is prepared once by `scripts/prepare_documents.py` and currently contains 147 source pages/slides/audit sections. Lightweight keyword retrieval runs locally. Source text is never executable instruction.

Independent source reconciliation, when raw files are available:

```sh
.venv/bin/python scripts/test_data_integrity.py
```

## Evidence and conversation architecture

`src/engine.ts` provides typed read-only functions for exact-condition filtering, record lookup, counts, numeric summaries, paired Pearson correlations, nearest-condition matching, matched cross-fuel candidates and local text retrieval. Nulls are excluded only from the numerical denominator and missing counts are shown. Negative/outlying observations are retained; source warnings accompany summaries.

Nearest FLEX candidates restrict fuel, then scale pressure, oxygen, CO₂, helium and initial diameter by their observed ranges. A condition distance is similarity, not physical equivalence. Cross-fuel candidate pairs match pressure and gas fractions exactly and diameter within 0.1 mm. Pairs may reuse trials. Correlations and grouped outcome proportions are descriptive, not causal.

The browser sends only the current question, validated selected dataset/experiment/filter context and session ID. The server stores a small structured context for up to one hour; it does not resend an unlimited conversation. Follow-ups retain variable and filters; experiment changes retain the previous ID for comparisons. The UI retains at most 20 displayed exchanges. The original dashboard's ranking hook calls its existing function and labels the scores as heuristic relevance on embedded subsets, not fire risk or scientific validation.

The evidence package contains facts with IDs, calculation results/sample sizes, source provenance, conditions, and limitations. Sources are server-created; no model-generated URL is rendered. Model responses can select/reorder verified statements and use one of three neutral opening sentences. Numerical claims must exactly match the corresponding fact's calculation values. Suggested questions and limitations must be supplied strings. This deliberately restrictive contract prevents arbitrary model prose from introducing unsupported scientific claims. **It is evidence selection, not unconstrained AI explanation.** It trades linguistic flexibility for reliability and low cost. Natural-language interpretation is a bounded local parser; unfamiliar phrasing may need a simpler question or explicit variable/dataset. No arbitrary model-generated SQL, JavaScript, Python, shell or tool call is executed.

Responses visibly distinguish NASA recorded values, FireTrace calculations, supported interpretation and insufficient evidence. Context excerpts remain separate from experiment tables. All answer text is inserted with `textContent`; model/document HTML cannot execute. Sources are allowlisted NASA URLs or bundled reference paths. The assistant never explains illustrative flame colours as measured temperature.

## Muse Spark setup and official contract

Create `.env` from `.env.example`; enter the key **only** in `MODEL_API_KEY`. Do not put it in a VITE variable or browser code. No key was supplied or used during development.

Verified official documentation on 2026-11-15:

- https://dev.meta.ai/docs/muse-spark
- https://dev.meta.ai/docs/api-reference/chat-completions/schemas
- https://dev.meta.ai/docs/structured-output
- https://dev.meta.ai/docs/tool-calling
- https://dev.meta.ai/docs/pricing-rate-limits

Backend endpoint: `POST https://api.meta.ai/v1/chat/completions`, Bearer authentication, `model: muse-spark-1.3` (Standard), `reasoning_effort: minimal`, `max_completion_tokens` (visible plus reasoning), and strict JSON-schema `response_format`. Official tool calling exists, but this application does not need an autonomous tool loop: calculations are deterministic and predefined. Contributor mode is never selected. Provider SDKs, paid embeddings and vector databases are unnecessary.

After configuring a durable accounting volume, recheck current official pricing, set `PRICING_VERIFIED_DATE=YYYY-MM-DD`, `PERSISTENT_STORAGE_CONFIRMED=true`, and `ENABLE_PAID_MODEL=true`. Current verified Standard rates: $1.25/M input and $4.25/M output tokens; cache discounts are ignored for conservative accounting. Pricing confirmation expires after 30 days. The key alone does not activate paid calls.

## Spending and reliability

- Default **$10 development** allowance inside **$30 cumulative** chatbot ceiling, preserving the rest of the user's $100 project credit.
- `BUDGET_PHASE=development` is the default. `production` removes the development sub-limit but retains the same lifetime ledger/total ceiling.
- SQLite `BEGIN IMMEDIATE` reserves worst-case estimated cost **before** a call. Restarting does not reset charges or pending reservations. Concurrent processes sharing this database respect the same limits.
- Input estimate uses twice the UTF-8 request byte length plus a framing/schema allowance; requests beyond 24,000 estimated input tokens use local fallback. Default output limit is 900 including reasoning. Instructions cap 2,400 characters; evidence/context cap 16,000. Oversize packages fall back locally rather than silently dropping warnings/provenance.
- Maximum **one paid request per question**, 20-second timeout, no automatic paid retry/correction. Failure or missing usage leaves the full reservation charged conservatively. Usage overruns permanently block subsequent paid calls until reviewed.
- Persistent per-session limit 100 requests, per-IP limit 12/minute. Browser-local offline queries never incur API cost.
- Validated response cache lasts 24 hours and keys the question, context, evidence/data version and model contract. API key material is not cached or logged.
- `npm run budget` displays remaining total/development allowances. `/api/budget` requires a developer-only bearer token; never place it in frontend configuration.
- If SQLite is unavailable, pricing is stale, the key is missing, credit is exhausted or output validation fails, the local engine still works. Static hosting also uses the browser-local engine.

The ledger governs **this application's requests**, not spending by unrelated projects or API clients. Use provider-side account limits too. Do not delete/reset the ledger when deploying. Mount one durable local volume and run one Node service; do not use multiple independent ledgers or ephemeral serverless disks. Unconfirmed durable accounting disables paid calls.

## Deployment

For inexpensive server deployment, use an existing Node host or small server with persistent storage: install/build, copy prepared data and `dist`, mount the accounting directory, set environment variables, and run `npm start`. Bind `HOST=0.0.0.0` only behind your HTTPS/authenticated reverse proxy. Keep the same-origin frontend/API. Configure authentication before exposing a paid demo to untrusted traffic; the app has budget/rate controls, not a full user-account system. SQLite is local; no managed database is required.

For the private Sites static deployment, `dist` contains the browser-local assistant and prepared compact catalog. Paid Muse is intentionally unavailable there because the Node backend and durable ledger are not hosted in that environment. The full backend remains runnable locally. No live Meta call was tested; API compatibility is documentation-verified and automated tests use mocks.

## Verification

`npm test`: scientific calculations, source provenance/units/null checks, 28 realistic scientific/hallucination evaluation questions, conversation state, model-response grounding, API failures, persistent budgets, cache and rate limits. `scripts/test_data_integrity.py`: independent row/value reconciliation against all supplied canonical source sheets. `npm run build`: strict TypeScript compilation, browser-engine bundling, and JavaScript syntax checks.

Browser checks cover opening/closing the drawer, selected FLEX context, nearest-case follow-ups, SAME-R summaries, SAFFIRE summaries, dataset switching, original ranking invocation, responsive 390px layout and Escape behaviour. See `VERIFICATION.md` for final results and limits.

## Files added or changed for Ask FireTrace

- `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `.env.example`
- `src/shared.ts`, `src/engine.ts`, `src/budget.ts`, `src/meta.ts`, `src/server.ts`
- `scripts/ingest.py`, `scripts/prepare_documents.py`, `scripts/test_data_integrity.py`, `scripts/build.mjs`, `scripts/budget-status.ts`
- `tests/evidence.test.ts`, `tests/reliability.test.ts`
- `dist/assets/ask-firetrace.mjs`, `dist/assets/ask-firetrace.css`
- `dist/index.html` (assistant integration), `dist/original.html` (original preview preserved with assistant bridge)
- `dist/assistant/engine.js`, `dist/assistant/catalog.json` (generated browser runtime/data)
- `data/prepared/catalog.json`, `manifest.json`, `variable_dictionary.json`, `records_with_raw.json`, `sample-1.jsonl.gz`, `sample-2.jsonl.gz`, `sample-1-camera.jsonl.gz`, `sample-2-camera.jsonl.gz`, `telemetry-cygnus.jsonl.gz`, `telemetry-saffire.jsonl.gz`
- `build/*.js` (generated server modules), `README.md`, `VERIFICATION.md`, `requirements-data.txt`

The original files in Downloads and the NASA folder are unchanged. Existing model/3D dashboard files are retained; their limitations remain visible. The 3D scene is an illustrative reconstruction, not validated CFD, thermometry or a measured flame envelope.
