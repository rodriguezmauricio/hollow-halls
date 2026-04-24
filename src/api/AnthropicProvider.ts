import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, StreamArgs, StreamResult } from './provider';

export interface AnthropicProviderOptions {
  readonly apiKey: string;
  readonly model: string;
}

export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic' as const;
  private readonly sdk: Anthropic;

  constructor(private readonly opts: AnthropicProviderOptions) {
    this.sdk = new Anthropic({ apiKey: opts.apiKey });
  }

  async stream(args: StreamArgs): Promise<StreamResult> {
    const stream = this.sdk.messages.stream(
      {
        model: this.opts.model,
        max_tokens: args.maxTokens,
        system: args.system,
        messages: [{ role: 'user', content: args.userPrompt }],
      },
      args.signal ? { signal: args.signal } : undefined,
    );

    stream.on('text', (delta) => {
      if (delta) args.onTextChunk(delta);
    });

    const final = await stream.finalMessage();
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      fullText: text,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      model: this.opts.model,
    };
  }
}
