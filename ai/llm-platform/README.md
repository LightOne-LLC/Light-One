# Light One — Local LLM Platform (Phase 1 + Phase 2 validation harness)

> **Remote environment limitation:** applies only to sandboxes with an
> egress allowlist blocking `ollama.com`/`huggingface.co` — not universal.
> **Real-model benchmark:** Executed for real on a Light One dev machine with
> Ollama installed — see "Verified real-model run" below for the actual output.
>
> Some remote development sandboxes block outbound access to both
> `ollama.com` and `huggingface.co` (organization egress policy — confirmed
> via explicit 403 policy denials in that setting, not a bug to work
> around). In that case, nothing in this codebase can download Ollama or a
> model, and `models/ses/benchmark/` still builds and tests end-to-end
> against `MockLocalModel` instead, unmodified, ready to run for real the
> moment it reaches a machine where `ollama serve` is reachable.
>
> On a machine where Ollama **is** installed and reachable (confirmed on a
> Light One dev machine, 2026-09-13), the pipeline runs against a real
> local model with no code changes — see "Verified real-model run" below.
> The Model Registry's default `ses-classifier` model (`llama3.1:8b`,
> `llm/src/registry/models.json`) may be larger than what a given machine
> has pulled; override it per-run with `SES_CLASSIFIER_MODEL` (see
> "Swapping the SES model" below) without editing the registry.

Foundation for running **multiple task-specific Local/API models** behind
one Router, instead of one general-purpose LLM for everything. This is a
new, self-contained package inside the repo — it does not touch
`app/`, `frontend/`, `functions/`, `supabase/`, or `insurance-risk-diagnosis/`.

```
User / Automation Engine
        │
     LLM Task            { task_type, domain, input, requirements }
        │
    LLM Router            rule-based: deterministic → local → cheap API → premium API,
        │                 with privacy_level as a hard constraint
        ▼
 ┌──────┴───────┬─────────────┬─────────────┬─────────────┐
 Deterministic   Local Model   Claude        GPT           Gemini
 (empty input,   (Ollama)      Provider      Provider      Provider
  pure Python-   e.g.
  style checks)  ses-classifier
        │
 Structured Output (JSON: category / confidence / reason)
        │
   Validator (domain-specific: is this a category the domain knows about?)
        │
   Evaluator (domain-agnostic: never trust confidence as a probability)
        │
      Result   { output, verified, needsHumanReview, notes, trace }
```

## Repository layout

```
light-one-platform/
├── docs/
│   ├── architecture/runtime-comparison.md    Ollama vs llama.cpp vs vLLM vs Transformers
│   ├── architecture/runtime-dependencies.md  Ollama/GPU/env-var/model-download dependency boundary
│   └── ai/ses-classifier.md                  SES model's Phase 1-4 plan
├── llm/src/
│   ├── schemas/        TaskMetadata, LLMTask (wire format + internal), result types
│   ├── interfaces/      LLMProvider, LocalModel, typed error hierarchy
│   ├── providers/
│   │   ├── local/       OllamaProvider (real adapter), MockLocalModel (test double)
│   │   ├── claude/, openai/, gemini/   thin fetch-based API providers, same interface
│   │   └── shared/       JSON structured-output parsing shared by every provider
│   ├── registry/        models.json (data) + ModelRegistry (loader/query)
│   ├── deterministic/    rules that must never go through an LLM
│   ├── router/           LLMRouter (rule-based routing + classify pipeline)
│   └── evaluator/        confidence clamping / human-review flagging
├── models/ses/
│   ├── sesEmail.ts, sesSystemPrompt.ts, sesClassifier.ts   first domain model
│   └── benchmark/
│       ├── dataset.ts        56 synthetic emails, >=14 per category, hard cases included
│       ├── metrics.ts        accuracy/precision/recall/F1/confusion/latency percentiles (pure, unit-tested)
│       └── runBenchmark.ts   `npm run benchmark:ses` entry point (real Ollama or graceful SKIPPED)
├── scripts/check-local-ai.sh   CPU/RAM/GPU/VRAM/CUDA/disk/ollama hardware report
├── Dockerfile, docker-compose.yml, .env.example   future Light One Linux server (llm-platform + ollama + postgres)
└── tests/                router / local-model / SES / benchmark / integration test suites
```

