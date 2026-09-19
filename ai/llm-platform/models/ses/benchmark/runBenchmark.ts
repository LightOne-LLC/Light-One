import os from 'node:os';
import { ModelRegistry, LLMRouter, ModelDescriptor } from '../../../llm/src/index.js';
import { OllamaProvider } from '../../../llm/src/providers/local/ollamaProvider.js';
import { MalformedOutputError } from '../../../llm/src/interfaces/errors.js';
import { classifySesEmail } from '../sesClassifier.js';
import { SES_BENCHMARK_DATASET } from './dataset.js';
import { SES_CATEGORIES } from '../sesEmail.js';
import { BenchmarkOutcome, computeBenchmarkReport, suggestConclusion } from './metrics.js';

/**
 * `npm run benchmark:ses` — spec Step 5/9. Runs the real SES classifier
 * pipeline (Router -> ses-classifier -> Ollama -> Structured Output ->
 * Validator -> Evaluator) against the synthetic dataset and prints the
 * benchmark report the spec asks for.
 *
 * This intentionally does nothing to reach out to ollama.com or
 * huggingface.co — it only ever talks to whatever Ollama endpoint is
 * already configured (default http://localhost:11434). If nothing is
 * listening there, or the model isn't pulled, it prints
 * "SKIPPED: local model unavailable" and exits 0 — that is the expected,
 * successful outcome in this repo's remote development sandbox (see the
 * root README's "Remote environment limitation" section). On a real
 * machine with `ollama serve` running and the model pulled, this produces
 * the actual benchmark.
 */

