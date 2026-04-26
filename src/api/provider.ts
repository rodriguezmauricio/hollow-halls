/**
 * Provider-agnostic LLM streaming interface. Every backend (Anthropic API,
 * Ollama, Claude Code CLI) implements this so the rest of the app (AgentManager,
 * future CostTracker, handoff logic) stays ignorant of which model is answering.
 */

export type ProviderId = 'anthropic' | 'ollama' | 'claude-code';

export type PermissionMode =
  | 'plan'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'default'
  | 'dontAsk';

export interface ToolUseEvent {
  readonly phase: 'start' | 'result';
  readonly toolName: string;
  /** Parsed input payload for phase=start. Provider-shaped; caller formats it. */
  readonly input?: unknown;
  /** Stringified output for phase=result. */
  readonly output?: string;
  readonly isError?: boolean;
  /** Lets the caller correlate start/result pairs across interleaved tool calls. */
  readonly toolUseId?: string;
}

export interface StreamArgs {
  readonly system: string;
  readonly userPrompt: string;
  readonly maxTokens: number;
  readonly signal?: AbortSignal;
  readonly onTextChunk: (chunk: string) => void;

  /** Claude-Code-only: directory scoped to this call (containing a
   *  .claude/skills/ subtree) so only the bound skill is discoverable.
   *  Passed via --add-dir. Ignored by other providers. */
  readonly skillsDir?: string;

  /** Claude-Code-only permission mode. Default (unset) = 'default'. */
  readonly permissionMode?: PermissionMode;

  /** Lifts the single-turn cap. Default 1 keeps back-compat for the
   *  moderator/oracle single-shot callers. */
  readonly maxTurns?: number;

  /** Fired when Claude Code emits a tool_use / tool_result event. */
  readonly onToolUse?: (event: ToolUseEvent) => void;

  /** Extended thinking level. Anthropic API only; other providers ignore it. */
  readonly thinking?: 'off' | 'low' | 'medium' | 'high';
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