## Running it

```bash
cd light-one-platform
npm install
npm run typecheck
npm test
```

Everything above runs with **no external services** — tests use
`MockLocalModel`, a deterministic in-memory stand-in for `LocalModel`.

To actually run the SES classifier against a real local model:

```bash
# once, on a machine with Ollama installed (https://ollama.com):
ollama pull llama3.1:8b
ollama serve   # if not already running as a service
```

```ts
import { ModelRegistry, LLMRouter, OllamaProvider } from './llm/src/index.js';
import { classifySesEmail } from './models/ses/sesClassifier.js';

const registry = ModelRegistry.loadDefault();
const router = new LLMRouter(registry, (descriptor) => {
  if (descriptor.runtime.kind === 'ollama') {
    return new OllamaProvider({ modelId: descriptor.runtime.model, name: descriptor.id });
  }
  throw new Error(`no provider wired up for runtime kind "${descriptor.runtime.kind}" yet`);
});

const result = await classifySesEmail(router, {
  subject: '【急募】AWSインフラエンジニア案件のご紹介',
  body: '単価80万円、東京(リモート可)、AWS/Terraform/Kubernetes必須、週5日稼働',
  sender: 'project-info@ses-agency.example.com',
});
console.log(result);
// { output: { category: 'project', confidence: 0.9, reason: '...' },
//   verified: true, needsHumanReview: false, notes: [], trace: {...} }
```

A same-process (Node/TypeScript) caller uses the wire-format `LLMTaskRequest`
(spec section 8) directly via `parseLLMTaskRequest` + `router.executeClassify`,
as above. A caller in another process or language (the Automation Engine is
Python) uses the `execute-task` CLI instead — see below.

## Calling the Router from outside this package (`execute-task`)

The Automation Engine (`ai/automation-engine`, Python) cannot `import` this
TypeScript package, and until now nothing exposed the wire-format
`LLMTaskRequest` outside a Node process — confirmed by reading
`ai/automation-engine/app/llm_planner.py`, which explicitly reimplements its
own separate, minimal Ollama-calling code in Python rather than reach into
`ai/llm-platform`, because "no Python bridge \[exists] today". `execute-task`
is that bridge: the smallest possible one — one process per call, JSON in on
stdin, JSON out on stdout, no server, no port, no new abstraction:

```bash
echo '{"task_type": "classify", "domain": "ses", "input": "件名: ...", "system_prompt": "..."}' \
  | npx tsx llm/src/cli.ts
# {"output": {"category": "project", "confidence": 0.9, "reason": "..."}, "verified": true, ...}
```

**For a programmatic caller (Python `subprocess`, etc.), invoke `npx tsx
llm/src/cli.ts` directly, not `npm run execute-task`.** `npm run` prints its
own banner (`> light-one-llm-platform@0.1.0 execute-task` etc.) to **stdout**
ahead of the CLI's own output, which breaks naive `json.loads(stdout)` —
confirmed by capturing raw stdout byte-for-byte in this exact setup.
`npx tsx llm/src/cli.ts` (or `npm run execute-task --silent`) gives clean,
JSON-only stdout; `npm run execute-task` (no `--silent`) is fine for manual,
human-read use. Verified for real: a standalone Python script called
`subprocess.run(["npx", "tsx", "llm/src/cli.ts"], input=..., capture_output=True)`
from outside this package (standing in for the Automation Engine, which
cannot `import` this TypeScript package either way) and successfully
`json.loads()`-parsed the response — see "Verified real-model run" below.
`execFileSync`/`execFile` in this package's own tests
(`tests/executeTaskCli.test.ts`) sidesteps this the same way, by calling
`tsx` directly rather than going through `npm run`.
The request body is the same `LLMTaskRequest` used internally, plus two
fields read directly off the body rather than added to that type: an
optional `system_prompt` (forwarded to the Router, same as every domain
model already passes one) and an optional `timeout_ms` (forwarded as the
per-request `timeoutMs` every `LLMProvider.classify` call already accepts —
this is what raising the benchmark's timeout below is built on top of, now
available to any caller, not just the benchmark script).