async function fetchOllamaModelInfo(endpoint: string, model: string): Promise<{ parameters: string; quantization: string }> {
  try {
    const res = await fetch(`${endpoint}/api/show`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return { parameters: 'unknown', quantization: 'unknown' };
    const data = (await res.json()) as { details?: { parameter_size?: string; quantization_level?: string } };
    return {
      parameters: data.details?.parameter_size ?? 'unknown',
      quantization: data.details?.quantization_level ?? 'unknown',
    };
  } catch {
    return { parameters: 'unknown (ollama show failed)', quantization: 'unknown' };
  }
}

function describeHardware(): string {
  const cpus = os.cpus();
  const totalMemGb = (os.totalmem() / 1024 ** 3).toFixed(1);
  return `${cpus.length} CPU core(s) (${cpus[0]?.model ?? 'unknown model'}), ${totalMemGb} GB RAM, platform=${os.platform()}/${os.arch()}` +
    ' (GPU/VRAM/CUDA: run scripts/check-local-ai.sh for full detail)';
}

function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatMs(n: number): string {
  return `${n.toFixed(0)}ms`;
}

async function main() {
  const registry = ModelRegistry.loadDefault();
  const descriptor = registry.get('ses-classifier');

  if (!descriptor || descriptor.runtime.kind !== 'ollama') {
    console.log('SKIPPED: local model unavailable (no Ollama-backed "ses-classifier" entry in the Model Registry)');
    return;
  }

  const modelId = process.env.SES_CLASSIFIER_MODEL ?? descriptor.runtime.model;
  const endpoint = descriptor.runtime.endpoint ?? process.env.OLLAMA_HOST ?? 'http://localhost:11434';
  const defaultTimeoutMs = process.env.SES_CLASSIFIER_TIMEOUT_MS ? Number(process.env.SES_CLASSIFIER_TIMEOUT_MS) : undefined;
  const provider = new OllamaProvider({ modelId, name: descriptor.id, endpoint, defaultTimeoutMs });

  const available = await provider.isAvailable();
  if (!available) {
    console.log('SKIPPED: local model unavailable');
    console.log(`  endpoint tried: ${endpoint}`);
    console.log(`  model tried:    ${modelId}`);
    console.log('  (start Ollama with `ollama serve` and `ollama pull <model>`, or set OLLAMA_HOST / SES_CLASSIFIER_MODEL)');
    return;
  }

  const router = new LLMRouter(registry, (d: ModelDescriptor) => {
    if (d.id === descriptor.id) return provider;
    if (d.runtime.kind === 'ollama') return new OllamaProvider({ modelId: d.runtime.model, name: d.id, endpoint: d.runtime.endpoint });
    throw new Error(`benchmark runner has no provider wired up for runtime kind "${d.runtime.kind}"`);
  });

  console.log(`Running SES benchmark against ${SES_BENCHMARK_DATASET.length} synthetic examples...`);
  const outcomes: BenchmarkOutcome[] = [];

  for (const example of SES_BENCHMARK_DATASET) {
    const startedAt = performance.now();
    try {
      const evaluated = await classifySesEmail(router, example.email);
      outcomes.push({
        exampleId: example.id,
        expectedCategory: example.expectedCategory,
        predictedCategory: evaluated.output.category,
        latencyMs: performance.now() - startedAt,
        invalidJson: false,
      });
    } catch (err) {
      outcomes.push({
        exampleId: example.id,
        expectedCategory: example.expectedCategory,
        predictedCategory: null,
        latencyMs: performance.now() - startedAt,
        invalidJson: err instanceof MalformedOutputError,
        errorMessage: (err as Error).message,
      });
    }
  }

  const report = computeBenchmarkReport(outcomes, SES_CATEGORIES);
  const modelInfo = await fetchOllamaModelInfo(endpoint, modelId);

  const overall = Object.values(report.perCategory);
  const macroPrecision = overall.reduce((sum, m) => sum + m.precision, 0) / overall.length;
  const macroRecall = overall.reduce((sum, m) => sum + m.recall, 0) / overall.length;
  const macroF1 = overall.reduce((sum, m) => sum + m.f1, 0) / overall.length;

  console.log('');
  console.log('=== SES Classifier Benchmark Report ===');
  console.log(`Model:              ${modelId}`);
  console.log(`Parameters:         ${modelInfo.parameters}`);
  console.log(`Quantization:       ${modelInfo.quantization}`);
  console.log(`Runtime:            Ollama (${endpoint})`);
  console.log(`Hardware:           ${describeHardware()}`);
  console.log(`Dataset:            models/ses/benchmark/dataset.ts (synthetic, no real customer data)`);
  console.log(`Total samples:      ${report.totalSamples}`);
  console.log(`Accuracy:           ${formatPercent(report.accuracy)}`);
  console.log(`Precision (macro):  ${formatPercent(macroPrecision)}`);
  console.log(`Recall (macro):     ${formatPercent(macroRecall)}`);
  console.log(`F1 (macro):         ${formatPercent(macroF1)}`);
  console.log(`Invalid JSON:       ${formatPercent(report.invalidJsonRate)}`);
  console.log(`Average latency:    ${formatMs(report.averageLatencyMs)}`);
  console.log(`P50:                ${formatMs(report.p50LatencyMs)}`);
  console.log(`P95:                ${formatMs(report.p95LatencyMs)}`);
  for (const category of SES_CATEGORIES) {
    console.log(`${category} accuracy:${' '.repeat(Math.max(1, 10 - category.length))}${formatPercent(report.perCategory[category].recall)} (support=${report.perCategory[category].support})`);
  }
  console.log('Failure cases:');
  if (report.failureCases.length === 0) {
    console.log('  (none)');
  } else {
    for (const failure of report.failureCases) {
      console.log(
        `  - ${failure.exampleId}: expected="${failure.expectedCategory}" predicted="${failure.predictedCategory ?? '(error)'}"${failure.errorMessage ? ` error="${failure.errorMessage}"` : ''}`,
      );
    }
  }
  console.log(`Conclusion:         ${suggestConclusion(report)}`);
}

main().catch((err) => {
  console.error('Benchmark run failed unexpectedly:', err);
  process.exitCode = 1;
});
