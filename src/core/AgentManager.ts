import type {
  LlmProvider,
  PermissionMode,
  StreamResult,
  ToolUseEvent,
} from '@/api/provider';
import type { Room, AgentDef } from '@/rooms/types';

export interface RunRequest {
  readonly room: Room;
  readonly agent: AgentDef;
  readonly userPrompt: string;
  readonly meetingId: string;
  /** Claude-Code-only extras; silently ignored by other providers. */
  readonly permissionMode?: PermissionMode;
  readonly skillsDir?: string;
  readonly maxTurns?: number;
  readonly signal?: AbortSignal;
}

export interface StreamEvents {
  readonly onThinking: () => void;
  readonly onChunk: (chunk: string) => void;
  readonly onComplete: (result: StreamResult) => void;
  readonly onError: (err: Error) => void;
  readonly onToolUse?: (event: ToolUseEvent) => void;
}

export class AgentManager {
  constructor(private readonly provider: LlmProvider) {}

  async run(req: RunRequest, events: StreamEvents): Promise<void> {
    const system = composeSystemPrompt(req.room, req.agent);

    try {
      events.onThinking();
      const result = await this.provider.stream({
        system,
        userPrompt: req.userPrompt,
        // Pithy by design: Maya's prompt explicitly asks for short, structural
        // replies — capping max_tokens at 300 enforces that and halves cost
        // relative to a default 600 cap.
        maxTokens: 300,
        onTextChunk: events.onChunk,
        onToolUse: events.onToolUse,
        signal: req.signal,
        permissionMode: req.permissionMode,
        skillsDir: req.skillsDir,
        maxTurns: req.maxTurns,
      });
      events.onComplete(result);
    } catch (err) {
      events.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

function composeSystemPrompt(room: Room, agent: AgentDef): string {
  return `${room.systemPromptShared}\n\n---\n\n${agent.systemPrompt}`;
}