Only `task_type: "classify"` works — `LLMRouter.executeClassify` is the only
task type with a full Router pipeline today, so anything else returns a
clear `UNSUPPORTED_TASK_TYPE` JSON error rather than silently doing nothing.
Errors are always JSON on stdout with a non-zero exit code:
`{"error": {"code": "...", "message": "..."}}`, using the same error `code`s
(`MODEL_UNAVAILABLE`, `TIMEOUT`, `MALFORMED_OUTPUT`, `INVALID_INPUT`) every
`LLMProviderError` subclass already defines.

## Benchmarking the SES classifier for real

```bash
ollama pull llama3.1:8b   # or whatever model you point the registry at
ollama serve
npm run benchmark:ses
```

Runs the real pipeline (Router → `ses-classifier` → Ollama → Structured
Output → Validator → Evaluator) against the 56-example synthetic dataset
in `models/ses/benchmark/dataset.ts` and prints accuracy / precision /
recall / F1 / confusion matrix / invalid-JSON rate / latency (avg, p50,
p95) / per-category accuracy / failure cases / a suggested conclusion. If
nothing is listening on the configured Ollama endpoint, it prints
`SKIPPED: local model unavailable` and exits 0 — that's a correct,
successful outcome in an environment with no Ollama, not a failure.

**Swapping the SES model** — no code change needed either way:

```bash
# one-off, without touching the registry:
SES_CLASSIFIER_MODEL=qwen2.5:7b npm run benchmark:ses

# persistent: edit the one line in llm/src/registry/models.json
#   "runtime": { "kind": "ollama", "model": "qwen2.5:7b" }
```

**Raising the per-request timeout** on slower/CPU-only/memory-constrained
hardware — `OllamaProvider`'s default is 15s, which a small local machine
under load can exceed even for a small model (this is exactly what
happened on the dev machine noted below until this override was added):

```bash
SES_CLASSIFIER_MODEL=qwen2.5:0.5b SES_CLASSIFIER_TIMEOUT_MS=60000 npm run benchmark:ses
```

### Verified real-model run

Confirmed 2026-09-13 on a Light One dev machine (4-core Intel Celeron
N5095, 5.7GB RAM, CPU-only) with `ollama serve` actually running and
`qwen2.5:0.5b` pulled (the registry's default `llama3.1:8b` was not pulled
on this machine and is too large for it):

- A single real `classifySesEmail` call through the full
  Router → `ses-classifier` → `OllamaProvider` → Ollama → Structured
  Output → Validator → Evaluator pipeline correctly returned
  `{ category: 'project', confidence: 1, verified: true }` in ~43s.
- The first full `npm run benchmark:ses` run against all 56 examples used
  the (until-then hardcoded) 15s default timeout, and every single request
  timed out under this machine's memory pressure — 0% accuracy, but with
  every failure correctly reported as a per-example `ModelTimeoutError`
  rather than a crash. That gap is what `SES_CLASSIFIER_TIMEOUT_MS`
  (above) was added to close.
