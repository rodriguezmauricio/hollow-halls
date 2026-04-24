import * as vscode from 'vscode';
import { AnthropicProvider } from '@/api/AnthropicProvider';
import { ClaudeCodeProvider } from '@/api/ClaudeCodeProvider';
import { OllamaProvider } from '@/api/OllamaProvider';
import { ProviderUnavailableError, type LlmProvider, type ProviderId } from '@/api/provider';
import { getApiKey } from '@/core/ApiKey';
import type { Settings } from '@/core/Settings';
import type { AgentDef } from '@/rooms/types';

export async function providerForAgent(
  ctx: vscode.ExtensionContext,
  agent: AgentDef,
  settings: Settings,
): Promise<LlmProvider> {
  const override = settings.agentOverrides[agent.id];
  const providerId: ProviderId = override?.provider ?? settings.defaultProvider;

  switch (providerId) {
    case 'claude-code': {
      const model = override?.model ?? settings.providers['claude-code'].defaultModel;
      return new ClaudeCodeProvider({ model });
    }

    case 'ollama': {
      const model = override?.model ?? settings.providers.ollama.defaultModel;
      const host = settings.providers.ollama.host;
      return new OllamaProvider({ model, host });
    }

    case 'anthropic': {
      const apiKey = await getApiKey(ctx);
      if (!apiKey) {
        throw new ProviderUnavailableError(
          'anthropic',
          'No Anthropic API key provided. Paste one when prompted, or switch provider in .hollow/settings.json.',
        );
      }
      const model = override?.model ?? settings.providers.anthropic.defaultModel;
      return new AnthropicProvider({ apiKey, model });
    }
  }
}
