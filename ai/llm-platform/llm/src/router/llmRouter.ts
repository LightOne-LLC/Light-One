import { LLMProvider } from '../interfaces/llmProvider.js';
import { ModelRegistry } from '../registry/modelRegistry.js';
import { ModelDescriptor, capabilityForTaskType, privacySatisfies } from '../registry/modelDescriptor.js';
import { TaskMetadata } from '../schemas/taskMetadata.js';
import { LLMTask } from '../schemas/llmTask.js';
import { ClassifyResult, EvaluatedResult, ProviderKind } from '../schemas/results.js';
import { tryDeterministicClassify } from '../deterministic/deterministicGate.js';
import { Evaluator } from '../evaluator/evaluator.js';

export type ProviderFactory = (descriptor: ModelDescriptor) => LLMProvider;

export interface RoutingDecision {
  descriptor: ModelDescriptor;
  reason: string;
}

const COST_ORDER: Record<ModelDescriptor['costClass'], number> = { local: 0, low: 1, medium: 2, high: 3 };

function sortByCost(models: ModelDescriptor[], direction: 'asc' | 'desc'): ModelDescriptor[] {
  const sorted = [...models].sort((a, b) => COST_ORDER[a.costClass] - COST_ORDER[b.costClass]);
  return direction === 'asc' ? sorted : sorted.reverse();
}

/**
 * Rule-based LLM Router (spec section 2). Deliberately simple: a fixed
 * priority order, no learned weights. Decision inputs are exactly the
 * fields on TaskMetadata — domain, task_type (via capability), complexity,
 * accuracy_requirement, privacy_level, cost/latency class of each
 * candidate model.
 *
 * Priority, cheapest-first (spec section 10), with privacy as a hard
 * constraint (spec section 11) that overrides cost/capability preference:
 *   1. domain-specific model over general
 *   2. local over any API model, unless the task truly needs more power
 *   3. when more power is needed and privacy allows leaving the machine,
 *      the cheapest API model with the right capability; a "high"
 *      complexity task goes straight for the most capable (priciest) one
 */
export class LLMRouter {
  constructor(private readonly registry: ModelRegistry, private readonly providerFactory: ProviderFactory) {}

  route(metadata: TaskMetadata): RoutingDecision {
    const capability = capabilityForTaskType(metadata.taskType);
    const candidates = this.registry.findByCapability(capability);

    const privacySafe = candidates.filter((m) => privacySatisfies(m.privacyClass, metadata.privacyLevel));
    if (privacySafe.length === 0) {
      throw new Error(
        `LLMRouter: no active model can satisfy privacy_level="${metadata.privacyLevel}" for capability="${capability}" (domain="${metadata.domain}")`,
      );
    }

    const domainMatch = privacySafe.filter((m) => m.domain === metadata.domain);
    const generalMatch = privacySafe.filter((m) => m.domain === 'general');
    const pool = domainMatch.length > 0 ? domainMatch : generalMatch.length > 0 ? generalMatch : privacySafe;

    const needsHighPower = metadata.complexity === 'high' || metadata.accuracyRequirement === 'high';

    if (!needsHighPower) {
      const local = pool.filter((m) => m.provider === 'local');
      if (local.length > 0) {
        return {
          descriptor: local[0],
          reason: `domain="${metadata.domain}" complexity="${metadata.complexity}" accuracy="${metadata.accuracyRequirement}" -> a local model is sufficient and cheapest`,
        };
      }
      const cheapestApi = sortByCost(pool.filter((m) => m.provider !== 'local'), 'asc')[0];
      if (!cheapestApi) throw new Error(`LLMRouter: no model available for capability="${capability}" domain="${metadata.domain}"`);
      return {
        descriptor: cheapestApi,
        reason: `no local model for domain="${metadata.domain}"/capability="${capability}" -> cheapest API model`,
      };
    }

    if (metadata.privacyLevel === 'high') {
      const local = pool.filter((m) => m.provider === 'local');
      if (local.length === 0) {
        throw new Error(
          `LLMRouter: task needs high complexity/accuracy but privacy_level="high" forces a local model, and none is available for capability="${capability}"`,
        );
      }
      return {
        descriptor: local[0],
        reason: `privacy_level="high" forces a local model even though complexity="${metadata.complexity}"/accuracy="${metadata.accuracyRequirement}" would otherwise call for an API model`,
      };
    }

    const apiCandidates = pool.filter((m) => m.provider !== 'local');
    if (apiCandidates.length > 0) {
      const ranked = sortByCost(apiCandidates, metadata.complexity === 'high' ? 'desc' : 'asc');
      return {
        descriptor: ranked[0],
        reason: `complexity="${metadata.complexity}" accuracy="${metadata.accuracyRequirement}" -> routed to ${metadata.complexity === 'high' ? 'the most capable' : 'the cheapest sufficient'} API model`,
      };
    }

    const local = pool.filter((m) => m.provider === 'local');
    if (local.length === 0) throw new Error(`LLMRouter: no model available for capability="${capability}" domain="${metadata.domain}"`);
    return { descriptor: local[0], reason: 'no API model available for this capability -> falling back to local model' };
  }

  /**
   * Full classify pipeline: Task -> deterministic gate -> Router -> Provider
   * -> (provider already returns Structured Output) -> Evaluator -> Result.
   * This is the path SES classification (and any future classify-type
   * domain model) runs through.
   */
  async executeClassify(
    task: LLMTask,
    options: { systemPrompt?: string; timeoutMs?: number } = {},
  ): Promise<EvaluatedResult<ClassifyResult>> {
    const startedAt = Date.now();
    const input = typeof task.input === 'string' ? task.input : JSON.stringify(task.input ?? '');

    const deterministic = tryDeterministicClassify(input);
    if (deterministic.handled && deterministic.result) {
      const evaluated = Evaluator.evaluateClassification(deterministic.result);
      return {
        ...evaluated,
        trace: { providerKind: 'deterministic', modelId: 'deterministic-gate', routedReason: deterministic.reason, durationMs: Date.now() - startedAt },
      };
    }

    const decision = this.route(task.metadata);
    const provider = this.providerFactory(decision.descriptor);
    const result = await provider.classify({ input, systemPrompt: options.systemPrompt, timeoutMs: options.timeoutMs });

    const evaluated = Evaluator.evaluateClassification(result);
    return {
      ...evaluated,
      trace: {
        providerKind: decision.descriptor.provider as ProviderKind,
        modelId: decision.descriptor.id,
        routedReason: decision.reason,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}
