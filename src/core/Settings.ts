import { spawn } from 'node:child_process';
import * as vscode from 'vscode';
import type { ProviderId } from '@/api/provider';

const SETTINGS_FILENAME = 'settings.json';
const HOLLOW_DIR = '.hollow';

export interface ProvidersConfig {
  readonly anthropic: { readonly defaultModel: string };
  readonly ollama: { readonly host: string; readonly defaultModel: string };
  readonly 'claude-code': { readonly defaultModel: string };
}

export interface AgentOverride {
  readonly provider?: ProviderId;
  readonly model?: string;
}

export interface Settings {
  readonly defaultProvider: ProviderId;
  readonly providers: ProvidersConfig;
  readonly agentOverrides: Readonly<Record<string, AgentOverride>>;
}

const DEFAULTS: Settings = {
  defaultProvider: 'claude-code',
  providers: {
    anthropic: { defaultModel: 'claude-sonnet-4-6' },
    ollama: { host: 'http://localhost:11434', defaultModel: 'gemma3:4b' },
    'claude-code': { defaultModel: 'sonnet' },
  },
  agentOverrides: {},
};

/**
 * Load .hollow/settings.json from the workspace, seeding defaults via
 * auto-detection on first use. If no workspace is open, returns in-memory
 * defaults without persisting.
 */
export async function loadSettings(): Promise<Settings> {
  const fileUri = settingsUri();
  if (!fileUri) return { ...DEFAULTS, defaultProvider: await autoDetectDefault() };

  try {
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    return normalize(raw);
  } catch (err) {
    if ((err as { code?: string }).code === 'FileNotFound' || isNotFound(err)) {
      const seeded: Settings = { ...DEFAULTS, defaultProvider: await autoDetectDefault() };
      await saveSettings(seeded);
      return seeded;
    }
    // Malformed file — fall back to defaults without overwriting the user's edit.
    console.error('[hollow halls] settings.json unreadable, using defaults:', err);
    return DEFAULTS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  const fileUri = settingsUri();
  if (!fileUri) return;
  const dirUri = vscode.Uri.joinPath(fileUri, '..');
  try {
    await vscode.workspace.fs.createDirectory(dirUri);
  } catch {
    // already exists
  }
  const body = JSON.stringify(s, null, 2) + '\n';
  await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(body));
}

export function settingsUri(): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  return vscode.Uri.joinPath(folder.uri, HOLLOW_DIR, SETTINGS_FILENAME);
}

export async function openSettingsInEditor(): Promise<void> {
  const uri = settingsUri();
  if (!uri) {
    vscode.window.showWarningMessage('Hollow Halls: open a workspace folder to edit settings.');
    return;
  }
  // Ensure file exists before opening.
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await saveSettings(await loadSettings());
  }
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
}

function isNotFound(err: unknown): boolean {
  const e = err as { code?: string; name?: string };
  return e?.code === 'ENOENT' || e?.name === 'EntryNotFound (FileSystemError)';
}

function normalize(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>;
  const providers = (r.providers ?? {}) as Partial<ProvidersConfig>;
  return {
    defaultProvider: normalizeProvider(r.defaultProvider) ?? DEFAULTS.defaultProvider,
    providers: {
      anthropic: {
        defaultModel: providers.anthropic?.defaultModel ?? DEFAULTS.providers.anthropic.defaultModel,
      },
      ollama: {
        host: providers.ollama?.host ?? DEFAULTS.providers.ollama.host,
        defaultModel: providers.ollama?.defaultModel ?? DEFAULTS.providers.ollama.defaultModel,
      },
      'claude-code': {
        defaultModel: providers['claude-code']?.defaultModel ?? DEFAULTS.providers['claude-code'].defaultModel,
      },
    },
    agentOverrides: r.agentOverrides ?? {},
  };
}

function normalizeProvider(v: unknown): ProviderId | undefined {
  return v === 'anthropic' || v === 'ollama' || v === 'claude-code' ? v : undefined;
}

/**
 * Pick a sensible default provider based on what's installed on the user's
 * machine. Preference: Claude Code (best voice quality via Max) > Ollama
 * (free local) > Anthropic API (requires key).
 */
async function autoDetectDefault(): Promise<ProviderId> {
  if (await claudeCodeAvailable()) return 'claude-code';
  if (await ollamaReachable('http://localhost:11434')) return 'ollama';
  return 'anthropic';
}

function claudeCodeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['auth', 'status'], {
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    child.stdout?.on('data', (d) => (stdout += d));
    child.on('error', () => resolve(false));
    child.on('exit', (code) => {
      if (code !== 0) return resolve(false);
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed?.loggedIn === true);
      } catch {
        resolve(false);
      }
    });
  });
}

async function ollamaReachable(host: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${host}/api/version`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