- A second run with `SES_CLASSIFIER_TIMEOUT_MS=60000` produced the first
  real (non-timeout-dominated) numbers this repo has ever had for a local
  model: **17.9% accuracy** (macro F1 16.5%) against the 56-example
  dataset, average latency ~50.6s/request on this 4-core CPU-only
  machine, still with some 60s timeouts at the tail (p95 60.0s). The
  benchmark's own conclusion logic correctly judged this: *"Local model is
  not yet sufficient on its own ... route to an API model when the
  Evaluator flags `needsHumanReview=true`."* This is the expected result
  for a 0.5B model with no fine-tuning (see "Phase 2" below) on
  CPU-constrained hardware, not a bug — the point of this run was to
  confirm the pipeline, timeout handling, and benchmark reporting all work
  against real inference, which they now demonstrably do.
- The `execute-task` CLI (the cross-process bridge added above) was run
  against real Ollama the same way an external Python caller would invoke
  it, and hit all three of its outcome paths for real: a `TIMEOUT` error
  at the exact `timeout_ms` requested (proving that field is genuinely
  plumbed through, not ignored), a `MALFORMED_OUTPUT` error when a plain
  `domain: "general"` request (no `system_prompt`) got back non-JSON text
  from the 0.5B model, and — with a `system_prompt` added — a real
  success: `{"category": "other", "confidence": 0.9, "reason": "...",
  ...}` with `trace.providerKind: "local"`, `trace.modelId:
  "general-local"`, in ~92s. All three are genuine Ollama responses, not
  mocked.
- Confirmed 2026-09-15: a standalone Python script (`subprocess.run(["npx",
  "tsx", "llm/src/cli.ts"], input=..., capture_output=True)`, standing in
  for the Automation Engine — not a Node/TypeScript test) sent the same
  `LLMTaskRequest` shape (`domain: "general"`, a `system_prompt`,
  `timeout_ms: 120000`) and got back real Ollama output that
  `json.loads()` parsed without error: `{"category": "other", "confidence":
  1, "reason": "..."}`, latency 68.1s. A first attempt against the
  registry's untouched default (`llama3.1:8b`, not pulled on this machine)
  correctly came back as a parseable `{"error": {"code":
  "MODEL_UNAVAILABLE", ...}}` instead of a Python-side crash — proving the
  error path round-trips just as cleanly as the success path. This closes
  the loop End-to-end: Python → `execute-task` → `LLMRouter` →
  `OllamaProvider` → Ollama → JSON → Python, with **no LLM Platform code
  change needed** — the existing wire format and CLI already sufficed once
  invoked correctly (see the `npx tsx` vs. `npm run` note above).

## Hardware check

```bash
bash scripts/check-local-ai.sh
```

Reports CPU cores/model, RAM, GPU/VRAM/CUDA (or "no NVIDIA GPU detected"),
disk, and `ollama --version`/`ollama list` — every check degrades to a
plain "not available" line instead of erroring when a tool is missing, so
it's safe to run on any box before picking a model size.

## Docker (future Light One Linux server)

```bash
cp .env.example .env   # optional, defaults work as-is
docker compose up
```

Three services (`docker-compose.yml`): `ollama` (model runtime),
`llm-platform` (this package, runs the benchmark by default), and
`postgres` (provisioned for a future DB-backed Model Registry — nothing
reads from it yet). Intentionally minimal — no Kubernetes, no extra
orchestration, no healthcheck choreography (`OllamaProvider` already
handles "Ollama isn't ready yet" as a normal `ModelUnavailableError`).

---

## Final report — Phase 1

### 1. What was implemented

A first-class **multi-model foundation**: a typed task/result schema, an
`LLMProvider`/`LocalModel` interface every model (local or API) implements,
a JSON-backed Model Registry, a rule-based Router that picks a model from
task metadata, a domain-agnostic Evaluator, and the first real domain
model — an SES email classifier — running Phase 1 (base model + prompt +
structured output + validation, no fine-tuning yet). See "Final report —
Phase 2" below for the real-model validation harness built on top of this.

### 2. File structure

