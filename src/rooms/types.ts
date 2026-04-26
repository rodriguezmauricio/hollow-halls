import type { AgentVisual } from '@/messaging/protocol';

export type RoomPosition =
  | { readonly kind: 'grid'; readonly row: 0 | 1; readonly col: 0 | 1 | 2 }
  | { readonly kind: 'oracle' }
  | { readonly kind: 'great-hall' };

export interface AgentDef {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly systemPrompt: string;
  /** Optional hint used only when a provider has no settings-level default. */
  readonly preferredModel?: string;
  /** Per-agent visual identity rendered by webview/scene/Agent.ts. */
  readonly visual: AgentVisual;
  /** Directory-name lookup key for the bundled SKILL.md. Defaults to `id`. */
  readonly skillId?: string;
}

export interface Room {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly accentColor: string;
  readonly systemPromptShared: string;
  readonly agents: readonly AgentDef[];
  readonly position: RoomPosition;
  readonly isBuiltIn: boolean;
}
