import * as vscode from 'vscode';
import { AnthropicProvider } from '@/api/AnthropicProvider';
import { ClaudeCodeProvider } from '@/api/ClaudeCodeProvider';
import { OllamaProvider } from '@/api/OllamaProvider';
import {
  ProviderUnavailableError,
  type LlmProvider,
  type PermissionMode,
  type ProviderId,
} from '@/api/provider';
import { getApiKey } from '@/core/ApiKey';
import type { Settings } from '@/core/Settings';
import { SkillsManager } from '@/core/SkillsManager';
import type { AgentDef } from '@/rooms/types';

export interface AgentCallOptions {
  readonly provider: LlmProvider;
  /** Values for StreamArgs extras. Claude-Code-only fields are undefined for
   *  other providers, which silently ignore them. */
  readonly permissionMode?: PermissionMode;
  readonly maxTurns: number;
  readonly maxTokens: number;
  readonly skillsDir?: string;
}

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

/**
 * Full agent-call resolution: provider + permission mode + skill dir + maxTurns.
 * Use this for user-facing room/common-room calls. The moderator/oracle keep
 * the lighter `providerForAgent` path since they're single-shot and skill-free.
 *
 * Resolution chain:
 *   permissionMode: agentOverride > roomOverride > global default
 *   maxTurns:       agentOverride > roomOverride > global default
 *   skillsDir:      agentOverride.skillPath (if valid) > bundled out/skills/<id>
 *                   (undefined when neither resolves)
 *
 * Non-Claude-Code providers receive the same options but will ignore
 * skillsDir/permissionMode/maxTurns since StreamArgs makes those optional.
 */
export async function resolveAgentCall(
  ctx: vscode.ExtensionContext,
  agent: AgentDef,
  roomId: string,
  settings: Settings,
  skills: SkillsManager,
): Promise<AgentCallOptions> {
  const provider = await providerForAgent(ctx, agent, settings);
  const agentOverride = settings.agentOverrides[agent.id];
  const roomOverride = settings.roomOverrides[roomId];

  const permissionMode: PermissionMode =
    agentOverride?.permissionMode
    ?? roomOverride?.defaultPermissionMode
    ?? settings.defaultPermissionMode;

  const maxTurns =
    agentOverride?.maxTurns
    ?? roomOverride?.defaultMaxTurns
    ?? settings.defaultMaxTurns;

  // Skill scoping is only meaningful for Claude Code — other providers get
  // the dir but won't use it (the field is ignored by their StreamArgs).
  const skillsDir = provider.id === 'claude-code'
    ? await skills.skillDirFor(agent, settings)
    : undefined;

  const maxTokens = maxTokensForMode(permissionMode);

  return { provider, permissionMode, maxTurns, maxTokens, skillsDir };
}

/**
 * The moderator is a cheap routing call — it reads the transcript and picks
 * the next speaker. Uses the default provider but with that provider's
 * moderator-tier model (Haiku on Anthropic/Claude Code; same model on Ollama).
 */
export async function providerForModerator(
  ctx: vscode.ExtensionContext,
  settings: Settings,
): Promise<LlmProvider> {
  switch (settings.defaultProvider) {
    case 'claude-code':
      return new ClaudeCodeProvider({ model: settings.providers['claude-code'].moderatorModel });
    case 'ollama':
      return new OllamaProvider({
        model: settings.providers.ollama.moderatorModel,
        host: settings.providers.ollama.host,
      });
    case 'anthropic': {
      const apiKey = await getApiKey(ctx);
      if (!apiKey) {
        throw new ProviderUnavailableError(
          'anthropic',
          'No Anthropic API key provided. The moderator call needs one too.',
        );
      }
      return new AnthropicProvider({ apiKey, model: settings.providers.anthropic.moderatorModel });
    }
  }
}

function maxTokensForMode(mode: PermissionMode | undefined): number {
  switch (mode) {
    case 'plan':          return 2000;
    case 'acceptEdits':   return 800;
    default:              return 1000;
  }
}