See "Repository layout" above — it mirrors the structure the task spec
recommended (`docs/`, `llm/`, `models/`, `tests/`) almost exactly, wrapped
in one `light-one-platform/` root so it stays a clearly separate, addable
package rather than restructuring anything already in the repo.

### 3. Runtime selection reasoning

Full comparison in `docs/architecture/runtime-comparison.md`. Short
version: this repo currently has **zero Python and zero GPU-serving
infrastructure**, and the spec explicitly rules out standing up heavy new
infra for Phase 1. Ollama is the only one of the four candidates that gets
"a local model actually answering requests" running today with none of
that — one binary, a REST API on `localhost:11434`, JSON in/out. The
`OllamaProvider` adapter is a ~150-line `fetch` wrapper with zero SDK
dependency, isolated behind the `LocalModel` interface so a future
llama.cpp/vLLM/ONNX Runtime adapter (or a Light One-native engine) is a new
class, not a rewrite.

### 4. Model selection reasoning

Phase 1 does not fine-tune anything (spec explicitly defers that to Phase
3), so `ses-classifier` in the Registry points at the same base model tag
as `general-local` (`llama3.1:8b`) — an 8B instruction-tuned model is small
enough to run CPU-only at usable latency for a synchronous email
classification call, while still following a JSON-output system prompt
reliably enough for Phase 1's purposes. What actually makes `ses-classifier`
"SES" today is the system prompt (`models/ses/sesSystemPrompt.ts`) and the
domain validator (`models/ses/sesClassifier.ts`) — not different weights
yet. `ses-normalizer`, `insurance-classifier`, and `succession-analyzer`
are registered as `status: "planned"` so the Router/Registry already know
they'll exist, without anyone having built or trained them (per spec
section 1: don't mass-produce models, build the foundation first).

### 5. Router design

Rule-based, in priority order, evaluated in `LLMRouter.route()`
(`llm/src/router/llmRouter.ts`):

1. **Deterministic gate first** (`llm/src/deterministic/deterministicGate.ts`) —
   e.g. empty input never reaches a model at all.
2. **Privacy is a hard constraint**, not a preference — only models whose
   `privacyClass` covers the task's `privacyLevel` are ever eligible, full
   stop (spec section 11). A privacy="high" task is never routed to an API
   provider even if that would otherwise be the "better" choice.
3. **Domain-specific model wins** over `general` when both are eligible.
4. **Cost-first**: a local model is used whenever it's sufficient
   (`complexity` and `accuracy_requirement` both ≤ "medium"); only a task
   that genuinely needs more — high complexity or high accuracy — is
   routed to an API model, and even then the cheapest capable one unless
   complexity is specifically "high" (which goes straight to the most
   capable/priciest option). This directly encodes spec section 10's
   "Deterministic → Local → cheap API → premium API" ordering.

### 6. Test results

```
✓ tests/localModel.test.ts (9 tests)     — OllamaProvider: normal inference,
                                            malformed JSON, missing fields,
                                            unreachable server, model not
                                            pulled (404), timeout, empty
                                            input, isAvailable() both ways
✓ tests/router.test.ts (6 tests)         — the 4 required routing scenarios
                                            plus domain-preference and a
                                            no-eligible-model error case
✓ tests/sesClassifier.test.ts (7 tests)  — verified/high-confidence path,
                                            low-confidence → human review,
                                            unknown category → human review,
                                            always routes through ses-classifier,
                                            timeout/unavailable/malformed propagation
✓ tests/integration.test.ts (4 tests)    — full Task→Router→Model→
                                            Evaluator→Result pipeline,
                                            deterministic short-circuit,
                                            confidence clamping, error
                                            propagation

Test Files  4 passed (4)
     Tests  26 passed (26)
```

`npm run typecheck` (strict TypeScript) also passes clean. See "Final
report — Phase 2" below for the current full suite (40 tests, 8 files)
after the benchmark harness and real-environment tests were added.

### 7. Current constraints

