import * as vscode from 'vscode';
import type { Settings } from '@/core/Settings';
import type { AgentDef } from '@/rooms/types';

/**
 * Resolves which skill directory to pass to Claude Code's --add-dir for an
 * agent call, and scaffolds new user-authored skills.
 *
 * Bundled layout (produced by scripts/build.mjs from assets/skills/):
 *   out/skills/<skillId>/.claude/skills/<skillId>/SKILL.md
 *
 * The top-level `out/skills/<skillId>/` is the path we hand to --add-dir.
 * Claude Code then discovers `.claude/skills/` inside it and loads only that
 * skill, so agents don't leak skills into each other's calls.
 */
export class SkillsManager {
  constructor(private readonly ctx: vscode.ExtensionContext) {}

  /** Returns an absolute fs path to the agent's skill scope, or undefined when
   *  no skill resolves (agent calls still work, just without a bundled skill). */
  async skillDirFor(agent: AgentDef, settings: Settings): Promise<string | undefined> {
    const override = settings.agentOverrides[agent.id]?.skillPath;
    if (override && (await this.pathExists(override))) {
      return override;
    }

    const skillId = agent.skillId ?? agent.id;
    const bundled = vscode.Uri.joinPath(this.ctx.extensionUri, 'out', 'skills', skillId).fsPath;
    return (await this.pathExists(bundled)) ? bundled : undefined;
  }

  /**
   * Writes a SKILL.md scaffold to `<workspace>/.claude/skills/<name>/` so the
   * Claude Code CLI picks it up automatically (workspace-scoped skill). Returns
   * the URI of the new file so the extension can open it in the editor.
   */
  async createUserSkillScaffold(name: string): Promise<vscode.Uri | undefined> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return undefined;

    const safeName = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!safeName) return undefined;

    const dirUri = vscode.Uri.joinPath(folder.uri, '.claude', 'skills', safeName);
    try {
      await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
      // already exists — we'll overwrite only if missing, below
    }

    const fileUri = vscode.Uri.joinPath(dirUri, 'SKILL.md');
    try {
      await vscode.workspace.fs.stat(fileUri);
      // exists; don't clobber user content
      return fileUri;
    } catch {
      // not found — scaffold it
    }

    const body = scaffoldBody(safeName);
    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(body));
    return fileUri;
  }

  /** The absolute path to an agent's bundled SKILL.md on disk, if it exists. */
  async bundledSkillFile(agent: AgentDef): Promise<vscode.Uri | undefined> {
    const skillId = agent.skillId ?? agent.id;
    const uri = vscode.Uri.joinPath(
      this.ctx.extensionUri,
      'out',
      'skills',
      skillId,
      '.claude',
      'skills',
      skillId,
      'SKILL.md',
    );
    return (await this.pathExists(uri.fsPath)) ? uri : undefined;
  }

  private async pathExists(fsPath: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(fsPath));
      return true;
    } catch {
      return false;
    }
  }
}

function scaffoldBody(name: string): string {
  return `---
name: ${name}
description: ${name} — describe here when Claude should use this skill, with the trigger phrases you'd actually say.
allowed-tools: Read Grep Glob
---

# ${name}

Describe the procedure the skill follows. Keep it tight — a list of steps, not an essay.

1. First thing you always do (e.g. read the current state of the relevant file)
2. The analysis you perform
3. The specific shape of your answer (what the user sees at the end)

Stay in character. Reference other rooms by name when the work belongs to them.
`;
}
