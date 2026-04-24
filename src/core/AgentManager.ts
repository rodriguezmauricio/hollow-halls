import type { LlmProvider, StreamResult } from '@/api/provider';
import type { Room, AgentDef } from '@/rooms/types';

export interface RunRequest {
  readonly room: Room;
  readonly agent: AgentDef;
  readonly userPrompt: string;
  readonly meetingId: string;
}

export interface StreamEvents {
  readonly onThinking: () => void;
  readonly onChunk: (chunk: string) => void;
  readonly onComplete: (result: StreamResult) => void;
  readonly onError: (err: Error) => void;
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