- **No existing "AI Automation Engine" was found in this repository** —
  the task spec assumed one exists to define a responsibility boundary
  against; `app/`/`config/` are an unrelated, unused Rails scaffold per the
  root `README.md`, and `frontend/`/`functions/`/`supabase/` belong to the
  succession-matching product. This package is therefore the first piece
  of AI infrastructure in the repo, not an addition to an existing engine;
  wiring an actual Automation Engine to `LLMTaskRequest` is future work.
- `ses-classifier` has no fine-tuned weights yet — it's a prompted base
  model, so accuracy depends entirely on prompt quality until Phase 2 data
  collection happens.
- No live end-to-end run against a real Ollama server was performed in
  this sandbox (no GPU/Ollama process available here) — `OllamaProvider`
  is verified against a mocked `fetch`, which exercises the exact HTTP
  request/response contract Ollama's API documents. (Phase 2 below adds a
  second layer of tests against a genuinely unreachable real endpoint, no
  mocking, to prove this holds outside of simulation too.)
- `ses-normalizer`, `insurance-classifier`, and `succession-analyzer` are
  registry entries only (`status: "planned"`) — no prompts or providers
  built for them yet.
- Claude/OpenAI/Gemini providers are real, working `fetch` wrappers but
  untested against live APIs in this change (no API keys in this
  sandbox); they throw a clear `ModelUnavailableError` when no key is
  configured rather than failing silently.

### 8. Data needed for Phase 2 fine-tuning

See `docs/ai/ses-classifier.md` for the full plan. Short version: labeled
`{subject, body, sender, attachmentNames} → category` pairs, a few hundred
per category minimum, with deliberate coverage of ambiguous cases (mixed
engineer/sales signals, forwarded postings, non-Japanese emails). The
Evaluator's `needsHumanReview` flag is designed to double as an ongoing,
low-effort source of exactly this data once it's running in production.

### 9. Next tasks

1. Wire a real Automation Engine (or whatever calls this first) to
   `LLMTaskRequest`/`router.executeClassify` end to end against a live
   Ollama process.
2. Start Phase 2 data collection for SES (see above) — the sooner
   `needsHumanReview` results start getting confirmed/corrected, the
   sooner there's a real dataset.
3. Build the next domain model against the same foundation —
   `insurance-classifier` is already registered as `planned` and is the
   most likely next candidate given the existing `insurance-risk-diagnosis`
   product in this repo.
4. Add a second local runtime adapter (llama.cpp server is the natural
   next one) to prove the `LocalModel` interface boundary holds under a
   real second implementation, not just in theory.
5. Decide where Model Registry data should live long-term (`models.json`
   is fine for Phase 1; a DB-backed registry per spec section 5 becomes
   worth it once multiple teams are adding models independently).

---

## Final report — Phase 2 (real-model validation harness)

Goal of this change: make the pipeline **ready to validate against a real
Ollama model the moment it reaches a machine that can reach one** —
without pretending a benchmark happened here. No fine-tuning, no network
workarounds, no code changes beyond what's needed for that readiness.

### 1. Changed files

New: `docs/architecture/runtime-dependencies.md`,
`models/ses/benchmark/{dataset,metrics,runBenchmark}.ts`,
`scripts/check-local-ai.sh`, `Dockerfile`, `docker-compose.yml`,
`.env.example`, `tests/{ollamaProviderReal,sesBenchmarkDataset,benchmarkMetrics,benchmarkRunnerSkip}.test.ts`.
Modified: `tests/sesClassifier.test.ts` (added timeout/unavailable/malformed
propagation cases), `package.json` (added `tsx` dev dep + `benchmark:ses`
script), `README.md`. **`llm/` core (Router/Registry/Providers/Evaluator)
was not touched** — Phase 1's adapter boundaries already supported
everything this phase needed.

### 2. What was implemented

