import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, StreamArgs, StreamResult } from './provider';

const THINKING_BUDGET: Record<string, number> = {
  off: 0, low: 2000, medium: 8000, high: 16000,
};

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
    const budget = args.thinking ? (THINKING_BUDGET[args.thinking] ?? 0) : 0;
    // max_tokens must exceed budget_tokens when thinking is enabled.
    const maxTokens = budget > 0 ? Math.max(args.maxTokens, budget + 1024) : args.maxTokens;
    const thinkingParam = budget > 0
      ? { type: 'enabled' as const, budget_tokens: budget }
      : undefined;

    const stream = this.sdk.messages.stream(
      {
        model: this.opts.model,
        max_tokens: maxTokens,
        ...(thinkingParam ? { thinking: thinkingParam } : {}),
        system: args.system,
        messages: [{ role: 'user', content: args.userPrompt }],
      } as Parameters<typeof this.sdk.messages.stream>[0],
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
