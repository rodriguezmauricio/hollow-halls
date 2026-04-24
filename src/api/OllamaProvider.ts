import { Ollama } from 'ollama';
import { ProviderUnavailableError, type LlmProvider, type StreamArgs, type StreamResult } from './provider';

export interface OllamaProviderOptions {
  readonly host: string;
  readonly model: string;
}

export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama' as const;
  private readonly client: Ollama;

  constructor(private readonly opts: OllamaProviderOptions) {
    this.client = new Ollama({ host: opts.host });
  }

  async stream(args: StreamArgs): Promise<StreamResult> {
    const response = await this.chatOrThrow(args);

    let full = '';
    try {
      for await (const part of response) {
        if (args.signal?.aborted) {
          this.client.abort();
          break;
        }
        const chunk = part.message?.content ?? '';
        if (chunk) {
          full += chunk;
          args.onTextChunk(chunk);
        }
      }
    } catch (err) {
      // Aborted streams throw; swallow if the caller requested abort.
      if (args.signal?.aborted) {
        return { fullText: full, inputTokens: 0, outputTokens: 0, model: this.opts.model };
      }
      throw friendlyOllamaError(err, this.opts.host);
    }

    return { fullText: full, inputTokens: 0, outputTokens: 0, model: this.opts.model };
  }

  private async chatOrThrow(args: StreamArgs): Promise<AsyncIterable<{ message?: { content?: string } }>> {
    try {
      return await this.client.chat({
        model: this.opts.model,
        stream: true,
        messages: [
          { role: 'system', content: args.system },
          { role: 'user', content: args.userPrompt },
        ],
        options: { num_predict: args.maxTokens },
      });
    } catch (err) {
      throw friendlyOllamaError(err, this.opts.host);
    }
  }
}

function friendlyOllamaError(err: unknown, host: string): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (/ECONNREFUSED|fetch failed|network|ENOTFOUND/i.test(raw)) {
    return new ProviderUnavailableError(
      'ollama',
      `Ollama not reachable at ${host}. Run 'ollama serve', or change provider in .hollow/settings.json.`,
    );
  }
  if (/not found|does not exist|no such model/i.test(raw)) {
    return new ProviderUnavailableError(
      'ollama',
      `Model not found on Ollama host. Run 'ollama pull <model-tag>' to download it. (${raw})`,
    );
  }
  return err instanceof Error ? err : new Error(raw);
}
