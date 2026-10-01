import { describe, expect, it } from 'vitest';
import { parseLLMTaskRequest } from '../llm/src/schemas/llmTask.js';
import { createTestRouter } from './helpers/testRouter.js';
import { ModelUnavailableError } from '../llm/src/interfaces/errors.js';
import { LLMRouter } from '../llm/src/router/llmRouter.js';
import { ModelRegistry } from '../llm/src/registry/modelRegistry.js';
import { LLMProvider, ClassifyRequest } from '../llm/src/interfaces/llmProvider.js';

describe('LLMTask -> Router -> Local Model -> Structured Output -> Evaluator -> Result', () => {
  it('runs a classify task end to end through a local model and produces an evaluated result', async () => {
    const { router } = createTestRouter({
      'ses-classifier': { kind: 'success', result: { category: 'project', confidence: 0.94, reason: 'AWS案件の募集要項が記載' } },
    });

    const task = parseLLMTaskRequest({
      task_type: 'classify',
      domain: 'ses',
      input: '件名: AWSインフラエンジニア案件\n本文: 単価80万円、リモート可',
      requirements: { privacy: 'high', accuracy: 'medium', latency: 'low' },
    });

    const evaluated = await router.executeClassify(task);

    expect(evaluated.output).toEqual({ category: 'project', confidence: 0.94, reason: 'AWS案件の募集要項が記載' });
    expect(evaluated.verified).toBe(true);
    expect(evaluated.trace).toMatchObject({ providerKind: 'local', modelId: 'ses-classifier' });
    expect(evaluated.trace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('short-circuits on the deterministic gate for empty input, without calling any model', async () => {
    const { router, providers } = createTestRouter();

    const task = parseLLMTaskRequest({ task_type: 'classify', domain: 'general', input: '   ' });
    const evaluated = await router.executeClassify(task);

    expect(evaluated.output.category).toBe('other');
    expect(evaluated.trace.providerKind).toBe('deterministic');
    expect(providers.size).toBe(0); // no provider was ever constructed, let alone called
  });

  it('clamps and flags an out-of-range confidence instead of trusting it as a probability', async () => {
    const { router } = createTestRouter({
      'general-local': { kind: 'success', result: { category: 'other', confidence: 1.7 } },
    });

    const task = parseLLMTaskRequest({ task_type: 'classify', domain: 'general', input: 'some ambiguous text' });
    const evaluated = await router.executeClassify(task);

    expect(evaluated.output.confidence).toBe(1);
    expect(evaluated.notes.some((n) => n.includes('outside [0, 1]'))).toBe(true);
  });

  it('propagates a model-unavailable error instead of silently swallowing it', async () => {
    const { router } = createTestRouter({
      'general-local': { kind: 'unavailable' },
    });

    const task = parseLLMTaskRequest({ task_type: 'classify', domain: 'general', input: 'some text' });

    await expect(router.executeClassify(task)).rejects.toThrow(ModelUnavailableError);
  });

  it('forwards options.timeoutMs from executeClassify through to the provider request', async () => {
    let receivedTimeoutMs: number | undefined;
    const recordingProvider: LLMProvider = {
      name: 'recording-provider',
      providerKind: 'local',
      async generate() {
        throw new Error('not used by this test');
      },
      async classify(request: ClassifyRequest) {
        receivedTimeoutMs = request.timeoutMs;
        return { category: 'other', confidence: 0.9 };
      },
    };
    const router = new LLMRouter(ModelRegistry.loadDefault(), () => recordingProvider);

    const task = parseLLMTaskRequest({ task_type: 'classify', domain: 'general', input: 'some text' });
    await router.executeClassify(task, { timeoutMs: 60_000 });

    expect(receivedTimeoutMs).toBe(60_000);
  });
});

describe('LLMTask -> Router -> Local Model -> Result (generate, no Evaluator)', () => {
  it('runs a generate task end to end and returns the provider text plus a trace, unevaluated', async () => {
    const { router } = createTestRouter();

    const task = parseLLMTaskRequest({ task_type: 'generate', domain: 'general', input: 'summarize this' });
    const result = await router.executeGenerate(task);

    expect(result.output.text).toContain('summarize this');
    expect(result.trace).toMatchObject({ providerKind: 'local', modelId: 'general-local' });
    expect(result.trace.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('forwards systemPrompt and timeoutMs from executeGenerate through to the provider request', async () => {
    let received: { systemPrompt?: string; timeoutMs?: number } = {};
    const recordingProvider: LLMProvider = {
      name: 'recording-provider',
      providerKind: 'local',
      async generate(request) {
        received = { systemPrompt: request.systemPrompt, timeoutMs: request.timeoutMs };
        return { text: 'ok' };
      },
      async classify() {
        throw new Error('not used by this test');
      },
    };
    const router = new LLMRouter(ModelRegistry.loadDefault(), () => recordingProvider);

    const task = parseLLMTaskRequest({ task_type: 'generate', domain: 'general', input: 'some text' });
    await router.executeGenerate(task, { systemPrompt: 'be concise', timeoutMs: 60_000 });

    expect(received).toEqual({ systemPrompt: 'be concise', timeoutMs: 60_000 });
  });
});
