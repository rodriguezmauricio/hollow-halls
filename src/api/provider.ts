/**
 * Provider-agnostic LLM streaming interface. Every backend (Anthropic API,
 * Ollama, Claude Code CLI) implements this so the rest of the app (AgentManager,
 * future CostTracker, handoff logic) stays ignorant of which model is answering.
 */

export type ProviderId = 'anthropic' | 'ollama' | 'claude-code';

export interface StreamArgs {
  readonly system: string;
  readonly userPrompt: string;
  readonly maxTokens: number;
  readonly signal?: AbortSignal;
  readonly onTextChunk: (chunk: string) => void;
}

export interface StreamResult {
  readonly fullText: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly model: string;
  /** Cost reported by the provider if it returns one (Claude Code CLI does
   *  via its terminal `result` event's total_cost_usd). Undefined when the
   *  caller should compute cost from tokens × rate. */
  readonly providerReportedCostUSD?: number;
}

export interface LlmProvider {
  readonly id: ProviderId;
  stream(args: StreamArgs): Promise<StreamResult>;
}

/** Thrown when a provider cannot be used and the user needs to act. */
export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerId: ProviderId,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}
