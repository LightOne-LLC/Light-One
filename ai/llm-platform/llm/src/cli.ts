import { ModelRegistry } from './registry/modelRegistry.js';
import { ModelDescriptor } from './registry/modelDescriptor.js';
import { LLMRouter, ProviderFactory } from './router/llmRouter.js';
import { parseLLMTaskRequest, LLMTaskRequest } from './schemas/llmTask.js';
import { LLMProvider } from './interfaces/llmProvider.js';
import { LLMProviderError } from './interfaces/errors.js';
import { OllamaProvider } from './providers/local/ollamaProvider.js';
import { ClaudeProvider } from './providers/claude/claudeProvider.js';
import { OpenAIProvider } from './providers/openai/openAIProvider.js';
import { GeminiProvider } from './providers/gemini/geminiProvider.js';

/**
 * `npm run execute-task` — a process-boundary transport for the wire
 * format `LLMTaskRequest` already defined in schemas/llmTask.ts (spec
 * section 8: "used by callers outside this package — the Automation
 * Engine, future Ruby/Node callers, etc."). That wire format existed
 * with nothing on the other end of it: the Automation Engine (Python)
 * cannot `import` this TypeScript package, and no HTTP server or CLI
 * exposed it. This is the smallest possible bridge — stdin JSON in,
 * stdout JSON out, one process per call — so any external process in
 * any language can reach the Router via `execFile`/`subprocess`
 * without this package growing a persistent server, auth, or a new
 * abstraction layer.
 *
 * Only `task_type: "classify"` is supported, because
 * `LLMRouter.executeClassify` is the only full pipeline the Router
 * implements today — every other task_type in the wire format's union
 * is accepted by the schema but has no Router method yet. Claiming to
 * support them here would be inventing a capability that doesn't
 * exist, so unsupported task types fail loudly instead.
 *
 * Two optional fields beyond the typed `LLMTaskRequest` are read
 * directly off the request body: `system_prompt` (forwarded to
 * `executeClassify`, same as every domain model like `classifySesEmail`
 * already passes) and `timeout_ms` (forwarded to the same per-request
 * `timeoutMs` every `LLMProvider.classify` call already accepts — this
 * is the fix for the exact "15s isn't enough on real CPU-only hardware"
 * problem the SES benchmark hit; see the README's "Verified real-model
 * run"). Neither needed a schema change to `LLMTaskRequest` itself.
 */

const providerFactory: ProviderFactory = (descriptor: ModelDescriptor): LLMProvider => {
  switch (descriptor.runtime.kind) {
    case 'ollama':
      return new OllamaProvider({ modelId: descriptor.runtime.model, name: descriptor.id, endpoint: descriptor.runtime.endpoint });
    case 'claude':
      return new ClaudeProvider({ model: descriptor.runtime.model, name: descriptor.id });
    case 'openai':
      return new OpenAIProvider({ model: descriptor.runtime.model, name: descriptor.id });
    case 'gemini':
      return new GeminiProvider({ model: descriptor.runtime.model, name: descriptor.id });
  }
};

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function writeError(code: string, message: string): void {
  process.stdout.write(JSON.stringify({ error: { code, message } }) + '\n');
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const raw = await readStdin();

  let request: LLMTaskRequest & { system_prompt?: string; timeout_ms?: number };
  try {
    request = JSON.parse(raw);
  } catch (err) {
    writeError('INVALID_JSON', `request body on stdin was not valid JSON: ${(err as Error).message}`);
    return;
  }

  if (request.task_type !== 'classify') {
    writeError(
      'UNSUPPORTED_TASK_TYPE',
      `task_type "${request.task_type}" is not implemented — only "classify" has a Router pipeline (LLMRouter.executeClassify) today`,
    );
    return;
  }

  const registry = ModelRegistry.loadDefault();
  const router = new LLMRouter(registry, providerFactory);

  try {
    const task = parseLLMTaskRequest(request);
    const evaluated = await router.executeClassify(task, { systemPrompt: request.system_prompt, timeoutMs: request.timeout_ms });
    process.stdout.write(JSON.stringify(evaluated) + '\n');
  } catch (err) {
    if (err instanceof LLMProviderError) {
      writeError(err.code, err.message);
      return;
    }
    writeError('INTERNAL_ERROR', (err as Error).message);
  }
}

main().catch((err) => {
  writeError('INTERNAL_ERROR', `execute-task CLI failed unexpectedly: ${(err as Error).message}`);
});