- **Dependency separation** (`docs/architecture/runtime-dependencies.md`):
  written analysis confirming Ollama/model-download/GPU/env-var/provider-config
  boundaries were already correctly isolated to `OllamaProvider` in Phase 1 —
  no code needed to change for this, it's documentation of an existing property.
- **Real (unmocked) error-handling proof** (`tests/ollamaProviderReal.test.ts`):
  hits a genuinely unreachable `http://127.0.0.1:11434` — no `fetch` mock —
  and confirms `classify()`/`generate()`/`isAvailable()` degrade to
  `ModelUnavailableError`/`false` instead of an unhandled exception.
- **Stronger Mock-based SES tests** (`tests/sesClassifier.test.ts`): timeout,
  unavailable, and malformed-JSON scenarios now propagate correctly through
  `classifySesEmail`, not just the generic Router.
- **56-example synthetic SES dataset** (`models/ses/benchmark/dataset.ts`,
  14 per category), including every hard case the spec asked for: mixed
  project/sales signal, an engineer profile written as a sales pitch,
  subject-alone-insufficient, sparse SES vocabulary, informal/broken
  Japanese, HTML-leftover noise, a long signature block, a forwarded
  email, and a multi-project digest. Verified by
  `tests/sesBenchmarkDataset.test.ts` (count/uniqueness/shape).
- **Benchmark metrics module** (`models/ses/benchmark/metrics.ts`): pure,
  dependency-free accuracy/precision/recall/F1/confusion-matrix/invalid-JSON-rate/
  latency-percentile computation, plus a documented (not silently
  hardcoded) provisional pass/fail heuristic. Fully unit-tested
  (`tests/benchmarkMetrics.test.ts`) with hand-computed expected values —
  this is real, verified math, independent of whether any LLM is available.
- **Benchmark runner** (`models/ses/benchmark/runBenchmark.ts`,
  `npm run benchmark:ses`): runs the real
  Router→ses-classifier→Ollama→Validator→Evaluator pipeline against the
  dataset and prints the exact report format the spec asked for
  (Model/Parameters/Quantization/Runtime/Hardware/Dataset/Total
  samples/Accuracy/Precision/Recall/F1/Invalid JSON/latency
  avg-p50-p95/per-category accuracy/Failure cases/Conclusion). Prints
  `SKIPPED: local model unavailable` and exits 0 when Ollama isn't
  reachable — proven for real in this sandbox
  (`tests/benchmarkRunnerSkip.test.ts` runs the actual script as a child
  process).
- **Model swap convenience**: `SES_CLASSIFIER_MODEL` env var (runner-only)
  plus the pre-existing `models.json`-as-source-of-truth design — no model
  name is hardcoded anywhere in `llm/` or `models/`.
- **Docker scaffolding** (`Dockerfile`, `docker-compose.yml`, `.env.example`):
  minimal `llm-platform` + `ollama` + `postgres` compose file for the
  target Linux server, deliberately not more than that.
- **Hardware detection** (`scripts/check-local-ai.sh`): CPU/RAM/GPU/VRAM/CUDA/disk/ollama
  report with graceful fallbacks; already run in this sandbox (see below).

### 3. Test results

```
✓ tests/benchmarkMetrics.test.ts (6 tests)
✓ tests/localModel.test.ts (9 tests)
✓ tests/sesClassifier.test.ts (7 tests)
✓ tests/router.test.ts (6 tests)
✓ tests/integration.test.ts (4 tests)
✓ tests/ollamaProviderReal.test.ts (3 tests)     — real, unmocked, against a genuinely absent Ollama
✓ tests/sesBenchmarkDataset.test.ts (4 tests)
✓ tests/benchmarkRunnerSkip.test.ts (1 test)     — runs the actual benchmark:ses script as a child process

Test Files  8 passed (8)
     Tests  40 passed (40)
```

`npm run typecheck` passes clean. `npm run benchmark:ses` run directly in
this sandbox (not just via the test) printed:

```
SKIPPED: local model unavailable
  endpoint tried: http://localhost:11434
  model tried:    llama3.1:8b
  (start Ollama with `ollama serve` and `ollama pull <model>`, or set OLLAMA_HOST / SES_CLASSIFIER_MODEL)
```

exit code `0`, as designed. `scripts/check-local-ai.sh` was also run for
real in this sandbox: 4 CPU cores (Intel Xeon @2.80GHz), 15GB RAM, no
NVIDIA GPU, 30GB free disk, `ollama` not on `PATH` — consistent with "no
Ollama here" and useful as-is for sizing a model choice on any other box.

### 4. How to use the Benchmark Runner

```bash
ollama pull llama3.1:8b   # or another model — see "Swapping the SES model"
ollama serve
cd light-one-platform
npm install
npm run benchmark:ses
```

Optional: `SES_CLASSIFIER_MODEL=<tag> npm run benchmark:ses` to try a
different model without editing the registry; `OLLAMA_HOST=<url>` to point
at a non-default Ollama endpoint (e.g. the `docker-compose.yml` service
name `http://ollama:11434`). See "Benchmarking the SES classifier for
real" above for full usage and what the report contains.

### 5. Work needed on the real machine

1. Install Ollama and confirm with `scripts/check-local-ai.sh`.
2. `ollama pull llama3.1:8b` (or another model chosen from
   `docs/architecture/runtime-comparison.md`'s guidance + the real
   hardware report).
3. `ollama serve` (or run via `docker compose up`).
4. `npm run benchmark:ses` and read the printed report.
5. Based on the real Accuracy/F1/per-category numbers: if the local model
   clears the bar, ship it as-is; if not, note which categories are weak
   (the report names them) and decide whether prompt iteration, few-shot
   examples, or Phase 3 fine-tuning is the right next step — this decision
   is exactly what Phase 1's spec deferred to "after a real benchmark
   exists," which is now possible.

### 6. Why this couldn't run in the remote environment

This session's only available environment
(`env_017wCdsCYNsdm7MwwUR3CpFy`, "Default — trusted network access") is a
`policy-enforcing egress proxy` allowlisting only a small fixed set of
hosts (`registry.npmjs.org`, `pypi.org`, `api.anthropic.com`, and a few
others — see the proxy's own `/root/.ccr/README.md`). Both `ollama.com`
(the Ollama installer/model registry) and `huggingface.co` (an alternate
model source) returned an explicit `403` **policy denial**, not a timeout
or a missing-package error — confirmed via `recentRelayFailures` in the
proxy's status endpoint. The proxy's own documentation says such denials
should be reported, not retried or routed around, so no further attempts
(alternate mirrors, apt, pip-bundled weights, etc.) were made. This is not
a repo bug — it is a deliberate property of this specific development
sandbox, and does not apply to Light One's actual Linux server.

### 7. Phase 3 candidates

1. Run `npm run benchmark:ses` for real on the Light One Linux server and
   commit the actual report (accuracy/F1/latency/failure cases) — this is
   the prerequisite for every decision below, not something to guess at.
2. Based on that report: decide prompt-only vs. few-shot vs. fine-tuning
   per spec Step 9 — driven by the measured weak categories, not assumed
   ones.
3. If fine-tuning is warranted, start Phase 2 data collection for real
   (see `docs/ai/ses-classifier.md`) — the synthetic dataset here is a
   benchmark harness input, not a fine-tuning training set.
4. Decide the actual local-vs-API-fallback threshold from real confidence/
   accuracy correlation data (spec Step 6) — `suggestConclusion()`'s
   thresholds in `metrics.ts` are explicitly provisional and documented as
   such; replace them once real numbers exist.
5. Run the same dataset against Gemini/GPT/Claude for a handful of
   samples (spec Step 7) to measure how much headroom an API fallback
   would actually buy, without burning API budget on the full 56.
